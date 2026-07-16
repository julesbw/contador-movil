import type { StoredCajaSnapshot } from '../models/CajaSnapshot'

const formatoMoneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

const formatoFecha = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'medium',
})

type CajaSummaryProps = {
  profileName: string
  snapshot: StoredCajaSnapshot
  warnings?: readonly string[]
}

function formatDate(value: string): string {
  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? value : formatoFecha.format(date)
}

export function CajaSummary({
  profileName,
  snapshot,
  warnings = [],
}: CajaSummaryProps) {
  return (
    <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">Computadora</p>
          <h3 className="mt-1 break-words text-lg font-semibold text-slate-950">
            {profileName}
          </h3>
          <p className="mt-1 break-words text-sm text-slate-600">
            Identidad del bridge: {snapshot.sourceName}
          </p>
        </div>

        <div className="shrink-0 sm:text-right">
          <p className="text-sm font-medium text-slate-500">Total en Caja</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-slate-950">
            {formatoMoneda.format(snapshot.total)}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-medium text-slate-700">Generado en Excel</dt>
          <dd className="mt-1 text-slate-600">
            <time dateTime={snapshot.generatedAt}>
              {formatDate(snapshot.generatedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">
            Recibido por el bridge
          </dt>
          <dd className="mt-1 text-slate-600">
            <time dateTime={snapshot.receivedAt}>
              {formatDate(snapshot.receivedAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt className="font-medium text-slate-700">
            Sincronizado en este dispositivo
          </dt>
          <dd className="mt-1 text-slate-600">
            <time dateTime={snapshot.syncedAt}>
              {formatDate(snapshot.syncedAt)}
            </time>
          </dd>
        </div>
      </dl>

      {warnings.length > 0 && (
        <div
          aria-label="Advertencias del snapshot"
          className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          role="alert"
        >
          <p className="font-semibold">Revisa las fechas de este dato</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
