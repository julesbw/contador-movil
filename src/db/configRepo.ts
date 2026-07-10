import { db } from './db'
import type { ConfigItem, ConfigKey } from '../models/ConfigItem'

export interface ConfigRepository {
  obtener(key: ConfigKey): Promise<string | undefined>
  guardar(key: ConfigKey, value: string): Promise<void>
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

  obtenerTodo() {
    return db.config.toArray()
  },
}
