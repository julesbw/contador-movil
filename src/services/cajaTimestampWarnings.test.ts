import { describe, expect, it } from 'vitest'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import { getCajaTimestampWarnings } from './cajaTimestampWarnings'

function snapshot(
  changes: Partial<StoredCajaSnapshot> = {},
): StoredCajaSnapshot {
  return {
    profileId: 'profile-1',
    schemaVersion: '1.0',
    snapshotId: '00000000-0000-4000-8000-000000000001',
    sourceId: '00000000-0000-4000-8000-000000000002',
    sourceName: 'Equipo',
    scope: 'caja',
    generatedAt: '2026-07-15T10:00:00.000Z',
    receivedAt: '2026-07-15T10:00:01.000Z',
    syncedAt: '2026-07-15T10:00:02.000Z',
    billetes: {
      '1000': 0,
      '500': 0,
      '200': 0,
      '100': 0,
      '50': 0,
      '20': 0,
    },
    total: 0,
    ...changes,
  }
}

describe('getCajaTimestampWarnings', () => {
  it('no advierte sobre fechas coherentes', () => {
    expect(
      getCajaTimestampWarnings(
        snapshot(),
        new Date('2026-07-15T10:01:00.000Z'),
      ),
    ).toEqual([])
  })

  it('detecta fechas futuras e inconsistentes', () => {
    expect(
      getCajaTimestampWarnings(
        snapshot({
          generatedAt: '2026-07-15T10:20:00.000Z',
          receivedAt: '2026-07-15T10:00:00.000Z',
          syncedAt: '2026-07-15T09:59:00.000Z',
        }),
        new Date('2026-07-15T10:00:00.000Z'),
      ),
    ).toEqual([
      'generated_in_future',
      'received_before_generated',
      'synced_before_received',
    ])
  })

  it('advierte sobre fechas inválidas o sin zona', () => {
    expect(
      getCajaTimestampWarnings(
        snapshot({
          generatedAt: 'fecha-invalida',
          receivedAt: '2026-07-15T10:00:00',
        }),
        new Date('2026-07-15T10:00:00.000Z'),
      ).slice(0, 2),
    ).toEqual(['invalid_timestamp', 'timestamp_without_timezone'])
  })
})
