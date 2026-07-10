import Dexie, { type Table } from 'dexie'
import type { ConfigItem } from '../models/ConfigItem'
import type { Movimiento } from '../models/Movimiento'

class ContadorDatabase extends Dexie {
  movimientos!: Table<Movimiento, string>
  config!: Table<ConfigItem, string>

  constructor() {
    super('contador_movil')

    this.version(1).stores({
      movimientos:
        '&id, fechaMovimiento, tipo, categoria, estadoExportacion, loteExportacionId, creadoEn',
      config: '&key',
    })
  }
}

export const db = new ContadorDatabase()
