import { describe, expect, it, vi } from 'vitest'
import type { BridgeSourceResponse } from '../api/bridgeContracts'
import type { BridgeProfile } from '../models/BridgeProfile'
import type { BridgeProfileService } from './bridgeProfileService'
import type { CajaSyncService } from './cajaSyncService'
import {
  BridgeRelinkCompletionError,
  relinkAndSynchronizeBridgeProfile,
} from './bridgeRelinkService'

const profile: BridgeProfile = {
  id: 'profile-1',
  name: 'Caja principal',
  baseUrl: 'https://equipo.example.ts.net',
  token: 'secret-token',
  sourceId: '00000000-0000-4000-8000-000000000001',
  sourceName: 'Equipo anterior',
  createdAt: '2026-07-16T12:00:00.000Z',
  updatedAt: '2026-07-16T12:00:00.000Z',
}

const source: BridgeSourceResponse = {
  schema_version: '1.0',
  source_id: '00000000-0000-4000-8000-000000000002',
  source_name: 'Equipo nuevo',
}

function createDependencies(syncError?: unknown) {
  const updated = {
    ...profile,
    sourceId: source.source_id,
    sourceName: source.source_name,
    updatedAt: '2026-07-16T13:00:00.000Z',
  }
  const revincular = vi.fn(() => Promise.resolve(updated))
  const seleccionarActivo = vi.fn(() => Promise.resolve())
  const sincronizar = vi.fn(() =>
    syncError ? Promise.reject(syncError) : Promise.resolve({}),
  )

  return {
    updated,
    profileService: {
      revincular,
      seleccionarActivo,
    } as unknown as BridgeProfileService,
    syncService: { sincronizar } as unknown as CajaSyncService,
    revincular,
    seleccionarActivo,
    sincronizar,
  }
}

describe('relinkAndSynchronizeBridgeProfile', () => {
  it('re-vincula, selecciona el perfil y sincroniza con la señal recibida', async () => {
    const dependencies = createDependencies()
    const controller = new AbortController()

    await expect(
      relinkAndSynchronizeBridgeProfile(
        dependencies.profileService,
        dependencies.syncService,
        { profile, source, signal: controller.signal },
      ),
    ).resolves.toEqual(dependencies.updated)

    expect(dependencies.revincular).toHaveBeenCalledWith(
      profile.id,
      profile.updatedAt,
      source,
    )
    expect(dependencies.seleccionarActivo).toHaveBeenCalledWith(profile.id)
    expect(dependencies.sincronizar).toHaveBeenCalledWith(profile.id, {
      signal: controller.signal,
    })
    expect(dependencies.revincular.mock.invocationCallOrder[0]).toBeLessThan(
      dependencies.seleccionarActivo.mock.invocationCallOrder[0] ?? 0,
    )
    expect(
      dependencies.seleccionarActivo.mock.invocationCallOrder[0],
    ).toBeLessThan(dependencies.sincronizar.mock.invocationCallOrder[0] ?? 0)
  })

  it('distingue un fallo posterior de una re-vinculación ya persistida', async () => {
    const syncError = new Error('fallo de red que no debe mostrarse directamente')
    const dependencies = createDependencies(syncError)

    try {
      await relinkAndSynchronizeBridgeProfile(
        dependencies.profileService,
        dependencies.syncService,
        { profile, source },
      )
      throw new Error('La operación debió fallar')
    } catch (error) {
      expect(error).toBeInstanceOf(BridgeRelinkCompletionError)
      expect((error as BridgeRelinkCompletionError).profile).toEqual(
        dependencies.updated,
      )
      expect((error as BridgeRelinkCompletionError).stage).toBe('sync')
      expect((error as BridgeRelinkCompletionError).cause).toBe(syncError)
    }
  })
})
