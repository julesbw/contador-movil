export const BRIDGE_URL_ERROR_CODES = [
  'URL_REQUIRED',
  'URL_INVALID',
  'HTTPS_REQUIRED',
  'CREDENTIALS_NOT_ALLOWED',
  'QUERY_NOT_ALLOWED',
  'FRAGMENT_NOT_ALLOWED',
  'PATH_NOT_ALLOWED',
  'LOOPBACK_NOT_ALLOWED',
  'DIRECT_BRIDGE_PORT_NOT_ALLOWED',
] as const

export type BridgeUrlErrorCode = (typeof BRIDGE_URL_ERROR_CODES)[number]

const URL_ERROR_MESSAGES: Record<BridgeUrlErrorCode, string> = {
  URL_REQUIRED: 'La URL privada es obligatoria.',
  URL_INVALID: 'La URL privada no es válida.',
  HTTPS_REQUIRED: 'La URL privada debe usar HTTPS.',
  CREDENTIALS_NOT_ALLOWED: 'La URL privada no debe incluir credenciales.',
  QUERY_NOT_ALLOWED: 'La URL privada no debe incluir parámetros.',
  FRAGMENT_NOT_ALLOWED: 'La URL privada no debe incluir fragmentos.',
  PATH_NOT_ALLOWED: 'La URL privada debe contener únicamente el origen.',
  LOOPBACK_NOT_ALLOWED: 'La URL privada no puede apuntar a este dispositivo.',
  DIRECT_BRIDGE_PORT_NOT_ALLOWED:
    'La URL privada debe usar Tailscale Serve, no el puerto directo del bridge.',
}

export class BridgeUrlValidationError extends Error {
  readonly code: BridgeUrlErrorCode

  constructor(code: BridgeUrlErrorCode) {
    super(URL_ERROR_MESSAGES[code])
    this.name = 'BridgeUrlValidationError'
    this.code = code
  }
}

function normalizedHostname(url: URL): string {
  return url.hostname
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '')
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    return true
  }

  if (/^127(?:\.\d{1,3}){3}$/.test(hostname)) {
    return true
  }

  return (
    hostname === '::1' ||
    hostname === '0:0:0:0:0:0:0:1' ||
    /^::(?:ffff:)?7f[0-9a-f]{2}:/.test(hostname)
  )
}

export function normalizeBridgeBaseUrl(value: string): string {
  const trimmedValue = value.trim()

  if (trimmedValue.length === 0) {
    throw new BridgeUrlValidationError('URL_REQUIRED')
  }

  let url: URL

  try {
    url = new URL(trimmedValue)
  } catch {
    throw new BridgeUrlValidationError('URL_INVALID')
  }

  if (url.protocol !== 'https:') {
    throw new BridgeUrlValidationError('HTTPS_REQUIRED')
  }

  const schemeSeparatorIndex = trimmedValue.indexOf('://')

  if (schemeSeparatorIndex === -1) {
    throw new BridgeUrlValidationError('URL_INVALID')
  }

  if (trimmedValue.includes('?')) {
    throw new BridgeUrlValidationError('QUERY_NOT_ALLOWED')
  }

  if (trimmedValue.includes('#')) {
    throw new BridgeUrlValidationError('FRAGMENT_NOT_ALLOWED')
  }

  const originInput = trimmedValue.slice(schemeSeparatorIndex + 3)
  const pathStart = originInput.indexOf('/')
  const authority =
    pathStart === -1 ? originInput : originInput.slice(0, pathStart)
  const path = pathStart === -1 ? '' : originInput.slice(pathStart)

  if (
    url.username.length > 0 ||
    url.password.length > 0 ||
    authority.includes('@')
  ) {
    throw new BridgeUrlValidationError('CREDENTIALS_NOT_ALLOWED')
  }

  if (path !== '' && path !== '/') {
    throw new BridgeUrlValidationError('PATH_NOT_ALLOWED')
  }

  if (url.port === '8766') {
    throw new BridgeUrlValidationError('DIRECT_BRIDGE_PORT_NOT_ALLOWED')
  }

  if (isLoopbackHostname(normalizedHostname(url))) {
    throw new BridgeUrlValidationError('LOOPBACK_NOT_ALLOWED')
  }

  return url.origin
}
