import type { CashCut } from '../models/CashCut'
import { CashCounter } from './CashCounter'
import { CashCutAmountsSummary } from './CashCutAmountsSummary'

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'long',
  timeStyle: 'short',
})

type CashCutDetailProps = {
  cut: CashCut
  onClose: () => void
  onEdit?: (cut: CashCut) => void
  onViewMovement?: (movementId: string) => void
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? value
    : dateTimeFormatter.format(parsed)
}

export function CashCutDetail({
  cut,
  onClose,
  onEdit,
  onViewMovement,
}: CashCutDetailProps) {
  const isPending = cut.status === 'pending'
  const movementId = cut.movementId

  return (
    <section aria-labelledby="cash-cut-detail-heading">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
            Detalle del corte
          </p>
          <h2
            className="mt-1 text-2xl font-bold text-slate-950"
            id="cash-cut-detail-heading"
          >
            {cut.concept}
          </h2>
        </div>
        <span
          className={
            isPending
              ? 'badge bg-amber-100 text-amber-800'
              : 'badge bg-emerald-100 text-emerald-800'
          }
        >
          {isPending ? 'Pendiente' : 'Incluido'}
        </span>
      </div>

      <dl className="mt-6 grid gap-4 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:grid-cols-2">
        <div>
          <dt className="text-sm font-medium text-slate-500">Fecha y hora</dt>
          <dd className="mt-1 text-slate-900">
            <time dateTime={cut.date}>{formatDateTime(cut.date)}</time>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Tienda</dt>
          <dd className="mt-1 text-slate-900">
            {cut.storeName || 'Sin tienda'}
          </dd>
        </div>
        {cut.notes && (
          <div className="sm:col-span-2">
            <dt className="text-sm font-medium text-slate-500">Notas</dt>
            <dd className="mt-1 whitespace-pre-wrap text-slate-900">
              {cut.notes}
            </dd>
          </div>
        )}
      </dl>

      <div className="mt-5">
        <CashCutAmountsSummary
          countedAmount={cut.countedAmount}
          fundAmount={cut.fundAmount}
          withdrawnAmount={cut.withdrawnAmount}
        />
      </div>

      <details className="mt-5 rounded-2xl bg-white ring-1 ring-slate-200">
        <summary className="min-h-11 cursor-pointer px-5 py-3 font-semibold text-slate-900">
          Ver desgloses
        </summary>
        <div className="space-y-5 border-t border-slate-200 p-4 sm:p-5">
          <CashCounter
            readOnly
            showTotal
            legend="Efectivo contado"
            totalLabel="Total contado"
            value={cut.countedBreakdown}
          />
          <CashCounter
            readOnly
            showTotal
            legend="Fondo de caja"
            totalLabel="Total del fondo"
            value={cut.fundBreakdown}
          />
          <CashCounter
            readOnly
            showTotal
            legend="Efectivo retirado"
            totalLabel="Total retirado"
            value={cut.withdrawnBreakdown}
          />
        </div>
      </details>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="button-secondary min-h-11"
          type="button"
          onClick={onClose}
        >
          Volver
        </button>
        {isPending && onEdit && (
          <button
            className="button-primary min-h-11"
            type="button"
            onClick={() => onEdit(cut)}
          >
            Editar corte
          </button>
        )}
        {!isPending && movementId && onViewMovement && (
          <button
            className="button-primary min-h-11"
            type="button"
            onClick={() => onViewMovement(movementId)}
          >
            Ver movimiento
          </button>
        )}
      </div>
    </section>
  )
}
