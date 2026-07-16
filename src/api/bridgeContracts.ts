import { BridgeClientError } from './bridgeErrors'

export const BRIDGE_SCHEMA_VERSION = '1.0' as const
export const BRIDGE_DENOMINATIONS = [
  '1000',
  '500',
  '200',
  '100',
  '50',
  '20',
] as const

export type BridgeDenomination = (typeof BRIDGE_DENOMINATIONS)[number]

export type BridgeBillCounts = Record<BridgeDenomination, number>

export type BridgeSourceResponse = {
  schema_version: typeof BRIDGE_SCHEMA_VERSION
  source_id: string
  source_name: string
}

export type BridgeSnapshotResponse = {
  schema_version: typeof BRIDGE_SCHEMA_VERSION
  snapshot_id: string
  source_id: string
  source_name: string
  scope: 'caja'
  generated_at: string
  received_at: string
  billetes: BridgeBillCounts
  total: number
}

const SOURCE_KEYS = [
  'schema_version',
  'source_id',
  'source_name',
] as const

const SNAPSHOT_KEYS = [
  'schema_version',
  'snapshot_id',
  'source_id',
  'source_name',
  'scope',
  'generated_at',
  'received_at',
  'billetes',
  'total',
] as const

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:[Zz]|[+-](\d{2}):(\d{2}))$/

function invalidResponse(): never {
  throw new BridgeClientError('INVALID_RESPONSE')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value)

  return (
    actualKeys.length === expectedKeys.length &&
    actualKeys.every((key) => expectedKeys.includes(key))
  )
}

function assertSchemaVersion(value: Record<string, unknown>): void {
  if (
    typeof value.schema_version === 'string' &&
    value.schema_version !== BRIDGE_SCHEMA_VERSION
  ) {
    throw new BridgeClientError('UNSUPPORTED_SCHEMA_VERSION')
  }

  if (value.schema_version !== BRIDGE_SCHEMA_VERSION) {
    invalidResponse()
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function codePointLength(value: string): number {
  return Array.from(value).length
}

function isSourceName(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const length = codePointLength(value)

  return value.trim().length > 0 && length <= 120
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function isRfc3339WithTimezone(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }

  const match = RFC3339_PATTERN.exec(value)

  if (!match) {
    return false
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6])
  const offsetHour = match[7] === undefined ? 0 : Number(match[7])
  const offsetMinute = match[8] === undefined ? 0 : Number(match[8])

  return (
    year >= 1 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth(year, month) &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 60 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  )
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value)
}

function validateBillCounts(value: unknown): BridgeBillCounts {
  if (!isRecord(value) || !hasExactKeys(value, BRIDGE_DENOMINATIONS)) {
    invalidResponse()
  }

  for (const denomination of BRIDGE_DENOMINATIONS) {
    if (!isSafeInteger(value[denomination])) {
      invalidResponse()
    }
  }

  return {
    '1000': value['1000'] as number,
    '500': value['500'] as number,
    '200': value['200'] as number,
    '100': value['100'] as number,
    '50': value['50'] as number,
    '20': value['20'] as number,
  }
}

function calculateTotal(billCounts: BridgeBillCounts): bigint {
  return BRIDGE_DENOMINATIONS.reduce(
    (total, denomination) =>
      total + BigInt(billCounts[denomination]) * BigInt(denomination),
    0n,
  )
}

export function validateBridgeSourceResponse(
  value: unknown,
): BridgeSourceResponse {
  if (!isRecord(value)) {
    invalidResponse()
  }

  assertSchemaVersion(value)

  if (
    !hasExactKeys(value, SOURCE_KEYS) ||
    !isUuid(value.source_id) ||
    !isSourceName(value.source_name)
  ) {
    invalidResponse()
  }

  return {
    schema_version: BRIDGE_SCHEMA_VERSION,
    source_id: value.source_id,
    source_name: value.source_name,
  }
}

export function validateBridgeSnapshotResponse(
  value: unknown,
): BridgeSnapshotResponse {
  if (!isRecord(value)) {
    invalidResponse()
  }

  assertSchemaVersion(value)

  if (
    !hasExactKeys(value, SNAPSHOT_KEYS) ||
    !isUuid(value.snapshot_id) ||
    !isUuid(value.source_id) ||
    !isSourceName(value.source_name) ||
    value.scope !== 'caja' ||
    !isRfc3339WithTimezone(value.generated_at) ||
    !isRfc3339WithTimezone(value.received_at) ||
    !isSafeInteger(value.total)
  ) {
    invalidResponse()
  }

  const billCounts = validateBillCounts(value.billetes)

  if (calculateTotal(billCounts) !== BigInt(value.total)) {
    invalidResponse()
  }

  return {
    schema_version: BRIDGE_SCHEMA_VERSION,
    snapshot_id: value.snapshot_id,
    source_id: value.source_id,
    source_name: value.source_name,
    scope: 'caja',
    generated_at: value.generated_at,
    received_at: value.received_at,
    billetes: billCounts,
    total: value.total,
  }
}
