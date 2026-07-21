import { describe, expect, it, vi } from 'vitest'
import type { BridgeClient } from '../api/bridgeClient'
import type {
  BridgeSnapshotResponse,
  BridgeSourceResponse,
} from '../api/bridgeContracts'
import { BridgeClientError } from '../api/bridgeErrors'
import type { BridgeProfilesRepository } from '../db/bridgeProfilesRepo'
import type { CajaSnapshotsRepository } from '../db/cajaSnapshotsRepo'
import type { ConfigRepository } from '../db/configRepo'
import type { BridgeProfile } from '../models/BridgeProfile'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import { CajaSyncError, CajaSyncService } from './cajaSyncService'

const sourceId = '00000000-0000-4000-8000-000000000002'
const profile: BridgeProfile = {
  id: 'profile-1',
  name: 'Principal',
  baseUrl: 'https://equipo.example',
  token: 'read-token',
  sourceId,
  sourceName: 'Equipo',
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
  lastVerifiedAt: '2026-07-15T10:00:00.000Z',
}
const source: BridgeSourceResponse = {
  schema_version: '1.0',
  source_id: sourceId,
  source_name: 'Equipo',
}
const latest: BridgeSnapshotResponse = {
  schema_version: '1.0',
  snapshot_id: '00000000-0000-4000-8000-000000000003',
  source_id: sourceId,
  source_name: 'Equipo',
  scope: 'caja',
  generated_at: '2026-07-15T10:01:00.000Z',
  received_at: '2026-07-15T10:01:01.000Z',
  billetes: {
    '1000': 1,
    '500': 0,
    '200': 0,
    '100': -1,
    '50': 0,
    '20': 0,
  },
  total: 900,
}

function createDependencies(options: {
  profile?: BridgeProfile
  activeId?: string
  previous?: StoredCajaSnapshot
  source?: BridgeSourceResponse
  latest?: BridgeSnapshotResponse
  sourceError?: unknown
  latestError?: unknown
} = {}) {
  const currentProfile = options.profile ?? profile
  let stored = options.previous
  const saves: StoredCajaSnapshot[] = []

  const profiles: BridgeProfilesRepository = {
    listar: async () => [currentProfile],
    obtener: async (id) =>
      id === currentProfile.id ? currentProfile : undefined,
    crear: async () => currentProfile.id,
    actualizar: async () => undefined,
    eliminarConDatos: async () => undefined,
    confirmarIdentidad: async () => currentProfile,
    existe: async (id) => id === currentProfile.id,
  }
  const snapshots: CajaSnapshotsRepository = {
    obtener: async () => stored,
    guardarSiPerfilVigente: async (snapshot) => {
      saves.push(snapshot)
      stored = snapshot
    },
    eliminar: async () => {
      stored = undefined
    },
  }
  const config: ConfigRepository = {
    obtener: async (key) =>
      key === 'active_bridge_profile_id'
        ? (options.activeId ?? currentProfile.id)
        : undefined,
    guardar: async () => undefined,
    eliminar: async () => undefined,
    obtenerTodo: async () => [],
  }
  const client: Pick<BridgeClient, 'obtenerSource' | 'obtenerLatest'> = {
    obtenerSource: vi.fn(async () => {
      if (options.sourceError) {
        throw options.sourceError
      }
      return options.source ?? source
    }),
    obtenerLatest: vi.fn(async () => {
      if (options.latestError) {
        throw options.latestError
      }
      return options.latest ?? latest
    }),
  }
  const service = new CajaSyncService(
    profiles,
    snapshots,
    config,
    client,
    () => new Date('2026-07-15T10:02:00.000Z'),
  )

  return { service, saves, client, getStored: () => stored }
}

