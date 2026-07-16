import Dexie, { type Table } from 'dexie'
import type { BridgeProfile } from '../models/BridgeProfile'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import type { ConfigItem } from '../models/ConfigItem'
import type { Movimiento } from '../models/Movimiento'

const MOVIMIENTOS_SCHEMA =
  '&id, fechaMovimiento, tipo, categoria, estadoExportacion, loteExportacionId, creadoEn'

export const CONTADOR_DATABASE_NAME = 'contador_movil'

export class ContadorDatabase extends Dexie {
  movimientos!: Table<Movimiento, string>
  config!: Table<ConfigItem, string>
  bridgeProfiles!: Table<BridgeProfile, string>
  cajaSnapshots!: Table<StoredCajaSnapshot, string>

  constructor(databaseName = CONTADOR_DATABASE_NAME) {
    super(databaseName)

    this.version(1).stores({
      movimientos: MOVIMIENTOS_SCHEMA,
      config: '&key',
    })

    this.version(2).stores({
      movimientos: MOVIMIENTOS_SCHEMA,
      config: '&key',
      bridgeProfiles: '&id, sourceId, createdAt, updatedAt',
      cajaSnapshots:
        '&profileId, snapshotId, sourceId, generatedAt, syncedAt',
    })
  }
}

export const db = new ContadorDatabase()
