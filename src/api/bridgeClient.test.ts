import { afterEach, describe, expect, it, vi } from 'vitest'
import { BridgeClient } from './bridgeClient'
import type {
  BridgeSnapshotResponse,
  BridgeSourceResponse,
} from './bridgeContracts'
import { BridgeClientError } from './bridgeErrors'

const baseUrl = 'https://equipo.tailnet.ts.net'
const token = 'token-de-prueba'

const sourceResponse: BridgeSourceResponse = {
  schema_version: '1.0',
  source_id: 'f07551e5-cfd9-4e01-a113-8a7ee185ecbf',
  source_name: 'Equipo de prueba',
}

const snapshotResponse: BridgeSnapshotResponse = {
  schema_version: '1.0',
  snapshot_id: 'a3740f6d-c468-44c5-8eb8-15a88bc028e7',
  source_id: sourceResponse.source_id,
  source_name: sourceResponse.source_name,
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
}

type FetchImplementation = ConstructorParameters<typeof BridgeClient>[0]

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function createFetch(response: Response): {
  fetchImplementation: FetchImplementation
  mock: ReturnType<typeof vi.fn>
} {
  const mock = vi.fn(() => Promise.resolve(response))

  return {
    fetchImplementation: mock as FetchImplementation,
    mock,
  }
}

