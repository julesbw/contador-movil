export const BRIDGE_CLIENT_ERROR_CODES = [
  'BRIDGE_UNAVAILABLE',
  'BRIDGE_TIMEOUT',
  'AUTHORIZATION_REQUIRED',
  'INVALID_TOKEN',
  'REVOKED_TOKEN',
  'INSUFFICIENT_SCOPE',
  'SNAPSHOT_NOT_FOUND',
  'SOURCE_MISMATCH',
  'UNSUPPORTED_SCHEMA_VERSION',
  'INVALID_RESPONSE',
  'ORIGIN_NOT_ALLOWED',
  'SERVER_ERROR',
  'SYNC_CANCELLED',
] as const

export type BridgeClientErrorCode =
  (typeof BRIDGE_CLIENT_ERROR_CODES)[number]

const ERROR_MESSAGES: Record<BridgeClientErrorCode, string> = {
  BRIDGE_UNAVAILABLE: 'No fue posible conectar con el bridge.',
  BRIDGE_TIMEOUT: 'El bridge tardó demasiado en responder.',
  AUTHORIZATION_REQUIRED: 'Se requiere autorización para consultar el bridge.',
  INVALID_TOKEN: 'El token del bridge no es válido.',
  REVOKED_TOKEN: 'El token del bridge fue revocado.',
  INSUFFICIENT_SCOPE: 'El token no permite consultar snapshots.',
  SNAPSHOT_NOT_FOUND: 'La computadora todavía no tiene un snapshot disponible.',
  SOURCE_MISMATCH: 'La identidad de la computadora no coincide con el perfil.',
  UNSUPPORTED_SCHEMA_VERSION: 'La versión de respuesta del bridge no es compatible.',
  INVALID_RESPONSE: 'El bridge devolvió una respuesta no válida.',
  ORIGIN_NOT_ALLOWED: 'El bridge no permite peticiones desde esta aplicación.',
  SERVER_ERROR: 'El bridge no pudo completar la solicitud.',
  SYNC_CANCELLED: 'La sincronización fue cancelada.',
}

export class BridgeClientError extends Error {
  readonly code: BridgeClientErrorCode
  readonly status?: number

  constructor(code: BridgeClientErrorCode, status?: number) {
    super(ERROR_MESSAGES[code])
    this.name = 'BridgeClientError'
    this.code = code
    this.status = status
  }
}

export function isBridgeClientError(
  error: unknown,
): error is BridgeClientError {
  return error instanceof BridgeClientError
}
