import type { BridgeSourceResponse } from '../api/bridgeContracts'
import type { BridgeProfile } from '../models/BridgeProfile'
import type { BridgeProfileService } from './bridgeProfileService'
import type { CajaSyncService } from './cajaSyncService'

export type BridgeRelinkRequest = {
  profile: BridgeProfile
  source: BridgeSourceResponse
  signal?: AbortSignal
}

export class BridgeRelinkCompletionError extends Error {
  readonly profile: BridgeProfile
  readonly stage: 'select' | 'sync'
  override readonly cause: unknown

  constructor(
    profile: BridgeProfile,
    stage: 'select' | 'sync',
    cause: unknown,
  ) {
    super('La identidad se reemplazó, pero no fue posible completar la sincronización.')
    this.name = 'BridgeRelinkCompletionError'
    this.profile = profile
    this.stage = stage
    this.cause = cause
  }
}

export async function relinkAndSynchronizeBridgeProfile(
  profileService: BridgeProfileService,
  syncService: CajaSyncService,
  { profile, source, signal }: BridgeRelinkRequest,
): Promise<BridgeProfile> {
  const updated = await profileService.revincular(
    profile.id,
    profile.updatedAt,
    source,
  )

  try {
    await profileService.seleccionarActivo(updated.id)
  } catch (cause) {
    throw new BridgeRelinkCompletionError(updated, 'select', cause)
  }

  try {
    await syncService.sincronizar(updated.id, { signal })
  } catch (cause) {
    throw new BridgeRelinkCompletionError(updated, 'sync', cause)
  }

  return updated
}
