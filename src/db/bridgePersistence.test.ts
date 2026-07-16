import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { BridgeProfile } from '../models/BridgeProfile'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import {
  BridgeProfileDesactualizadoError,
  BridgeProfileNoEncontradoError,
  BridgeProfileRelinkRequiredError,
  bridgeProfilesRepo,
} from './bridgeProfilesRepo'
import {
  BridgeProfileIdentidadIncompatibleError,
  BridgeProfileInactivoError,
  cajaSnapshotsRepo,
} from './cajaSnapshotsRepo'
import { configRepo } from './configRepo'
import { db } from './db'

const FECHA_INICIAL = '2026-07-15T12:00:00.000Z'

function crearPerfil(
  id: string,
  cambios: Partial<BridgeProfile> = {},
): BridgeProfile {
  return {
    id,
    name: `Perfil ${id}`,
    baseUrl: `https://${id}.example.ts.net`,
    token: `token-${id}`,
    createdAt: FECHA_INICIAL,
    updatedAt: FECHA_INICIAL,
    ...cambios,
  }
}

function crearSnapshot(
  profileId: string,
  sourceId: string,
  snapshotId = `snapshot-${profileId}`,
): StoredCajaSnapshot {
  return {
    profileId,
    schemaVersion: '1.0',
    snapshotId,
    sourceId,
    sourceName: `Equipo ${profileId}`,
    scope: 'caja',
    generatedAt: '2026-07-15T12:01:00.000Z',
    receivedAt: '2026-07-15T12:01:01.000Z',
    syncedAt: '2026-07-15T12:01:02.000Z',
    billetes: {
      '1000': 1,
      '500': 2,
      '200': 3,
      '100': 4,
      '50': 5,
      '20': -6,
    },
    total: 2730,
  }
}

async function activarPerfil(id: string) {
  await db.config.put({ key: 'active_bridge_profile_id', value: id })
}

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

afterAll(async () => {
  db.close()
  await db.delete()
})

