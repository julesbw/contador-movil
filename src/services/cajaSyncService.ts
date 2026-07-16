import { type BridgeClient, bridgeClient } from '../api/bridgeClient'
import {
  BridgeProfileDesactualizadoError,
  BridgeProfileNoEncontradoError,
  bridgeProfilesRepo,
  type BridgeProfilesRepository,
} from '../db/bridgeProfilesRepo'
import {
  BridgeProfileIdentidadIncompatibleError,
  BridgeProfileInactivoError,
  cajaSnapshotsRepo,
  type CajaSnapshotsRepository,
} from '../db/cajaSnapshotsRepo'
import { configRepo, type ConfigRepository } from '../db/configRepo'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'

export type CajaSyncErrorCode =
  | 'PROFILE_NOT_VERIFIED'
  | 'SOURCE_MISMATCH'
  | 'SYNC_CANCELLED'

export class CajaSyncError extends Error {
  readonly code: CajaSyncErrorCode

  constructor(code: CajaSyncErrorCode, message: string) {
    super(message)
    this.name = 'CajaSyncError'
    this.code = code
  }
}

export class CajaSyncService {
  private readonly profiles: BridgeProfilesRepository
  private readonly snapshots: CajaSnapshotsRepository
  private readonly config: ConfigRepository
  private readonly client: Pick<
    BridgeClient,
    'obtenerSource' | 'obtenerLatest'
  >
  private readonly now: () => Date
  private active = false

  constructor(
    profiles: BridgeProfilesRepository = bridgeProfilesRepo,
    snapshots: CajaSnapshotsRepository = cajaSnapshotsRepo,
    config: ConfigRepository = configRepo,
    client: Pick<BridgeClient, 'obtenerSource' | 'obtenerLatest'> =
      bridgeClient,
    now: () => Date = () => new Date(),
  ) {
    this.profiles = profiles
    this.snapshots = snapshots
    this.config = config
    this.client = client
    this.now = now
  }

  obtenerSnapshot(
    profileId: string,
  ): Promise<StoredCajaSnapshot | undefined> {
    return this.snapshots.obtener(profileId)
  }

  async sincronizar(
    profileId: string,
    options: { signal?: AbortSignal } = {},
  ): Promise<StoredCajaSnapshot> {
    if (this.active) {
      throw new CajaSyncError(
        'SYNC_CANCELLED',
        'Ya existe una sincronización en curso.',
      )
    }

    this.active = true

    try {
      const profile = await this.profiles.obtener(profileId)

      if (!profile) {
        throw new CajaSyncError(
          'SYNC_CANCELLED',
          'El perfil dejó de estar disponible.',
        )
      }

      if (!profile.sourceId) {
        throw new CajaSyncError(
          'PROFILE_NOT_VERIFIED',
          'Verifica la conexión antes de sincronizar.',
        )
      }

      const activeProfileId = await this.config.obtener(
        'active_bridge_profile_id',
      )

      if (activeProfileId !== profile.id) {
        throw new CajaSyncError(
          'SYNC_CANCELLED',
          'El perfil activo cambió antes de sincronizar.',
        )
      }

      const source = await this.client.obtenerSource(
        profile.baseUrl,
        profile.token,
        options,
      )

      if (source.source_id !== profile.sourceId) {
        throw new CajaSyncError(
          'SOURCE_MISMATCH',
          'La identidad de la computadora no coincide con el perfil.',
        )
      }

      const latest = await this.client.obtenerLatest(
        profile.baseUrl,
        profile.token,
        options,
      )

      if (latest.source_id !== source.source_id) {
        throw new CajaSyncError(
          'SOURCE_MISMATCH',
          'El snapshot pertenece a una identidad diferente.',
        )
      }

      const stored: StoredCajaSnapshot = {
        profileId: profile.id,
        schemaVersion: latest.schema_version,
        snapshotId: latest.snapshot_id,
        sourceId: latest.source_id,
        sourceName: latest.source_name,
        scope: latest.scope,
        generatedAt: latest.generated_at,
        receivedAt: latest.received_at,
        syncedAt: this.now().toISOString(),
        billetes: { ...latest.billetes },
        total: latest.total,
      }

      try {
        await this.snapshots.guardarSiPerfilVigente(
          stored,
          profile.updatedAt,
        )
      } catch (error) {
        if (error instanceof BridgeProfileIdentidadIncompatibleError) {
          throw new CajaSyncError(
            'SOURCE_MISMATCH',
            'La identidad cambió antes de guardar el snapshot.',
          )
        }

        if (
          error instanceof BridgeProfileNoEncontradoError ||
          error instanceof BridgeProfileDesactualizadoError ||
          error instanceof BridgeProfileInactivoError
        ) {
          throw new CajaSyncError(
            'SYNC_CANCELLED',
            'El perfil cambió antes de guardar el snapshot.',
          )
        }

        throw error
      }

      return stored
    } finally {
      this.active = false
    }
  }
}

export const cajaSyncService = new CajaSyncService()
