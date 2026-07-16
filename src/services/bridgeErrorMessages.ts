import { BridgeProfileValidationError } from './bridgeProfileService'

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  BRIDGE_UNAVAILABLE:
    'No se pudo conectar con esta computadora. Comprueba que esté encendida, que el bridge esté activo y que Tailscale esté conectado.',
  BRIDGE_TIMEOUT:
    'La computadora tardó demasiado en responder. Intenta nuevamente.',
  AUTHORIZATION_REQUIRED:
    'Este perfil no contiene una autorización de lectura válida.',
  INVALID_TOKEN: 'El token de lectura no es válido.',
  REVOKED_TOKEN: 'El token de lectura fue revocado.',
  INSUFFICIENT_SCOPE:
    'El token no tiene permiso para consultar snapshots.',
  SNAPSHOT_NOT_FOUND:
    'Esta computadora todavía no tiene un snapshot de Caja.',
  SOURCE_MISMATCH:
    'La URL corresponde a otra computadora. Revisa o vuelve a vincular el perfil.',
  UNSUPPORTED_SCHEMA_VERSION:
    'La computadora usa una versión del contrato que esta aplicación no reconoce.',
  INVALID_RESPONSE:
    'La computadora devolvió datos que no cumplen el contrato esperado.',
  ORIGIN_NOT_ALLOWED:
    'El bridge no permite conexiones desde esta instalación de la aplicación.',
  SERVER_ERROR:
    'El bridge encontró un problema interno. El último dato guardado se conserva.',
  SYNC_CANCELLED: 'La sincronización fue cancelada.',
  PROFILE_NOT_VERIFIED: 'Verifica la conexión antes de sincronizar.',
  URL_REQUIRED: 'Escribe la URL privada del bridge.',
  URL_INVALID: 'La URL privada no es válida.',
  HTTPS_REQUIRED: 'La URL privada debe usar HTTPS.',
  CREDENTIALS_NOT_ALLOWED: 'La URL privada no debe incluir credenciales.',
  QUERY_NOT_ALLOWED: 'La URL privada no debe incluir parámetros.',
  FRAGMENT_NOT_ALLOWED: 'La URL privada no debe incluir fragmentos.',
  PATH_NOT_ALLOWED: 'La URL privada debe contener únicamente el origen.',
  LOOPBACK_NOT_ALLOWED:
    'La URL privada debe apuntar a Tailscale Serve, no a este dispositivo.',
  DIRECT_BRIDGE_PORT_NOT_ALLOWED:
    'Usa la URL HTTPS de Tailscale Serve, no el puerto directo del bridge.',
}

export function getBridgeErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }

  return typeof error.code === 'string' ? error.code : undefined
}

export function getBridgeErrorMessage(error: unknown): string {
  if (error instanceof BridgeProfileValidationError) {
    return error.message
  }

  const code = getBridgeErrorCode(error)

  return (
    (code ? ERROR_MESSAGES[code] : undefined) ??
    'No fue posible completar la operación. Intenta nuevamente.'
  )
}
