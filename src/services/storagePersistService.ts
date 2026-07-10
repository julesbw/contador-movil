export type EstadoPersistencia =
  | 'no-compatible'
  | 'ya-concedida'
  | 'concedida'
  | 'denegada'

let solicitudPersistencia: Promise<EstadoPersistencia> | undefined

async function solicitarPersistencia(): Promise<EstadoPersistencia> {
  if (!navigator.storage?.persist || !navigator.storage.persisted) {
    return 'no-compatible'
  }

  if (await navigator.storage.persisted()) {
    return 'ya-concedida'
  }

  return (await navigator.storage.persist()) ? 'concedida' : 'denegada'
}

export function ensurePersistentStorage(): Promise<EstadoPersistencia> {
  solicitudPersistencia ??= solicitarPersistencia()

  return solicitudPersistencia
}
