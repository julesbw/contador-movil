export const CONFIG_KEYS = ['dispositivo_id', 'capturado_por'] as const

export type ConfigKey = (typeof CONFIG_KEYS)[number]

export type ConfigItem = {
  key: ConfigKey
  value: string
}
