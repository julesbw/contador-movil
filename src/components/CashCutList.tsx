import type { CashCut, CashCutStatus } from '../models/CashCut'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  currency: 'MXN',
  maximumFractionDigits: 2,
  style: 'currency',
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatDateTime(value: string): string {
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? value
    : dateTimeFormatter.format(parsed)
}

export type CashCutFilter = CashCutStatus

type CashCutListProps = {
  cuts: CashCut[]
  filter: CashCutFilter
  selectedIds: string[]
  loading?: boolean
  busyCutId?: string
  onFilterChange: (filter: CashCutFilter) => void
  onSelectionChange: (cut: CashCut) => void
  onView: (cut: CashCut) => void
  onEdit: (cut: CashCut) => void
  onDelete: (cut: CashCut) => void
  onViewMovement: (movementId: string) => void
}

export function CashCutList({
  cuts,
  filter,
  selectedIds,
  loading = false,
  busyCutId,
  onFilterChange,
  onSelectionChange,
  onView,
  onEdit,
  onDelete,
  onViewMovement,
}: CashCutListProps) {
  const deletionInProgress = busyCutId !== undefined

  return (
    <>
      <div
        aria-label="Filtrar cortes"
        className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1"
        role="group"
      >
        <button
          aria-pressed={filter === 'pending'}
          className={
            filter === 'pending'
              ? 'min-h-11 rounded-lg bg-white px-3 text-sm font-semibold text-teal-800 shadow-sm'
              : 'min-h-11 rounded-lg px-3 text-sm font-semibold text-slate-600'
          }
          disabled={deletionInProgress}
          type="button"
          onClick={() => onFilterChange('pending')}
        >
          Pendientes
        </button>
        <button
          aria-pressed={filter === 'included'}
          className={
            filter === 'included'
              ? 'min-h-11 rounded-lg bg-white px-3 text-sm font-semibold text-teal-800 shadow-sm'
              : 'min-h-11 rounded-lg px-3 text-sm font-semibold text-slate-600'
          }
          disabled={deletionInProgress}
          type="button"
          onClick={() => onFilterChange('included')}
        >
          Incluidos
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {loading && (
          <p aria-live="polite" className="py-8 text-center text-slate-500">
            Cargando cortes…
          </p>
        )}

        {!loading && cuts.length === 0 && (
          <p className="rounded-2xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">
            {filter === 'pending'
              ? 'No hay cortes pendientes.'
              : 'No hay cortes incluidos.'}
          </p>
        )}

        {cuts.map((cut) => {
          const isPending = cut.status === 'pending'
          const isCurrentDeletion = busyCutId === cut.id
          const movementId = cut.movementId

          return (
            <article
              className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
              key={cut.id}
            >
              <div className="flex items-start gap-3">
                {isPending && (
                  <label className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-slate-50">
                    <span className="sr-only">
                      Seleccionar {cut.concept}
                    </span>
                    <input
                      checked={selectedIds.includes(cut.id)}
                      className="size-5 accent-teal-700"
                      disabled={deletionInProgress}
                      type="checkbox"
                      onChange={() => onSelectionChange(cut)}
                    />
                  </label>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-slate-950">
                        {cut.concept}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        <time dateTime={cut.date}>
                          {formatDateTime(cut.date)}
                        </time>
                        {cut.storeName ? ` · ${cut.storeName}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums text-slate-950">
                      {currencyFormatter.format(cut.withdrawnAmount)}
                    </p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span
                      className={
                        isPending
                          ? 'badge bg-amber-100 text-amber-800'
                          : 'badge bg-emerald-100 text-emerald-800'
                      }
                    >
                      {isPending ? 'Pendiente' : 'Incluido'}
                    </span>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className="button-secondary min-h-11"
                        disabled={deletionInProgress}
                        type="button"
                        onClick={() => onView(cut)}
                      >
                        Ver detalle
                      </button>

                      {isPending ? (
                        <>
                          <button
                            className="button-secondary min-h-11"
                            disabled={deletionInProgress}
                            type="button"
                            onClick={() => onEdit(cut)}
                          >
                            Editar
                          </button>
                          <button
                            className="min-h-11 rounded-xl px-4 text-sm font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                            disabled={deletionInProgress}
                            type="button"
                            onClick={() => onDelete(cut)}
                          >
                            {isCurrentDeletion
                              ? 'Eliminando…'
                              : 'Eliminar'}
                          </button>
                        </>
                      ) : (
                        movementId && (
                          <button
                            className="button-secondary min-h-11"
                            disabled={deletionInProgress}
                            type="button"
                            onClick={() => onViewMovement(movementId)}
                          >
                            Ver movimiento
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
