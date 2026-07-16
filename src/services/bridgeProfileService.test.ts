import { describe, expect, it, vi } from 'vitest'
import type { BridgeClient } from '../api/bridgeClient'
import type { BridgeSourceResponse } from '../api/bridgeContracts'
import type {
  BridgeProfileIdentity,
  BridgeProfilesRepository,
  CambiosBridgeProfile,
} from '../db/bridgeProfilesRepo'
import type { ConfigRepository } from '../db/configRepo'
import type { BridgeProfile } from '../models/BridgeProfile'
import type { ConfigKey } from '../models/ConfigItem'
import {
  BridgeProfileService,
  BridgeProfileValidationError,
} from './bridgeProfileService'

const source: BridgeSourceResponse = {
  schema_version: '1.0',
  source_id: '00000000-0000-4000-8000-000000000002',
  source_name: 'Equipo de prueba',
}

function createRepositories(initial: BridgeProfile[] = []) {
  const profiles = new Map(initial.map((profile) => [profile.id, profile]))
  const configValues = new Map<ConfigKey, string>()
  const confirmations: boolean[] = []

  const profileRepository: BridgeProfilesRepository = {
    listar: async () => [...profiles.values()],
    obtener: async (id) => profiles.get(id),
    crear: async (profile) => {
      profiles.set(profile.id, profile)
      return profile.id
    },
    actualizar: async (id, changes: CambiosBridgeProfile) => {
      const profile = profiles.get(id)
      if (profile) {
        profiles.set(id, { ...profile, ...changes })
      }
    },
    eliminarConDatos: async (id) => {
      profiles.delete(id)
      if (configValues.get('active_bridge_profile_id') === id) {
        configValues.delete('active_bridge_profile_id')
      }
    },
    confirmarIdentidad: async (
      id: string,
      _expectedUpdatedAt: string,
      identity: BridgeProfileIdentity,
      now: string,
      relink: boolean,
    ) => {
      confirmations.push(relink)
      const profile = profiles.get(id) as BridgeProfile
      const updated = {
        ...profile,
        ...identity,
        lastVerifiedAt: now,
        updatedAt: now,
      }
      profiles.set(id, updated)
      return updated
    },
    existe: async (id) => profiles.has(id),
  }

  const configRepository: ConfigRepository = {
    obtener: async (key) => configValues.get(key),
    guardar: async (key, value) => {
      configValues.set(key, value)
    },
    eliminar: async (key) => {
      configValues.delete(key)
    },
    obtenerTodo: async () =>
      [...configValues].map(([key, value]) => ({ key, value })),
  }

  return {
    profiles,
    configValues,
    confirmations,
    profileRepository,
    configRepository,
  }
}

function createProfile(changes: Partial<BridgeProfile> = {}): BridgeProfile {
  return {
    id: 'profile-1',
    name: 'Caja principal',
    baseUrl: 'https://equipo.example',
    token: 'secret-token',
    createdAt: '2026-07-15T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
    ...changes,
  }
}

function createService(
  initial: BridgeProfile[] = [],
  sourceResponse: BridgeSourceResponse = source,
) {
  const repositories = createRepositories(initial)
  const client: Pick<BridgeClient, 'obtenerSource'> = {
    obtenerSource: vi.fn(async () => sourceResponse),
  }
  const service = new BridgeProfileService(
    repositories.profileRepository,
    repositories.configRepository,
    client,
    () => new Date('2026-07-15T10:05:00.000Z'),
    () => '00000000-0000-4000-8000-000000000001',
  )

  return { service, client, ...repositories }
}

describe('BridgeProfileService', () => {
  it('crea un perfil local normalizado y todavía sin identidad', async () => {
    const { service, profiles } = createService()

    const profile = await service.crear({
      name: '  Principal  ',
      baseUrl: 'https://EQUIPO.example/',
      token: '  read-token  ',
    })

    expect(profile).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Principal',
      baseUrl: 'https://equipo.example',
      token: 'read-token',
    })
    expect(profile.sourceId).toBeUndefined()
    expect(profiles.get(profile.id)).toEqual(profile)
  })

  it('rechaza alias o token vacíos', async () => {
    const { service } = createService()

    await expect(
      service.crear({
        name: ' ',
        baseUrl: 'https://equipo.example',
        token: 'token',
      }),
    ).rejects.toBeInstanceOf(BridgeProfileValidationError)
    await expect(
      service.crear({
        name: 'Equipo',
        baseUrl: 'https://equipo.example',
        token: ' ',
      }),
    ).rejects.toBeInstanceOf(BridgeProfileValidationError)
  })

  it('persiste y limpia el perfil activo', async () => {
    const profile = createProfile()
    const { service, configValues } = createService([profile])

    await service.seleccionarActivo(profile.id)
    expect((await service.obtenerActivo())?.id).toBe(profile.id)

    await service.seleccionarActivo(undefined)
    expect(configValues.has('active_bridge_profile_id')).toBe(false)
  })

  it('no vincula la primera identidad antes de confirmarla', async () => {
    const profile = createProfile()
    const { service, confirmations } = createService([profile])

    const verification = await service.verificar(profile.id)

    expect(verification.status).toBe('requires-confirmation')
    expect(confirmations).toEqual([])

    const updated = await service.confirmarPrimeraIdentidad(
      profile.id,
      profile.updatedAt,
      source,
    )
    expect(updated.sourceId).toBe(source.source_id)
    expect(confirmations).toEqual([false])
  })

  it('actualiza la verificación cuando la identidad coincide', async () => {
    const profile = createProfile({ sourceId: source.source_id })
    const { service, confirmations } = createService([profile])

    const verification = await service.verificar(profile.id)

    expect(verification.status).toBe('verified')
    expect(confirmations).toEqual([false])
  })

  it('bloquea una identidad distinta hasta una re-vinculación explícita', async () => {
    const profile = createProfile({
      sourceId: '00000000-0000-4000-8000-000000000099',
    })
    const { service, confirmations } = createService([profile])

    const verification = await service.verificar(profile.id)

    expect(verification.status).toBe('mismatch')
    expect(confirmations).toEqual([])

    await service.revincular(profile.id, profile.updatedAt, source)
    expect(confirmations).toEqual([true])
  })

  it('elimina el perfil y su selección activa mediante el repositorio', async () => {
    const profile = createProfile()
    const { service, profiles, configValues } = createService([profile])
    await service.seleccionarActivo(profile.id)

    await service.eliminar(profile.id)

    expect(profiles.has(profile.id)).toBe(false)
    expect(configValues.has('active_bridge_profile_id')).toBe(false)
  })
})