describe('bridgeProfilesRepo', () => {
  it('crea, lista, obtiene, actualiza y verifica perfiles', async () => {
    const primero = crearPerfil('primero')
    const segundo = crearPerfil('segundo', {
      createdAt: '2026-07-15T13:00:00.000Z',
      updatedAt: '2026-07-15T13:00:00.000Z',
    })

    await bridgeProfilesRepo.crear(segundo)
    await bridgeProfilesRepo.crear(primero)

    expect(await bridgeProfilesRepo.listar()).toEqual([primero, segundo])
    expect(await bridgeProfilesRepo.obtener(primero.id)).toEqual(primero)
    expect(await bridgeProfilesRepo.existe(primero.id)).toBe(true)
    expect(await bridgeProfilesRepo.existe('inexistente')).toBe(false)

    await bridgeProfilesRepo.actualizar(primero.id, {
      name: 'Alias actualizado',
      updatedAt: '2026-07-15T14:00:00.000Z',
    })

    expect(await bridgeProfilesRepo.obtener(primero.id)).toMatchObject({
      name: 'Alias actualizado',
      updatedAt: '2026-07-15T14:00:00.000Z',
    })
    await expect(
      bridgeProfilesRepo.actualizar('inexistente', { name: 'Sin perfil' }),
    ).rejects.toBeInstanceOf(BridgeProfileNoEncontradoError)
  })

  it('confirma una identidad inicial sin borrar datos y exige re-vinculación al cambiarla', async () => {
    const profile = crearPerfil('perfil')
    await bridgeProfilesRepo.crear(profile)

    const verified = await bridgeProfilesRepo.confirmarIdentidad(
      profile.id,
      profile.updatedAt,
      { sourceId: 'source-1', sourceName: 'Equipo 1' },
      '2026-07-15T13:00:00.000Z',
      false,
    )

    expect(verified).toMatchObject({
      sourceId: 'source-1',
      sourceName: 'Equipo 1',
      lastVerifiedAt: '2026-07-15T13:00:00.000Z',
      updatedAt: '2026-07-15T13:00:00.000Z',
    })

    await expect(
      bridgeProfilesRepo.confirmarIdentidad(
        profile.id,
        verified.updatedAt,
        { sourceId: 'source-2', sourceName: 'Equipo 2' },
        '2026-07-15T14:00:00.000Z',
        false,
      ),
    ).rejects.toBeInstanceOf(BridgeProfileRelinkRequiredError)
    expect(await bridgeProfilesRepo.obtener(profile.id)).toEqual(verified)
  })

  it('re-vincula identidad y elimina el snapshot anterior atómicamente', async () => {
    const profile = crearPerfil('perfil', {
      sourceId: 'source-anterior',
      sourceName: 'Equipo anterior',
    })
    const snapshot = crearSnapshot(profile.id, 'source-anterior')
    await bridgeProfilesRepo.crear(profile)
    await db.cajaSnapshots.add(snapshot)

    const relinked = await bridgeProfilesRepo.confirmarIdentidad(
      profile.id,
      profile.updatedAt,
      { sourceId: 'source-nuevo', sourceName: 'Equipo nuevo' },
      '2026-07-15T15:00:00.000Z',
      true,
    )

    expect(relinked).toMatchObject({
      sourceId: 'source-nuevo',
      sourceName: 'Equipo nuevo',
      lastVerifiedAt: '2026-07-15T15:00:00.000Z',
      updatedAt: '2026-07-15T15:00:00.000Z',
    })
    expect(await cajaSnapshotsRepo.obtener(profile.id)).toBeUndefined()
  })

  it('no re-vincula con una revisión obsoleta ni borra el snapshot', async () => {
    const profile = crearPerfil('perfil', {
      sourceId: 'source-anterior',
      sourceName: 'Equipo anterior',
    })
    const snapshot = crearSnapshot(profile.id, 'source-anterior')
    await bridgeProfilesRepo.crear(profile)
    await db.cajaSnapshots.add(snapshot)

    await expect(
      bridgeProfilesRepo.confirmarIdentidad(
        profile.id,
        'revision-obsoleta',
        { sourceId: 'source-nuevo', sourceName: 'Equipo nuevo' },
        '2026-07-15T15:00:00.000Z',
        true,
      ),
    ).rejects.toBeInstanceOf(BridgeProfileDesactualizadoError)

    expect(await cajaSnapshotsRepo.obtener(profile.id)).toEqual(snapshot)
    expect(await bridgeProfilesRepo.obtener(profile.id)).toEqual(profile)
  })

  it('revierte la eliminación del snapshot si falla la actualización de identidad', async () => {
    const profile = crearPerfil('perfil', {
      sourceId: 'source-anterior',
      sourceName: 'Equipo anterior',
    })
    const snapshot = crearSnapshot(profile.id, 'source-anterior')
    await bridgeProfilesRepo.crear(profile)
    await db.cajaSnapshots.add(snapshot)

    const failProfileUpdate = () => {
      throw new Error('Fallo inducido al actualizar')
    }
    db.bridgeProfiles.hook('updating', failProfileUpdate)

    try {
      await expect(
        bridgeProfilesRepo.confirmarIdentidad(
          profile.id,
          profile.updatedAt,
          { sourceId: 'source-nuevo', sourceName: 'Equipo nuevo' },
          '2026-07-15T15:00:00.000Z',
          true,
        ),
      ).rejects.toThrow('Fallo inducido al actualizar')
    } finally {
      db.bridgeProfiles.hook('updating').unsubscribe(failProfileUpdate)
    }

    expect(await bridgeProfilesRepo.obtener(profile.id)).toEqual(profile)
    expect(await cajaSnapshotsRepo.obtener(profile.id)).toEqual(snapshot)
  })

  it('elimina perfil, snapshot y configuración activa sin afectar otros datos', async () => {
    const active = crearPerfil('activo', { sourceId: 'source-activo' })
    const other = crearPerfil('otro', { sourceId: 'source-otro' })
    const activeSnapshot = crearSnapshot(active.id, 'source-activo')
    const otherSnapshot = crearSnapshot(other.id, 'source-otro')
    await db.bridgeProfiles.bulkAdd([active, other])
    await db.cajaSnapshots.bulkAdd([activeSnapshot, otherSnapshot])
    await db.config.bulkPut([
      { key: 'dispositivo_id', value: 'dispositivo-1' },
      { key: 'active_bridge_profile_id', value: active.id },
    ])

    await bridgeProfilesRepo.eliminarConDatos(active.id)

    expect(await bridgeProfilesRepo.obtener(active.id)).toBeUndefined()
    expect(await cajaSnapshotsRepo.obtener(active.id)).toBeUndefined()
    expect(
      await db.config.get('active_bridge_profile_id'),
    ).toBeUndefined()
    expect(await bridgeProfilesRepo.obtener(other.id)).toEqual(other)
    expect(await cajaSnapshotsRepo.obtener(other.id)).toEqual(otherSnapshot)
    expect(await db.config.get('dispositivo_id')).toEqual({
      key: 'dispositivo_id',
      value: 'dispositivo-1',
    })
  })

  it('mantiene el perfil activo al eliminar otro perfil', async () => {
    const active = crearPerfil('activo')
    const other = crearPerfil('otro')
    await db.bridgeProfiles.bulkAdd([active, other])
    await activarPerfil(active.id)

    await bridgeProfilesRepo.eliminarConDatos(other.id)

    expect(await db.config.get('active_bridge_profile_id')).toEqual({
      key: 'active_bridge_profile_id',
      value: active.id,
    })
  })

  it('revierte toda la cascada si falla una escritura de la transacción', async () => {
    const profile = crearPerfil('perfil', { sourceId: 'source-1' })
    const snapshot = crearSnapshot(profile.id, 'source-1')
    await bridgeProfilesRepo.crear(profile)
    await db.cajaSnapshots.add(snapshot)
    await activarPerfil(profile.id)

    const failConfigDelete = () => {
      throw new Error('Fallo inducido')
    }
    db.config.hook('deleting', failConfigDelete)

    try {
      await expect(
        bridgeProfilesRepo.eliminarConDatos(profile.id),
      ).rejects.toThrow('Fallo inducido')
    } finally {
      db.config.hook('deleting').unsubscribe(failConfigDelete)
    }

    expect(await bridgeProfilesRepo.obtener(profile.id)).toEqual(profile)
    expect(await cajaSnapshotsRepo.obtener(profile.id)).toEqual(snapshot)
    expect(await db.config.get('active_bridge_profile_id')).toEqual({
      key: 'active_bridge_profile_id',
      value: profile.id,
    })
  })
})