async function expectClientError(
  promise: Promise<unknown>,
  code: BridgeClientError['code'],
  status?: number,
): Promise<void> {
  try {
    await promise
    throw new Error('La petición debió ser rechazada')
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(BridgeClientError)
    expect((error as BridgeClientError).code).toBe(code)
    expect((error as BridgeClientError).status).toBe(status)
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('BridgeClient', () => {
  it('consulta source con headers y opciones seguras', async () => {
    const { fetchImplementation, mock } = createFetch(
      jsonResponse(sourceResponse),
    )
    const client = new BridgeClient(fetchImplementation)

    await expect(
      client.obtenerSource(`${baseUrl}/`, token),
    ).resolves.toEqual(sourceResponse)

    expect(mock).toHaveBeenCalledTimes(1)
    expect(mock).toHaveBeenCalledWith(
      `${baseUrl}/api/v1/source`,
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'omit',
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      }),
    )
    expect(String(mock.mock.calls[0]?.[0])).not.toContain(token)
  })

  it('consulta latest y valida su contrato', async () => {
    const { fetchImplementation, mock } = createFetch(
      jsonResponse(snapshotResponse),
    )
    const client = new BridgeClient(fetchImplementation)

    await expect(client.obtenerLatest(baseUrl, token)).resolves.toEqual(
      snapshotResponse,
    )
    expect(mock.mock.calls[0]?.[0]).toBe(
      `${baseUrl}/api/v1/snapshots/latest`,
    )
  })

  it('lee text antes de parsear y nunca depende de response.json', async () => {
    const text = vi.fn(() =>
      Promise.resolve(JSON.stringify(sourceResponse)),
    )
    const json = vi.fn(() => {
      throw new Error('response.json no debe utilizarse')
    })
    const response = {
      ok: true,
      status: 200,
      text,
      json,
    } as unknown as Response
    const { fetchImplementation } = createFetch(response)
    const client = new BridgeClient(fetchImplementation)

    await expect(client.obtenerSource(baseUrl, token)).resolves.toEqual(
      sourceResponse,
    )
    expect(text).toHaveBeenCalledOnce()
    expect(json).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'AUTHORIZATION_REQUIRED'],
    [401, 'INVALID_TOKEN'],
    [401, 'REVOKED_TOKEN'],
    [403, 'INSUFFICIENT_SCOPE'],
    [403, 'ORIGIN_NOT_ALLOWED'],
    [404, 'SNAPSHOT_NOT_FOUND'],
  ] as const)('mapea HTTP %s + %s', async (status, code) => {
    const { fetchImplementation } = createFetch(
      jsonResponse(
        {
          error: {
            code,
            message: 'Mensaje remoto que no debe propagarse',
          },
        },
        status,
      ),
    )
    const client = new BridgeClient(fetchImplementation)

    await expectClientError(
      client.obtenerSource(baseUrl, token),
      code,
      status,
    )
  })

  it.each([500, 503])(
    'mapea HTTP %s a SERVER_ERROR aunque no sea JSON',
    async (status) => {
      const { fetchImplementation } = createFetch(
        new Response('Error interno', { status }),
      )
      const client = new BridgeClient(fetchImplementation)

      await expectClientError(
        client.obtenerSource(baseUrl, token),
        'SERVER_ERROR',
        status,
      )
    },
  )

  it('rechaza envelopes incoherentes sin confiar en el mensaje remoto', async () => {
    const { fetchImplementation } = createFetch(
      jsonResponse(
        {
          error: {
            code: 'INVALID_TOKEN',
            message: `No mostrar ${token}`,
          },
        },
        403,
      ),
    )
    const client = new BridgeClient(fetchImplementation)

    const promise = client.obtenerSource(baseUrl, token)

    await expectClientError(promise, 'INVALID_RESPONSE', 403)
    await promise.catch((error: unknown) => {
      expect((error as Error).message).not.toContain(token)
    })
  })

  it.each([
    [
      'JSON inválido',
      new Response('<html>Error</html>', { status: 200 }),
      200,
    ],
    ['respuesta vacía', new Response(null, { status: 204 }), 204],
    [
      'contrato inválido',
      jsonResponse({ ...sourceResponse, source_id: 'inválido' }),
      undefined,
    ],
  ])(
    'rechaza %s como INVALID_RESPONSE',
    async (_description, response, expectedStatus) => {
      const { fetchImplementation } = createFetch(response)
      const client = new BridgeClient(fetchImplementation)

      await expectClientError(
        client.obtenerSource(baseUrl, token),
        'INVALID_RESPONSE',
        expectedStatus,
      )
    },
  )

  it('distingue una versión de contrato desconocida', async () => {
    const { fetchImplementation } = createFetch(
      jsonResponse({ ...sourceResponse, schema_version: '2.0' }),
    )
    const client = new BridgeClient(fetchImplementation)

    await expectClientError(
      client.obtenerSource(baseUrl, token),
      'UNSUPPORTED_SCHEMA_VERSION',
    )
  })

  it('mapea TypeError de fetch sin filtrar detalles de red', async () => {
    const fetchImplementation = vi.fn(() =>
      Promise.reject(
        new TypeError(`Failed to fetch ${baseUrl}?token=${token}`),
      ),
    ) as FetchImplementation
    const client = new BridgeClient(fetchImplementation)
    const promise = client.obtenerSource(baseUrl, token)

    await expectClientError(promise, 'BRIDGE_UNAVAILABLE')
    await promise.catch((error: unknown) => {
      expect((error as Error).message).not.toContain(baseUrl)
      expect((error as Error).message).not.toContain(token)
    })
  })

  it('cancela por timeout con AbortController', async () => {
    vi.useFakeTimers()
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Abortada', 'AbortError')),
            { once: true },
          )
        }),
    ) as FetchImplementation
    const client = new BridgeClient(fetchImplementation, 5_000)
    const promise = client.obtenerSource(baseUrl, token)
    const assertion = expectClientError(promise, 'BRIDGE_TIMEOUT')

    await vi.advanceTimersByTimeAsync(5_000)
    await assertion
  })

  it('distingue la cancelación externa y no inicia si ya estaba cancelada', async () => {
    const fetchImplementation = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Abortada', 'AbortError')),
            { once: true },
          )
        }),
    ) as FetchImplementation
    const client = new BridgeClient(fetchImplementation)
    const controller = new AbortController()
    const promise = client.obtenerSource(baseUrl, token, {
      signal: controller.signal,
    })

    controller.abort()

    await expectClientError(promise, 'SYNC_CANCELLED')

    const alreadyAborted = new AbortController()
    alreadyAborted.abort()

    await expectClientError(
      client.obtenerSource(baseUrl, token, {
        signal: alreadyAborted.signal,
      }),
      'SYNC_CANCELLED',
    )
    expect(fetchImplementation).toHaveBeenCalledOnce()
  })
})
