import { describe, expect, it } from 'vitest'
import {
  isRfc3339WithTimezone,
  validateBridgeSnapshotResponse,
  validateBridgeSourceResponse,
  type BridgeSnapshotResponse,
  type BridgeSourceResponse,
} from './bridgeContracts'
import { BridgeClientError } from './bridgeErrors'

const sourceId = 'f07551e5-cfd9-4e01-a113-8a7ee185ecbf'
const snapshotId = 'a3740f6d-c468-44c5-8eb8-15a88bc028e7'

function createSource(
  changes: Partial<BridgeSourceResponse> = {},
): BridgeSourceResponse {
  return {
    schema_version: '1.0',
    source_id: sourceId,
    source_name: 'Equipo de prueba',
    ...changes,
  }
}

function createSnapshot(
  changes: Partial<BridgeSnapshotResponse> = {},
): BridgeSnapshotResponse {
  return {
    schema_version: '1.0',
    snapshot_id: snapshotId,
    source_id: sourceId,
    source_name: 'Equipo de prueba',
    scope: 'caja',
    generated_at: '2026-07-13T04:42:00.000Z',
    received_at: '2026-07-13T04:42:01.125Z',
    billetes: {
      '1000': 13,
      '500': 248,
      '200': 18,
      '100': -11,
      '50': 18,
      '20': 45,
    },
    total: 141_300,
    ...changes,
  }
}

function expectContractError(
  callback: () => unknown,
  code: BridgeClientError['code'],
): void {
  try {
    callback()
    throw new Error('La respuesta debió ser rechazada')
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(BridgeClientError)
    expect((error as BridgeClientError).code).toBe(code)
  }
}

describe('validateBridgeSourceResponse', () => {
  it('acepta y copia una respuesta source válida', () => {
    const input = createSource()
    const result = validateBridgeSourceResponse(input)

    expect(result).toEqual(input)
    expect(result).not.toBe(input)
  })

  it('acepta nombres de hasta 120 puntos de código', () => {
    const sourceName = '😀'.repeat(120)

    expect(
      validateBridgeSourceResponse(createSource({ source_name: sourceName }))
        .source_name,
    ).toBe(sourceName)
  })

  it.each([
    null,
    [],
    { ...createSource(), source_id: 'no-es-uuid' },
    { ...createSource(), source_name: '' },
    { ...createSource(), source_name: '   ' },
    { ...createSource(), source_name: 'a'.repeat(121) },
    { ...createSource(), inesperado: true },
    {
      schema_version: '1.0',
      source_id: sourceId,
    },
  ])('rechaza una respuesta source incompatible', (value) => {
    expectContractError(
      () => validateBridgeSourceResponse(value),
      'INVALID_RESPONSE',
    )
  })

  it('distingue una versión desconocida', () => {
    expectContractError(
      () =>
        validateBridgeSourceResponse({
          ...createSource(),
          schema_version: '2.0',
        }),
      'UNSUPPORTED_SCHEMA_VERSION',
    )
  })
})

describe('validateBridgeSnapshotResponse', () => {
  it('acepta el contrato canónico y conserva negativos', () => {
    const result = validateBridgeSnapshotResponse(createSnapshot())

    expect(result.billetes['100']).toBe(-11)
    expect(result.total).toBe(141_300)
  })

  it('calcula el total con BigInt sin perder precisión intermedia', () => {
    const max = Number.MAX_SAFE_INTEGER
    const result = validateBridgeSnapshotResponse(
      createSnapshot({
        billetes: {
          '1000': 7_836_263_351_624_662,
          '500': -max,
          '200': -max,
          '100': -max,
          '50': -max,
          '20': -max,
        },
        total: -170,
      }),
    )

    expect(result.total).toBe(-170)
  })

  it.each([
    ['total incorrecto', createSnapshot({ total: 1 })],
    [
      'propiedad raíz extra',
      { ...createSnapshot(), inesperado: true },
    ],
    [
      'propiedad raíz faltante',
      (({ total: _total, ...snapshot }) => snapshot)(createSnapshot()),
    ],
    [
      'denominación faltante',
      createSnapshot({
        billetes: {
          '1000': 13,
          '500': 248,
          '200': 18,
          '100': -11,
          '50': 18,
        } as BridgeSnapshotResponse['billetes'],
      }),
    ],
    [
      'denominación extra',
      createSnapshot({
        billetes: {
          ...createSnapshot().billetes,
          monedas: 10,
        } as BridgeSnapshotResponse['billetes'],
      }),
    ],
    [
      'cantidad decimal',
      createSnapshot({
        billetes: { ...createSnapshot().billetes, '20': 1.5 },
      }),
    ],
    [
      'cantidad insegura',
      createSnapshot({
        billetes: {
          ...createSnapshot().billetes,
          '20': Number.MAX_SAFE_INTEGER + 1,
        },
      }),
    ],
    [
      'total inseguro',
      createSnapshot({ total: Number.MAX_SAFE_INTEGER + 1 }),
    ],
    [
      'fecha imposible',
      createSnapshot({ generated_at: '2026-02-29T10:00:00Z' }),
    ],
    [
      'fecha sin zona',
      createSnapshot({ received_at: '2026-07-13T04:42:01' }),
    ],
    ['UUID inválido', createSnapshot({ snapshot_id: 'snapshot-1' })],
    [
      'scope inválido',
      { ...createSnapshot(), scope: 'arrendamientos' },
    ],
  ])('rechaza %s', (_description, value) => {
    expectContractError(
      () => validateBridgeSnapshotResponse(value),
      'INVALID_RESPONSE',
    )
  })

  it('distingue una versión de snapshot desconocida', () => {
    expectContractError(
      () =>
        validateBridgeSnapshotResponse({
          ...createSnapshot(),
          schema_version: '2.0',
        }),
      'UNSUPPORTED_SCHEMA_VERSION',
    )
  })
})

describe('isRfc3339WithTimezone', () => {
  it.each([
    '2026-07-13T04:42:00Z',
    '2026-07-13t04:42:00.123z',
    '2026-07-13T04:42:00-06:00',
    '2024-02-29T23:59:60+00:00',
  ])('acepta %s', (value) => {
    expect(isRfc3339WithTimezone(value)).toBe(true)
  })

  it.each([
    '2026-07-13T04:42:00',
    '2026-13-01T00:00:00Z',
    '2026-04-31T00:00:00Z',
    '0000-01-01T00:00:00Z',
    '2026-01-01T24:00:00Z',
    '2026-01-01T00:00:61Z',
    '2026-01-01T00:00:00+24:00',
  ])('rechaza %s', (value) => {
    expect(isRfc3339WithTimezone(value)).toBe(false)
  })
})
