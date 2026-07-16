import { db } from './db'
import type { ConfigItem, ConfigKey } from '../models/ConfigItem'

export interface ConfigRepository {
  obtener(key: ConfigKey): Promise<string | undefined>
  guardar(key: ConfigKey, value: string): Promise<void>
  eliminar(key: ConfigKey): Promise<void>
  obtenerTodo(): Promise<ConfigItem[]>
}

export const configRepo: ConfigRepository = {
  async obtener(key) {
    const item = await db.config.get(key)

    return item?.value
  },

  async guardar(key, value) {
    await db.config.put({ key, value })
  },

  async eliminar(key) {
    await db.config.delete(key)
  },

  obtenerTodo() {
    return db.config.toArray()
  },
}