describe('CajaSyncService', () => {
  it('verifica source, valida latest y guarda una sola vez al final', async () => {
    const { service, saves, client } = createDependencies()

    const snapshot = await service.sincronizar(profile.id)

    expect(client.obtenerSource).toHaveBeenCalledBefore(
      client.obtenerLatest as ReturnType<typeof vi.fn>,
    )
    expect(snapshot).toMatchObject({
      profileId: profile.id,
      sourceId,
      total: 900,
      syncedAt: '2026-07-15T10:02:00.000Z',
    })
    expect(snapshot.billetes['100']).toBe(-1)
    expect(saves).toEqual([snapshot])
  })

  it('no consulta ni guarda un perfil sin verificar', async () => {
    const previous: StoredCajaSnapshot = {
      profileId: profile.id,
      schemaVersion: '1.0',
      snapshotId: '00000000-0000-4000-8000-000000000010',
      sourceId,
      sourceName: 'Equipo',
      scope: 'caja',
      generatedAt: '2026-07-14T10:00:00.000Z',
      receivedAt: '2026-07-14T10:00:01.000Z',
      syncedAt: '2026-07-14T10:00:02.000Z',
      billetes: latest.billetes,
      total: latest.total,
    }
    const dependencies = createDependencies({
      profile: { ...profile, sourceId: undefined },
      previous,
    })

    await expect(
      dependencies.service.sincronizar(profile.id),
    ).rejects.toMatchObject({ code: 'PROFILE_NOT_VERIFIED' })
    expect(dependencies.client.obtenerSource).not.toHaveBeenCalled()
    expect(dependencies.saves).toEqual([])
    expect(dependencies.getStored()).toBe(previous)
  })

  it('bloquea source mismatch antes de solicitar latest', async () => {
    const dependencies = createDependencies({
      source: {
        ...source,
        source_id: '00000000-0000-4000-8000-000000000099',
      },
    })

    await expect(
      dependencies.service.sincronizar(profile.id),
    ).rejects.toMatchObject({ code: 'SOURCE_MISMATCH' })
    expect(dependencies.client.obtenerLatest).not.toHaveBeenCalled()
    expect(dependencies.saves).toEqual([])
  })

  it('bloquea un snapshot de otra identidad', async () => {
    const dependencies = createDependencies({
      latest: {
        ...latest,
        source_id: '00000000-0000-4000-8000-000000000099',
      },
    })

    await expect(
      dependencies.service.sincronizar(profile.id),
    ).rejects.toMatchObject({ code: 'SOURCE_MISMATCH' })
    expect(dependencies.saves).toEqual([])
  })

  it('conserva el snapshot anterior ante red, token revocado o latest corrupto', async () => {
    const previous: StoredCajaSnapshot = {
      profileId: profile.id,
      schemaVersion: '1.0',
      snapshotId: '00000000-0000-4000-8000-000000000010',
      sourceId,
      sourceName: 'Equipo',
      scope: 'caja',
      generatedAt: '2026-07-14T10:00:00.000Z',
      receivedAt: '2026-07-14T10:00:01.000Z',
      syncedAt: '2026-07-14T10:00:02.000Z',
      billetes: latest.billetes,
      total: latest.total,
    }

    for (const error of [
      new BridgeClientError('BRIDGE_UNAVAILABLE'),
      new BridgeClientError('REVOKED_TOKEN', 401),
      new BridgeClientError('INVALID_RESPONSE'),
    ]) {
      const dependencies = createDependencies({
        previous,
        latestError: error,
      })

      await expect(
        dependencies.service.sincronizar(profile.id),
      ).rejects.toBe(error)
      expect(dependencies.getStored()).toBe(previous)
      expect(dependencies.saves).toEqual([])
    }
  })

  it('rechaza una sincronización si el perfil dejó de estar activo', async () => {
    const dependencies = createDependencies({ activeId: 'profile-2' })

    await expect(
      dependencies.service.sincronizar(profile.id),
    ).rejects.toMatchObject({ code: 'SYNC_CANCELLED' })
    expect(dependencies.client.obtenerSource).not.toHaveBeenCalled()
  })

  it('impide dos sincronizaciones simultáneas por instancia', async () => {
    let releaseSource: ((value: BridgeSourceResponse) => void) | undefined
    const dependencies = createDependencies()
    ;(
      dependencies.client.obtenerSource as ReturnType<typeof vi.fn>
    ).mockImplementation(
      () =>
        new Promise<BridgeSourceResponse>((resolve) => {
          releaseSource = resolve
        }),
    )

    const first = dependencies.service.sincronizar(profile.id)
    await Promise.resolve()

    await expect(
      dependencies.service.sincronizar(profile.id),
    ).rejects.toBeInstanceOf(CajaSyncError)

    releaseSource?.(source)
    await first
    expect(dependencies.saves).toHaveLength(1)
  })
})
