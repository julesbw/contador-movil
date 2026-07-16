export type CajaSyncState =
  | { status: 'idle'; message?: string }
  | { status: 'loading'; hasSnapshot: boolean }
  | { status: 'success'; message?: string }
  | { status: 'error'; message: string; hasSnapshot: boolean }
  | { status: 'mismatch'; message?: string; hasSnapshot: boolean }

type CajaSyncStatusProps = {
  state: CajaSyncState
}

export function CajaSyncStatus({ state }: CajaSyncStatusProps) {
  if (state.status === 'loading') {
    return (
      <div
        aria-live="polite"
        className="rounded-xl bg-teal-50 p-4 text-sm text-teal-900"
        role="status"
      >
        <p className="font-semibold">Sincronizando con esta computadora…</p>
        {state.hasSnapshot && (
          <p className="mt-1">
            El último dato disponible permanece visible mientras termina la
            sincronización.
          </p>
        )}
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
        role="alert"
      >
        <p className="font-semibold">No fue posible sincronizar</p>
        <p className="mt-1">{state.message}</p>
        {state.hasSnapshot && (
          <p className="mt-2 font-medium">Mostrando el último dato disponible.</p>
        )}
      </div>
    )
  }

  if (state.status === 'mismatch') {
    return (
      <div
        className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"
        role="alert"
      >
        <p className="font-semibold">La identidad no coincide</p>
        <p className="mt-1">
          {state.message ??
            'La URL corresponde a otra computadora. Revisa el perfil antes de continuar.'}
        </p>
        {state.hasSnapshot && (
          <p className="mt-2 font-medium">
            El dato nuevo fue bloqueado. Mostrando el último dato disponible.
          </p>
        )}
      </div>
    )
  }

  return (
    <div
      aria-live="polite"
      className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"
      role="status"
    >
      {state.status === 'success'
        ? (state.message ?? 'Sincronización completada.')
        : (state.message ?? 'Listo para sincronizar.')}
    </div>
  )
}
