import { useState, type FormEvent } from 'react'
import {
  obtenerIdentidadTienda,
  type CashCut,
} from '../models/CashCut'
import {
  CashCutAlreadyIncludedError,
  CashCutsDifferentStoresError,
  CashCutValidationError,
  type CreateMovementFromCashCutsInput,
} from '../services/cashCutDomain'
import { CashCutConflictError } from '../services/cashCutService'
import { CashCounter } from './CashCounter'
import {
  cashCutSuggestedConcept,
  summarizeCashCuts,
  toLocalDate,
} from './cashCutUi'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  currency: 'MXN',
  maximumFractionDigits: 2,
  style: 'currency',
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-MX', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

type CashCutConsolidationFormProps = {
  cuts: CashCut[]
  onSave: (input: CreateMovementFromCashCutsInput) => Promise<void>
  onCancel: () => void
}

function formatDateTime(value: string): string {
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime())
    ? value
    : dateTimeFormatter.format(parsed)
}

function getErrorMessages(error: unknown): string[] {
  if (error instanceof CashCutValidationError) {
    return error.errores
  }

  if (error instanceof CashCutAlreadyIncludedError) {
    return ['Este corte ya fue incluido en otro movimiento.']
  }

  if (error instanceof CashCutsDifferentStoresError) {
    return ['Solo puedes consolidar cortes de la misma tienda.']
  }

  if (error instanceof CashCutConflictError) {
    return [error.message]
  }

  return [
    'No fue posible crear la entrada. Los datos siguen en pantalla.',
  ]
}

export function CashCutConsolidationForm({
  cuts,
  onSave,
  onCancel,
}: CashCutConsolidationFormProps) {
  const [concept, setConcept] = useState(() =>
    cashCutSuggestedConcept(cuts),
  )
  const [date, setDate] = useState(() => toLocalDate())
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const summary = summarizeCashCuts(cuts)
  const hasDifferentStores =
    new Set(cuts.map(obtenerIdentidadTienda)).size > 1

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) {
      return
    }

    const nextErrors: string[] = []

    if (cuts.length === 0) {
      nextErrors.push('Selecciona al menos un corte de caja.')
    }

    if (hasDifferentStores) {
      nextErrors.push(
        'Solo puedes consolidar cortes de la misma tienda.',
      )
    }

    if (summary.error) {
      nextErrors.push(summary.error)
    }

    if (!concept.trim()) {
      nextErrors.push('El concepto de la entrada es obligatorio.')
    }

    if (!date || Number.isNaN(new Date(`${date}T00:00:00`).getTime())) {
      nextErrors.push('La fecha de la entrada es obligatoria.')
    }

    if (nextErrors.length > 0) {
      setErrors(nextErrors)
      return
    }

    setSaving(true)
    setErrors([])

    try {
      await onSave({
        concept,
        date,
        notes,
      })
    } catch (error: unknown) {
      console.error('No fue posible crear la entrada desde cortes', error)
      setErrors(getErrorMessages(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void save(event)}>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          Consolidar cortes
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">
          Crear entrada de efectivo
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Se creará un movimiento a partir de {cuts.length}{' '}
          {cuts.length === 1 ? 'corte pendiente' : 'cortes pendientes'}.
        </p>
      </div>

      {errors.length > 0 && (
        <div
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <ul className="list-disc space-y-1 pl-5">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {hasDifferentStores && (
        <p
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
          role="alert"
        >
          Solo puedes consolidar cortes de la misma tienda.
        </p>
      )}

      {summary.error && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {summary.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Concepto
          <input
            className="field min-h-11"
            disabled={saving}
            required
            value={concept}
            onChange={(event) => {
              setErrors([])
              setConcept(event.target.value)
            }}
          />
        </label>
        <label className="min-w-0 text-sm font-medium text-slate-700">
          Fecha
          <input
            className="field min-h-11"
            disabled={saving}
            required
            type="date"
            value={date}
            onChange={(event) => {
              setErrors([])
              setDate(event.target.value)
            }}
          />
        </label>
      </div>

      <label className="text-sm font-medium text-slate-700">
        Notas (opcional)
        <textarea
          className="field min-h-24 resize-y"
          disabled={saving}
          value={notes}
          onChange={(event) => {
            setErrors([])
            setNotes(event.target.value)
          }}
        />
      </label>

      <section
        aria-labelledby="selected-cuts-heading"
        className="rounded-2xl bg-white p-5 ring-1 ring-slate-200"
      >
        <h3
          className="font-semibold text-slate-950"
          id="selected-cuts-heading"
        >
          Cortes seleccionados
        </h3>
        <ul className="mt-3 divide-y divide-slate-100">
          {cuts.map((cut) => (
            <li
              className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm"
              key={cut.id}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-slate-800">
                  {cut.storeName || 'Sin tienda'}
                </span>
                <time className="text-slate-500" dateTime={cut.date}>
                  {formatDateTime(cut.date)}
                </time>
              </span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-950">
                {currencyFormatter.format(cut.withdrawnAmount)}
              </span>
            </li>
          ))}
        </ul>
        <div
          aria-live="polite"
          className="mt-3 flex min-h-14 items-center justify-between gap-4 border-t border-slate-200 pt-3"
        >
          <p className="font-semibold text-slate-900">
            Total de la entrada
          </p>
          <p className="text-xl font-bold tabular-nums text-teal-800">
            {currencyFormatter.format(summary.amount)}
          </p>
        </div>
      </section>

      <CashCounter
        disabled={saving}
        readOnly
        showTotal
        legend="Desglose total de la entrada"
        totalLabel="Total"
        value={summary.breakdown}
      />

      <div className="flex flex-wrap gap-3">
        <button
          className="button-secondary min-h-11"
          disabled={saving}
          type="button"
          onClick={onCancel}
        >
          Cancelar
        </button>
        <button
          className="button-primary min-h-11"
          disabled={
            saving ||
            cuts.length === 0 ||
            hasDifferentStores ||
            summary.amount <= 0 ||
            summary.error !== undefined
          }
          type="submit"
        >
          {saving ? 'Creando entrada…' : 'Crear entrada'}
        </button>
      </div>
    </form>
  )
}
