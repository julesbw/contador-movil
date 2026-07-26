import { useId } from 'react'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  currency: 'MXN',
  maximumFractionDigits: 2,
  style: 'currency',
})

type CashCutAmountsSummaryProps = {
  countedAmount: number
  fundAmount: number
  withdrawnAmount: number
  heading?: string
}

export function CashCutAmountsSummary({
  countedAmount,
  fundAmount,
  withdrawnAmount,
  heading = 'Resumen del corte',
}: CashCutAmountsSummaryProps) {
  const headingId = useId()

  return (
    <section
      aria-labelledby={headingId}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
    >
      <h3
        className="px-4 py-3 text-sm font-semibold text-slate-900 sm:px-5"
        id={headingId}
      >
        {heading}
      </h3>
      <dl className="border-t border-slate-200 px-4 py-3 sm:px-5">
        <div className="flex min-h-11 items-center justify-between gap-4">
          <dt className="text-sm text-slate-600">Efectivo contado</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            {currencyFormatter.format(countedAmount)}
          </dd>
        </div>
        <div className="flex min-h-11 items-center justify-between gap-4">
          <dt className="text-sm text-slate-600">Fondo de caja</dt>
          <dd className="font-semibold tabular-nums text-slate-900">
            −{currencyFormatter.format(fundAmount)}
          </dd>
        </div>
        <div className="flex min-h-14 items-center justify-between gap-4 border-t border-slate-200">
          <dt className="font-semibold text-slate-900">Efectivo retirado</dt>
          <dd className="text-xl font-bold tabular-nums text-teal-800">
            {currencyFormatter.format(withdrawnAmount)}
          </dd>
        </div>
      </dl>
    </section>
  )
}