describe('configRepo', () => {
  it('elimina una configuración sin afectar las demás', async () => {
    await configRepo.guardar('capturado_por', 'Julio')
    await configRepo.guardar('active_bridge_profile_id', 'perfil')

    await configRepo.eliminar('active_bridge_profile_id')

    expect(
      await configRepo.obtener('active_bridge_profile_id'),
    ).toBeUndefined()
    expect(await configRepo.obtener('capturado_por')).toBe('Julio')
  })
})

describe('cajaSnapshotsRepo', () => {
  it('conserva un snapshot independiente por perfil y reemplaza solo el propio', async () => {
    const first = crearPerfil('primero', { sourceId: 'source-1' })
    const second = crearPerfil('segundo', { sourceId: 'source-2' })
    await db.bridgeProfiles.bulkAdd([first, second])

    await activarPerfil(first.id)
    await cajaSnapshotsRepo.guardarSiPerfilVigente(
      crearSnapshot(first.id, 'source-1', 'snapshot-1'),
      first.updatedAt,
    )
    await activarPerfil(second.id)
    const secondSnapshot = crearSnapshot(
      second.id,
      'source-2',
      'snapshot-2',
    )
    await cajaSnapshotsRepo.guardarSiPerfilVigente(
      secondSnapshot,
      second.updatedAt,
    )
    await activarPerfil(first.id)
    const replacement = crearSnapshot(
      first.id,
      'source-1',
      'snapshot-1-nuevo',
    )
    await cajaSnapshotsRepo.guardarSiPerfilVigente(
      replacement,
      first.updatedAt,
    )

    expect(await cajaSnapshotsRepo.obtener(first.id)).toEqual(replacement)
    expect(await cajaSnapshotsRepo.obtener(second.id)).toEqual(
      secondSnapshot,
    )
    expect(await db.cajaSnapshots.count()).toBe(2)
  })

  it('conserva el snapshot previo si la revisión del perfil cambió', async () => {
    const profile = crearPerfil('perfil', { sourceId: 'source-1' })
    const previous = crearSnapshot(profile.id, 'source-1', 'anterior')
    await bridgeProfilesRepo.crear(profile)
    await db.cajaSnapshots.add(previous)
    await activarPerfil(profile.id)

    await expect(
      cajaSnapshotsRepo.guardarSiPerfilVigente(
        crearSnapshot(profile.id, 'source-1', 'nuevo'),
        'revision-obsoleta',
      ),
    ).rejects.toBeInstanceOf(BridgeProfileDesactualizadoError)

    expect(await cajaSnapshotsRepo.obtener(profile.id)).toEqual(previous)
  })

  it('rechaza guardar para un perfil inexistente, inactivo o con identidad distinta', async () => {
    const profile = crearPerfil('perfil', { sourceId: 'source-1' })
    const other = crearPerfil('otro', { sourceId: 'source-2' })
    await db.bridgeProfiles.bulkAdd([profile, other])
    await activarPerfil(other.id)

    await expect(
      cajaSnapshotsRepo.guardarSiPerfilVigente(
        crearSnapshot('inexistente', 'source-1'),
        FECHA_INICIAL,
      ),
    ).rejects.toBeInstanceOf(BridgeProfileNoEncontradoError)
    await expect(
      cajaSnapshotsRepo.guardarSiPerfilVigente(
        crearSnapshot(profile.id, 'source-1'),
        profile.updatedAt,
      ),
    ).rejects.toBeInstanceOf(BridgeProfileInactivoError)

    await activarPerfil(profile.id)
    await expect(
      cajaSnapshotsRepo.guardarSiPerfilVigente(
        crearSnapshot(profile.id, 'source-distinto'),
        profile.updatedAt,
      ),
    ).rejects.toBeInstanceOf(
      BridgeProfileIdentidadIncompatibleError,
    )
    expect(await db.cajaSnapshots.count()).toBe(0)
  })

  it('elimina únicamente el snapshot indicado', async () => {
    const first = crearSnapshot('primero', 'source-1')
    const second = crearSnapshot('segundo', 'source-2')
    await db.cajaSnapshots.bulkAdd([first, second])

    await cajaSnapshotsRepo.eliminar(first.profileId)

    expect(await cajaSnapshotsRepo.obtener(first.profileId)).toBeUndefined()
    expect(await cajaSnapshotsRepo.obtener(second.profileId)).toEqual(second)
  })
})
