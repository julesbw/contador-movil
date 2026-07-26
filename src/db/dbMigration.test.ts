import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { expect, it } from 'vitest'
import type { BridgeProfile } from '../models/BridgeProfile'
import type { CashCut } from '../models/CashCut'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import type { ConfigItem } from '../models/ConfigItem'
import type { Movimiento } from '../models/Movimiento'
import { ContadorDatabase } from './db'

const LEGACY_MOVIMIENTOS_SCHEMA =
  '&id, fechaMovimiento, tipo, categoria, estadoExportacion, loteExportacionId, creadoEn'
const LEGACY_BRIDGE_PROFILES_SCHEMA =
  '&id, sourceId, createdAt, updatedAt'
const LEGACY_CAJA_SNAPSHOTS_SCHEMA =
  '&profileId, snapshotId, sourceId, generatedAt, syncedAt'

function crearMovimiento(): Movimiento {
  return {
    id: 'movimiento-existente',
    tipo: 'salida',
    fechaMovimiento: '2026-07-15',
    monto: 100,
    concepto: 'Movimiento previo',
    categoria: 'Otros',
    formaPago: 'efectivo',
    billetes: {
      b1000: 0,
      b500: 0,
      b200: 0,
      b100: 1,
      b50: 0,
      b20: 0,
      monedas: 0,
    },
    estadoExportacion: 'pendiente',
    creadoEn: '2026-07-15T12:00:00.000Z',
    actualizadoEn: '2026-07-15T12:00:00.000Z',
  }
}

function crearPerfil(): BridgeProfile {
  return {
    id: 'perfil-1',
    name: 'Caja principal',
    baseUrl: 'https://equipo.example.ts.net',
    token: 'token-secreto',
    sourceId: 'source-1',
    sourceName: 'Equipo principal',
    createdAt: '2026-07-15T13:00:00.000Z',
    updatedAt: '2026-07-15T13:00:00.000Z',
    lastVerifiedAt: '2026-07-15T13:00:00.000Z',
  }
}

function crearSnapshot(): StoredCajaSnapshot {
  return {
    profileId: 'perfil-1',
    schemaVersion: '1.0',
    snapshotId: 'snapshot-1',
    sourceId: 'source-1',
    sourceName: 'Equipo principal',
    scope: 'caja',
    generatedAt: '2026-07-15T13:01:00.000Z',
    receivedAt: '2026-07-15T13:01:01.000Z',
    syncedAt: '2026-07-15T13:01:02.000Z',
    billetes: {
      '1000': 1,
      '500': 2,
      '200': 3,
      '100': 4,
      '50': 5,
      '20': 6,
    },
    total: 2970,
  }
}

function crearCorte(): CashCut {
  const breakdown = {
    b1000: 0,
    b500: 0,
    b200: 0,
    b100: 1,
    b50: 0,
    b20: 0,
    monedas: 0.5,
  }

  return {
    id: 'corte-1',
    date: '2026-07-15T14:00:00.000Z',
    concept: 'Corte de migración',
    storeId: 'tienda-1',
    storeName: 'Tienda 1',
    countedBreakdown: breakdown,
    countedAmount: 100.5,
    fundBreakdown: {
      ...breakdown,
      b100: 0,
      monedas: 0,
    },
    fundAmount: 0,
    withdrawnBreakdown: breakdown,
    withdrawnAmount: 100.5,
    status: 'pending',
    createdAt: '2026-07-15T14:01:00.000Z',
    updatedAt: '2026-07-15T14:01:00.000Z',
  }
}

