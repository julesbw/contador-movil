import {
  validateBridgeSnapshotResponse,
  validateBridgeSourceResponse,
  type BridgeSnapshotResponse,
  type BridgeSourceResponse,
} from './bridgeContracts'
import {
  BridgeClientError,
  isBridgeClientError,
  type BridgeClientErrorCode,
} from './bridgeErrors'
import { normalizeBridgeBaseUrl } from './bridgeUrl'

const DEFAULT_TIMEOUT_MS = 5_000

const SOURCE_PATH = '/api/v1/source'
const LATEST_SNAPSHOT_PATH = '/api/v1/snapshots/latest'

const REMOTE_ERROR_CODES_BY_STATUS: Readonly<
  Record<number, readonly BridgeClientErrorCode[]>
> = {
  401: [
    'AUTHORIZATION_REQUIRED',
    'INVALID_TOKEN',
    'REVOKED_TOKEN',
  ],
  403: ['INSUFFICIENT_SCOPE', 'ORIGIN_NOT_ALLOWED'],
  404: ['SNAPSHOT_NOT_FOUND'],
}

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>

export type BridgeRequestOptions = {
  signal?: AbortSignal
}

type ResponseValidator<T> = (value: unknown) => T

type BridgeErrorEnvelope = {
  error: {
    code: string
    message: string
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isBridgeErrorEnvelope(value: unknown): value is BridgeErrorEnvelope {
  if (!isRecord(value) || !isRecord(value.error)) {
    return false
  }

  return (
    typeof value.error.code === 'string' &&
    typeof value.error.message === 'string'
  )
}

function parseJsonResponse(text: string, status: number): unknown {
  if (text.length === 0) {
    if (status >= 500) {
      throw new BridgeClientError('SERVER_ERROR', status)
    }

    throw new BridgeClientError('INVALID_RESPONSE', status)
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    if (status >= 500) {
      throw new BridgeClientError('SERVER_ERROR', status)
    }

    throw new BridgeClientError('INVALID_RESPONSE', status)
  }
}

function mapErrorResponse(status: number, value: unknown): BridgeClientError {
  if (status >= 500) {
    return new BridgeClientError('SERVER_ERROR', status)
  }

  if (isBridgeErrorEnvelope(value)) {
    const allowedCodes = REMOTE_ERROR_CODES_BY_STATUS[status]

    if (
      allowedCodes?.includes(value.error.code as BridgeClientErrorCode)
    ) {
      return new BridgeClientError(
        value.error.code as BridgeClientErrorCode,
        status,
      )
    }
  }

  return new BridgeClientError('INVALID_RESPONSE', status)
}

export class BridgeClient {
  private readonly fetchImplementation: FetchImplementation
  private readonly timeoutMs: number

  constructor(
    fetchImplementation: FetchImplementation = globalThis.fetch,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError('El timeout debe ser mayor a cero')
    }

    this.fetchImplementation = fetchImplementation
    this.timeoutMs = timeoutMs
  }

  obtenerSource(
    baseUrl: string,
    token: string,
    options: BridgeRequestOptions = {},
  ): Promise<BridgeSourceResponse> {
    return this.request(
      baseUrl,
      token,
      SOURCE_PATH,
      validateBridgeSourceResponse,
      options,
    )
  }

  obtenerLatest(
    baseUrl: string,
    token: string,
    options: BridgeRequestOptions = {},
  ): Promise<BridgeSnapshotResponse> {
    return this.request(
      baseUrl,
      token,
      LATEST_SNAPSHOT_PATH,
      validateBridgeSnapshotResponse,
      options,
    )
  }

  private async request<T>(
    baseUrl: string,
    token: string,
    path: string,
    validateResponse: ResponseValidator<T>,
    { signal: externalSignal }: BridgeRequestOptions,
  ): Promise<T> {
    if (externalSignal?.aborted) {
      throw new BridgeClientError('SYNC_CANCELLED')
    }

    const normalizedBaseUrl = normalizeBridgeBaseUrl(baseUrl)
    const requestController = new AbortController()
    let abortReason: 'timeout' | 'external' | undefined

    const handleExternalAbort = () => {
      if (!requestController.signal.aborted) {
        abortReason = 'external'
        requestController.abort()
      }
    }

    externalSignal?.addEventListener('abort', handleExternalAbort, {
      once: true,
    })

    const timeoutId = globalThis.setTimeout(() => {
      if (!requestController.signal.aborted) {
        abortReason = 'timeout'
        requestController.abort()
      }
    }, this.timeoutMs)

    try {
      const response = await this.fetchImplementation(
        `${normalizedBaseUrl}${path}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
          credentials: 'omit',
          cache: 'no-store',
          signal: requestController.signal,
        },
      )
      const responseText = await response.text()
      const responseValue = parseJsonResponse(responseText, response.status)

      if (!response.ok) {
        throw mapErrorResponse(response.status, responseValue)
      }

      return validateResponse(responseValue)
    } catch (error: unknown) {
      if (abortReason === 'timeout') {
        throw new BridgeClientError('BRIDGE_TIMEOUT')
      }

      if (abortReason === 'external' || externalSignal?.aborted) {
        throw new BridgeClientError('SYNC_CANCELLED')
      }

      if (isBridgeClientError(error)) {
        throw error
      }

      if (error instanceof TypeError) {
        throw new BridgeClientError('BRIDGE_UNAVAILABLE')
      }

      throw new BridgeClientError('INVALID_RESPONSE')
    } finally {
      globalThis.clearTimeout(timeoutId)
      externalSignal?.removeEventListener('abort', handleExternalAbort)
    }
  }
}

export const bridgeClient = new BridgeClient()
