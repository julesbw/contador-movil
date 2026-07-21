import type { BridgeProfile } from '../models/BridgeProfile'

export function isBridgeProfileVerified(profile: BridgeProfile): boolean {
  return Boolean(
    profile.sourceId &&
      profile.lastVerifiedAt &&
      profile.lastVerifiedAt === profile.updatedAt,
  )
}