it('migra de v1 a v3 conservando datos y persiste las tablas nuevas', async () => {
  const databaseName = `contador_movil_migration_${crypto.randomUUID()}`
  const movimiento = crearMovimiento()
  const legacyConfig: ConfigItem[] = [
    { key: 'dispositivo_id', value: 'dispositivo-existente' },
    { key: 'capturado_por', value: 'Operador de prueba' },
  ]
  const legacyDatabase = new Dexie(databaseName)
  let upgradedDatabase: ContadorDatabase | undefined
  let reopenedDatabase: ContadorDatabase | undefined

  try {
    legacyDatabase.version(1).stores({
      movimientos: LEGACY_MOVIMIENTOS_SCHEMA,
      config: '&key',
    })
    await legacyDatabase.open()
    await legacyDatabase
      .table<Movimiento, string>('movimientos')
      .add(movimiento)
    await legacyDatabase
      .table<ConfigItem, string>('config')
      .bulkAdd(legacyConfig)
    legacyDatabase.close()

    upgradedDatabase = new ContadorDatabase(databaseName)
    await upgradedDatabase.open()

    expect(upgradedDatabase.verno).toBe(3)
    expect(await upgradedDatabase.movimientos.get(movimiento.id)).toEqual(
      movimiento,
    )
    expect(
      await upgradedDatabase.config.bulkGet(
        legacyConfig.map(({ key }) => key),
      ),
    ).toEqual(legacyConfig)
    expect(upgradedDatabase.tables.map(({ name }) => name).sort()).toEqual([
      'bridgeProfiles',
      'cajaSnapshots',
      'cashCuts',
      'config',
      'movimientos',
    ])
    expect(
      upgradedDatabase.movimientos.schema.indexes.map(({ name }) => name),
    ).toEqual([
      'fechaMovimiento',
      'tipo',
      'categoria',
      'estadoExportacion',
      'loteExportacionId',
      'creadoEn',
    ])
    expect(
      upgradedDatabase.cashCuts.schema.indexes.map(({ name }) => name),
    ).toEqual([
      'date',
      'status',
      'movementId',
      'storeId',
      'createdAt',
    ])

    const profile = crearPerfil()
    const snapshot = crearSnapshot()
    const cashCut = crearCorte()

    await upgradedDatabase.bridgeProfiles.add(profile)
    await upgradedDatabase.cajaSnapshots.add(snapshot)
    await upgradedDatabase.cashCuts.add(cashCut)
    upgradedDatabase.close()

    reopenedDatabase = new ContadorDatabase(databaseName)
    await reopenedDatabase.open()

    expect(await reopenedDatabase.movimientos.get(movimiento.id)).toEqual(
      movimiento,
    )
    expect(
      await reopenedDatabase.config.bulkGet(
        legacyConfig.map(({ key }) => key),
      ),
    ).toEqual(legacyConfig)
    expect(await reopenedDatabase.bridgeProfiles.get(profile.id)).toEqual(
      profile,
    )
    expect(
      await reopenedDatabase.cajaSnapshots.get(snapshot.profileId),
    ).toEqual(snapshot)
    expect(await reopenedDatabase.cashCuts.get(cashCut.id)).toEqual(
      cashCut,
    )
  } finally {
    legacyDatabase.close()
    upgradedDatabase?.close()
    reopenedDatabase?.close()
    await Dexie.delete(databaseName)
  }
})

it('migra de v2 a v3 conservando movimientos, configuración y datos de bridge', async () => {
  const databaseName = `contador_movil_migration_${crypto.randomUUID()}`
  const movimiento = crearMovimiento()
  const profile = crearPerfil()
  const snapshot = crearSnapshot()
  const config: ConfigItem = {
    key: 'dispositivo_id',
    value: 'dispositivo-v2',
  }
  const legacyDatabase = new Dexie(databaseName)
  let upgradedDatabase: ContadorDatabase | undefined

  try {
    legacyDatabase.version(2).stores({
      movimientos: LEGACY_MOVIMIENTOS_SCHEMA,
      config: '&key',
      bridgeProfiles: LEGACY_BRIDGE_PROFILES_SCHEMA,
      cajaSnapshots: LEGACY_CAJA_SNAPSHOTS_SCHEMA,
    })
    await legacyDatabase.open()
    await legacyDatabase
      .table<Movimiento, string>('movimientos')
      .add(movimiento)
    await legacyDatabase.table<ConfigItem, string>('config').add(config)
    await legacyDatabase
      .table<BridgeProfile, string>('bridgeProfiles')
      .add(profile)
    await legacyDatabase
      .table<StoredCajaSnapshot, string>('cajaSnapshots')
      .add(snapshot)
    legacyDatabase.close()

    upgradedDatabase = new ContadorDatabase(databaseName)
    await upgradedDatabase.open()

    expect(upgradedDatabase.verno).toBe(3)
    expect(await upgradedDatabase.movimientos.get(movimiento.id)).toEqual(
      movimiento,
    )
    expect(await upgradedDatabase.config.get(config.key)).toEqual(config)
    expect(await upgradedDatabase.bridgeProfiles.get(profile.id)).toEqual(
      profile,
    )
    expect(
      await upgradedDatabase.cajaSnapshots.get(snapshot.profileId),
    ).toEqual(snapshot)
    expect(await upgradedDatabase.cashCuts.count()).toBe(0)
  } finally {
    legacyDatabase.close()
    upgradedDatabase?.close()
    await Dexie.delete(databaseName)
  }
})
