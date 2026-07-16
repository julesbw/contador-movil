import { describe, expect, it, vi } from 'vitest'
import { requestPersistentStorage } from './storagePersistService'

describe('requestPersistentStorage', () => {
  it('distingue almacenamiento no compatible, ya concedido y concedido', async () => {
    await expect(requestPersistentStorage(undefined)).resolves.toBe(
      'no-compatible',
    )
    await expect(
      requestPersistentStorage({
        persisted: vi.fn(async () => true),
        persist: vi.fn(async () => false),
      }),
    ).resolves.toBe('ya-concedida')
    await expect(
      requestPersistentStorage({
        persisted: vi.fn(async () => false),
        persist: vi.fn(async () => true),
      }),
    ).resolves.toBe('concedida')
  })

  it('reporta denegación sin convertirla en un error de aplicación', async () => {
    await expect(
      requestPersistentStorage({
        persisted: vi.fn(async () => false),
        persist: vi.fn(async () => false),
      }),
    ).resolves.toBe('denegada')
  })
})
