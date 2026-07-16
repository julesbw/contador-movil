import type { BridgeProfile } from '../models/BridgeProfile'
import { db } from './db'

export type CambiosBridgeProfile = Partial<
  Omit<BridgeProfile, 'id' | 'createdAt'>
>

export type BridgeProfileIdentity = {
  sourceId: string
  sourceName: string
}

export class BridgeProfileNoEncontradoError extends Error {
  constructor(id: string) {
    super(`No existe el perfil de bridge con id "${id}"`)
    this.name = 'BridgeProfileNoEncontradoError'
  }
}

export class BridgeProfileDesactualizadoError extends Error {
  constructor(id: string) {
    super(`El perfil de bridge con id "${id}" cambió durante la operación`)
    this.name = 'BridgeProfileDesactualizadoError'
  }
}

export class BridgeProfileRelinkRequiredError extends Error {
  constructor(id: string) {
    super(`El perfil de bridge con id "${id}" requiere re-vinculación`)
    this.name = 'BridgeProfileRelinkRequiredError'
  }
}

export interface BridgeProfilesRepository {
  listar(): Promise<BridgeProfile[]>
  obtener(id: string): Promise<BridgeProfile | undefined>
  crear(profile: BridgeProfile): Promise<string>
  actualizar(id: string, cambios: CambiosBridgeProfile): Promise<void>
  eliminarConDatos(id: string): Promise<void>
  confirmarIdentidad(
    id: string,
    expectedUpdatedAt: string,
    identity: BridgeProfileIdentity,
    now: string,
    relink: boolean,
  ): Promise<BridgeProfile>
  existe(id: string): Promise<boolean>
}

export const bridgeProfilesRepo: BridgeProfilesRepository = {
  listar() {
    return db.bridgeProfiles.orderBy('createdAt').toArray()
  },

  obtener(id) {
    return db.bridgeProfiles.get(id)
  },

  crear(profile) {
    return db.bridgeProfiles.add(profile)
  },

  async actualizar(id, cambios) {
    const registrosActualizados = await db.bridgeProfiles.update(id, cambios)

    if (registrosActualizados === 0) {
      throw new BridgeProfileNoEncontradoError(id)
    }
  },

  async eliminarConDatos(id) {
    await db.transaction(
      'rw',
      db.bridgeProfiles,
      db.cajaSnapshots,
      db.config,
      async () => {
        await db.bridgeProfiles.delete(id)
        await db.cajaSnapshots.delete(id)

        const activeProfile = await db.config.get(
          'active_bridge_profile_id',
        )

        if (activeProfile?.value === id) {
          await db.config.delete('active_bridge_profile_id')
        }
      },
    )
  },

  async confirmarIdentidad(
    id,
    expectedUpdatedAt,
    identity,
    now,
    relink,
  ) {
    return db.transaction(
      'rw',
      db.bridgeProfiles,
      db.cajaSnapshots,
      async () => {
        const profile = await db.bridgeProfiles.get(id)

        if (!profile) {
          throw new BridgeProfileNoEncontradoError(id)
        }

        if (profile.updatedAt !== expectedUpdatedAt) {
          throw new BridgeProfileDesactualizadoError(id)
        }

        if (
          !relink &&
          profile.sourceId !== undefined &&
          profile.sourceId !== identity.sourceId
        ) {
          throw new BridgeProfileRelinkRequiredError(id)
        }

        const updatedProfile: BridgeProfile = {
          ...profile,
          sourceId: identity.sourceId,
          sourceName: identity.sourceName,
          lastVerifiedAt: now,
          updatedAt: now,
        }

        if (relink) {
          await db.cajaSnapshots.delete(id)
        }

        await db.bridgeProfiles.put(updatedProfile)

        return updatedProfile
      },
    )
  },

  async existe(id) {
    return (await db.bridgeProfiles.get(id)) !== undefined
  },
}
