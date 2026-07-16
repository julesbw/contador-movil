export const CAJA_SNAPSHOT_SCHEMA_VERSION = '1.0' as const

export type CajaSnapshotBilletes = {
  '1000': number
  '500': number
  '200': number
  '100': number
  '50': number
  '20': number
}

export type StoredCajaSnapshot = {
  profileId: string
  schemaVersion: typeof CAJA_SNAPSHOT_SCHEMA_VERSION
  snapshotId: string
  sourceId: string
  sourceName: string
  scope: 'caja'
  generatedAt: string
  receivedAt: string
  syncedAt: string
  billetes: CajaSnapshotBilletes
  total: number
}
