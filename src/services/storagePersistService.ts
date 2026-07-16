export type EstadoPersistencia =
  | 'no-compatible'
  | 'ya-concedida'
  | 'concedida'
  | 'denegada'

let solicitudPersistencia: Promise<EstadoPersistencia> | undefined

type StorageManagerPort = Pick<StorageManager, 'persist' | 'persisted'>

export async function requestPersistentStorage(
  storage: StorageManagerPort | undefined,
): Promise<EstadoPersistencia> {
  if (!storage?.persist || !storage.persisted) {
    return 'no-compatible'
  }

  if (await storage.persisted()) {
    return 'ya-concedida'
  }

  return (await storage.persist()) ? 'concedida' : 'denegada'
}

export function ensurePersistentStorage(): Promise<EstadoPersistencia> {
  solicitudPersistencia ??= requestPersistentStorage(
    navigator.storage,
  ).catch(() => 'denegada')

  return solicitudPersistencia
}
