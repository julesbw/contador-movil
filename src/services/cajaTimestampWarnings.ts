import type { StoredCajaSnapshot } from '../models/CajaSnapshot'

const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000

export type CajaTimestampWarning =
  | 'invalid_timestamp'
  | 'timestamp_without_timezone'
  | 'generated_in_future'
  | 'received_before_generated'
  | 'synced_before_received'

export function getCajaTimestampWarnings(
  snapshot: StoredCajaSnapshot,
  now: Date = new Date(),
): CajaTimestampWarning[] {
  const timestampValues = [
    snapshot.generatedAt,
    snapshot.receivedAt,
    snapshot.syncedAt,
  ]
  const [generatedAt, receivedAt, syncedAt] = timestampValues.map(Date.parse)
  const warnings: CajaTimestampWarning[] = []

  if (timestampValues.some((value) => Number.isNaN(Date.parse(value)))) {
    warnings.push('invalid_timestamp')
  }

  if (
    timestampValues.some(
      (value) => !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value),
    )
  ) {
    warnings.push('timestamp_without_timezone')
  }

  if (
    generatedAt !== undefined &&
    generatedAt > now.getTime() + CLOCK_SKEW_TOLERANCE_MS
  ) {
    warnings.push('generated_in_future')
  }

  if (
    generatedAt !== undefined &&
    receivedAt !== undefined &&
    receivedAt + CLOCK_SKEW_TOLERANCE_MS < generatedAt
  ) {
    warnings.push('received_before_generated')
  }

  if (
    receivedAt !== undefined &&
    syncedAt !== undefined &&
    syncedAt < receivedAt
  ) {
    warnings.push('synced_before_received')
  }

  return warnings
}

export function formatCajaTimestampWarning(
  warning: CajaTimestampWarning,
): string {
  switch (warning) {
    case 'invalid_timestamp':
      return 'Este dato contiene una fecha inválida.'
    case 'timestamp_without_timezone':
      return 'Este dato contiene una fecha sin zona horaria.'
    case 'generated_in_future':
      return 'La fecha generada en Excel parece estar en el futuro.'
    case 'received_before_generated':
      return 'La fecha del bridge es anterior a la fecha generada en Excel.'
    case 'synced_before_received':
      return 'La fecha de sincronización es anterior a la recepción del snapshot.'
  }
}
