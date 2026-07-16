import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import {
  BridgeProfileDesactualizadoError,
  BridgeProfileNoEncontradoError,
} from './bridgeProfilesRepo'
import { db } from './db'

export class BridgeProfileInactivoError extends Error {
  constructor(id: string) {
    super(`El perfil de bridge con id "${id}" ya no está activo`)
    this.name = 'BridgeProfileInactivoError'
  }
}

export class BridgeProfileIdentidadIncompatibleError extends Error {
  constructor(id: string) {
    super(`La identidad del perfil de bridge con id "${id}" no coincide`)
    this.name = 'BridgeProfileIdentidadIncompatibleError'
  }
}

export interface CajaSnapshotsRepository {
  obtener(profileId: string): Promise<StoredCajaSnapshot | undefined>
  guardarSiPerfilVigente(
    snapshot: StoredCajaSnapshot,
    expectedUpdatedAt: string,
  ): Promise<void>
  eliminar(profileId: string): Promise<void>
}

export const cajaSnapshotsRepo: CajaSnapshotsRepository = {
  obtener(profileId) {
    return db.cajaSnapshots.get(profileId)
  },

  async guardarSiPerfilVigente(snapshot, expectedUpdatedAt) {
    await db.transaction(
      'rw',
      db.bridgeProfiles,
      db.cajaSnapshots,
      db.config,
      async () => {
        const profile = await db.bridgeProfiles.get(snapshot.profileId)

        if (!profile) {
          throw new BridgeProfileNoEncontradoError(snapshot.profileId)
        }

        if (profile.updatedAt !== expectedUpdatedAt) {
          throw new BridgeProfileDesactualizadoError(snapshot.profileId)
        }

        const activeProfile = await db.config.get(
          'active_bridge_profile_id',
        )

        if (activeProfile?.value !== snapshot.profileId) {
          throw new BridgeProfileInactivoError(snapshot.profileId)
        }

        if (profile.sourceId !== snapshot.sourceId) {
          throw new BridgeProfileIdentidadIncompatibleError(
            snapshot.profileId,
          )
        }

        await db.cajaSnapshots.put(snapshot)
      },
    )
  },

  async eliminar(profileId) {
    await db.cajaSnapshots.delete(profileId)
  },
}
