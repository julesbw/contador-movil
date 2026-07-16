import type { EstadoPersistencia } from '../services/storagePersistService'

type StoragePersistenceWarningProps = {
  state: EstadoPersistencia | undefined
}

export function StoragePersistenceWarning({
  state,
}: StoragePersistenceWarningProps) {
  if (state !== 'denegada' && state !== 'no-compatible') {
    return null
  }

  return (
    <p
      className="mt-4 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900"
      role="alert"
    >
      El navegador no confirmó almacenamiento persistente. Los datos siguen
      guardados localmente, pero podrían eliminarse bajo presión de
      almacenamiento. Instalar la PWA ayuda a reducir ese riesgo.
    </p>
  )
}
