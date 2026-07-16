import { describe, expect, it } from 'vitest'
import {
  BridgeUrlValidationError,
  normalizeBridgeBaseUrl,
  type BridgeUrlErrorCode,
} from './bridgeUrl'

function expectUrlError(value: string, code: BridgeUrlErrorCode): void {
  try {
    normalizeBridgeBaseUrl(value)
    throw new Error('La URL debió ser rechazada')
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(BridgeUrlValidationError)
    expect((error as BridgeUrlValidationError).code).toBe(code)
  }
}

describe('normalizeBridgeBaseUrl', () => {
  it('conserva únicamente el origen HTTPS normalizado', () => {
    expect(
      normalizeBridgeBaseUrl('  https://Equipo.Tailnet.TS.Net/  '),
    ).toBe('https://equipo.tailnet.ts.net')
    expect(
      normalizeBridgeBaseUrl('https://equipo.tailnet.ts.net:443'),
    ).toBe('https://equipo.tailnet.ts.net')
  })

  it.each([
    ['', 'URL_REQUIRED'],
    ['equipo.tailnet.ts.net', 'URL_INVALID'],
    ['https://', 'URL_INVALID'],
    ['https:equipo.tailnet.ts.net', 'URL_INVALID'],
    ['http://equipo.tailnet.ts.net', 'HTTPS_REQUIRED'],
    ['javascript:alert(1)', 'HTTPS_REQUIRED'],
    ['data:text/plain,bridge', 'HTTPS_REQUIRED'],
    [
      'https://usuario:secreto@equipo.tailnet.ts.net',
      'CREDENTIALS_NOT_ALLOWED',
    ],
    ['https://equipo.tailnet.ts.net?token=x', 'QUERY_NOT_ALLOWED'],
    ['https://equipo.tailnet.ts.net?', 'QUERY_NOT_ALLOWED'],
    ['https://equipo.tailnet.ts.net#caja', 'FRAGMENT_NOT_ALLOWED'],
    ['https://equipo.tailnet.ts.net#', 'FRAGMENT_NOT_ALLOWED'],
    ['https://equipo.tailnet.ts.net/api', 'PATH_NOT_ALLOWED'],
    ['https://equipo.tailnet.ts.net/.', 'PATH_NOT_ALLOWED'],
    [
      'https://equipo.tailnet.ts.net:8766',
      'DIRECT_BRIDGE_PORT_NOT_ALLOWED',
    ],
    ['https://localhost', 'LOOPBACK_NOT_ALLOWED'],
    ['https://bridge.localhost', 'LOOPBACK_NOT_ALLOWED'],
    ['https://127.0.0.1', 'LOOPBACK_NOT_ALLOWED'],
    ['https://127.20.30.40', 'LOOPBACK_NOT_ALLOWED'],
    ['https://[::1]', 'LOOPBACK_NOT_ALLOWED'],
    ['https://[::ffff:127.0.0.1]', 'LOOPBACK_NOT_ALLOWED'],
  ] as const)('rechaza %s con %s', (value, code) => {
    expectUrlError(value, code)
  })
})
