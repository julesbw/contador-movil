import { useState, type FormEvent } from 'react'
import type { CashCut } from '../models/CashCut'
import {
  crearDesgloseEfectivoVacio,
  type DesgloseEfectivo,
} from '../models/Efectivo'
import {
  CashCutAlreadyIncludedError,
  CashCutValidationError,
  crearCorteCaja,
  type CreateCashCutInput,
} from '../services/cashCutDomain'
import { CashCutConflictError } from '../services/cashCutService'
import {
  calcularTotalEfectivo,
  restarDesglosesEfectivo,
  validarFondoContraConteo,
} from '../services/efectivo'
import { CashCounter } from './CashCounter'
import { CashCutAmountsSummary } from './CashCutAmountsSummary'
import {
  nextCashCutFormStep,
  previousCashCutFormStep,
  type CashCutFormStep,
} from './cashCutFormSteps'
import { fromDateTimeLocal, toDateTimeLocal } from './cashCutUi'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  currency: 'MXN',
  maximumFractionDigits: 2,
  style: 'currency',
})

type CashCutFormProps = {
  cut?: CashCut
  onSave: (input: CreateCashCutInput) => Promise<void>
  onCancel: () => void
}

type CashCutFormValues = {
  date: string
  storeName: string
  concept: string
  notes: string
  countedBreakdown: DesgloseEfectivo
  fundBreakdown: DesgloseEfectivo
}

function calculatePreview(values: CashCutFormValues) {
  try {
    const countedAmount = calcularTotalEfectivo(
      values.countedBreakdown,
    )
    const fundAmount = calcularTotalEfectivo(values.fundBreakdown)
    const fundValidation = validarFondoContraConteo(
      values.countedBreakdown,
      values.fundBreakdown,
    )
    const withdrawnBreakdown =
      fundValidation.errores.length === 0
        ? restarDesglosesEfectivo(
            values.countedBreakdown,
            values.fundBreakdown,
          )
        : crearDesgloseEfectivoVacio()

    return {
      calculationError: undefined,
      countedAmount,
      fundAmount,
      withdrawnBreakdown,
      withdrawnAmount: calcularTotalEfectivo(withdrawnBreakdown),
    }
  } catch {
    return {
      countedAmount: 0,
      fundAmount: 0,
      withdrawnBreakdown: crearDesgloseEfectivoVacio(),
      withdrawnAmount: 0,
      calculationError:
        'El desglose de efectivo está fuera del rango permitido.',
    }
  }
}

function createInitialValues(cut?: CashCut): CashCutFormValues {
  return {
    date: toDateTimeLocal(cut?.date),
    storeName: cut?.storeName ?? '',
    concept: cut?.concept ?? '',
    notes: cut?.notes ?? '',
    countedBreakdown: cut
      ? { ...cut.countedBreakdown }
      : crearDesgloseEfectivoVacio(),
    fundBreakdown: cut
      ? { ...cut.fundBreakdown }
      : crearDesgloseEfectivoVacio(),
  }
}

function getErrorMessages(error: unknown): string[] {
  if (error instanceof CashCutValidationError) {
    return error.errores
  }

  if (error instanceof CashCutAlreadyIncludedError) {
    return ['Este corte ya fue incluido en otro movimiento.']
  }

  if (error instanceof CashCutConflictError) {
    return [error.message]
  }

  return ['No fue posible guardar el corte. Tus datos siguen en pantalla.']
}

export function CashCutForm({
  cut,
  onSave,
  onCancel,
}: CashCutFormProps) {
  const [step, setStep] = useState<CashCutFormStep>(1)
  const [values, setValues] = useState(() => createInitialValues(cut))
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const {
    calculationError,
    countedAmount,
    fundAmount,
    withdrawnBreakdown,
    withdrawnAmount,
  } = calculatePreview(values)

  function createInput(
    fundBreakdown = values.fundBreakdown,
  ): CreateCashCutInput {
    return {
      date: fromDateTimeLocal(values.date),
      concept: values.concept,
      ...(cut?.storeId ? { storeId: cut.storeId } : {}),
      storeName: values.storeName,
      notes: values.notes,
      countedBreakdown: { ...values.countedBreakdown },
      fundBreakdown: { ...fundBreakdown },
    }
  }

  function validateStep(targetStep: 1 | 2): boolean {
    try {
      crearCorteCaja(
        createInput(
          targetStep === 1
            ? crearDesgloseEfectivoVacio()
            : values.fundBreakdown,
        ),
        {
          id: 'cash-cut-form-preview',
          now: new Date(0).toISOString(),
        },
      )
      setErrors([])
      return true
    } catch (error: unknown) {
      setErrors(getErrorMessages(error))
      return false
    }
  }

  function goForward() {
    if (step === 1 && validateStep(1)) {
      setStep(nextCashCutFormStep(step))
    } else if (step === 2 && validateStep(2)) {
      setStep(nextCashCutFormStep(step))
    }
  }

  function goBack() {
    setErrors([])
    setStep(previousCashCutFormStep(step))
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (saving) {
      return
    }

    if (step !== 3) {
      goForward()
      return
    }

    if (!validateStep(2)) {
      return
    }

    setSaving(true)

    try {
      await onSave(createInput())
    } catch (error: unknown) {
      console.error('No fue posible guardar el corte', error)
      setErrors(getErrorMessages(error))
    } finally {
      setSaving(false)
    }
  }

  function updateBreakdown(
    key: 'countedBreakdown' | 'fundBreakdown',
    breakdown: DesgloseEfectivo,
  ) {
    setErrors([])
    setValues((current) => ({ ...current, [key]: breakdown }))
  }

  return (
    <form className="space-y-6" onSubmit={(event) => void save(event)}>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          {cut ? 'Editar corte' : 'Nuevo corte'}
        </p>
        <h2
          aria-live="polite"
          className="mt-1 text-2xl font-bold text-slate-950"
        >
          {step === 1
            ? 'Efectivo actual en caja'
            : step === 2
              ? '¿Cuánto efectivo permanecerá en caja?'
              : 'Confirma el corte'}
        </h2>
      </div>

      <ol
        aria-label="Progreso del corte"
        className="grid grid-cols-3 gap-2"
      >
        {['Conteo', 'Fondo', 'Confirmación'].map((label, index) => {
          const itemStep = index + 1
          const isCurrent = itemStep === step
          const isComplete = itemStep < step

          return (
            <li
              aria-current={isCurrent ? 'step' : undefined}
              className={
                isCurrent
                  ? 'rounded-lg bg-teal-700 px-2 py-2 text-center text-xs font-semibold text-white'
                  : isComplete
                    ? 'rounded-lg bg-teal-50 px-2 py-2 text-center text-xs font-semibold text-teal-800'
                    : 'rounded-lg bg-slate-100 px-2 py-2 text-center text-xs font-semibold text-slate-500'
              }
              key={label}
            >
              {itemStep}. {label}
            </li>
          )
        })}
      </ol>

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

      {calculationError && (
        <p
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {calculationError}
        </p>
      )}

      {step === 1 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0 text-sm font-medium text-slate-700">
              Fecha y hora
              <input
                className="field min-h-11"
                disabled={saving}
                required
                type="datetime-local"
                value={values.date}
                onChange={(event) => {
                  setErrors([])
                  setValues({ ...values, date: event.target.value })
                }}
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Tienda (opcional)
              <input
                className="field min-h-11"
                disabled={saving}
                placeholder="Ej. Tienda Centro"
                value={values.storeName}
                onChange={(event) => {
                  setErrors([])
                  setValues({ ...values, storeName: event.target.value })
                }}
              />
            </label>
          </div>

          <label className="text-sm font-medium text-slate-700">
            Concepto (opcional)
            <input
              className="field min-h-11"
              disabled={saving}
              placeholder="Se generará a partir de la tienda"
              value={values.concept}
              onChange={(event) => {
                setErrors([])
                setValues({ ...values, concept: event.target.value })
              }}
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Notas (opcional)
            <textarea
              className="field min-h-24 resize-y"
              disabled={saving}
              value={values.notes}
              onChange={(event) => {
                setErrors([])
                setValues({ ...values, notes: event.target.value })
              }}
            />
          </label>

          <CashCounter
            disabled={saving}
            showTotal
            legend="Efectivo actual en caja"
            totalLabel="Total contado"
            value={values.countedBreakdown}
            onChange={(breakdown) =>
              updateBreakdown('countedBreakdown', breakdown)
            }
          />
        </>
      )}

      {step === 2 && (
        <>
          <CashCounter
            disabled={saving}
            showTotal
            legend="Fondo que permanecerá en caja"
            maxByDenomination={values.countedBreakdown}
            totalLabel="Total del fondo"
            value={values.fundBreakdown}
            onChange={(breakdown) =>
              updateBreakdown('fundBreakdown', breakdown)
            }
          />
          <div
            aria-live="polite"
            className="flex min-h-16 items-center justify-between gap-4 rounded-xl bg-teal-50 px-4 py-3 text-teal-950"
          >
            <p className="text-sm font-semibold">Disponible para retirar</p>
            <p className="text-xl font-bold tabular-nums">
              {currencyFormatter.format(withdrawnAmount)}
            </p>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <CashCutAmountsSummary
            countedAmount={countedAmount}
            fundAmount={fundAmount}
            withdrawnAmount={withdrawnAmount}
          />
          <CashCounter
            disabled={saving}
            readOnly
            showTotal
            legend="Desglose del efectivo retirado"
            totalLabel="Total retirado"
            value={withdrawnBreakdown}
          />
        </>
      )}

      <div className="flex flex-wrap gap-3">
        {step === 1 ? (
          <button
            className="button-secondary min-h-11"
            disabled={saving}
            type="button"
            onClick={onCancel}
          >
            Cancelar
          </button>
        ) : (
          <button
            className="button-secondary min-h-11"
            disabled={saving}
            type="button"
            onClick={goBack}
          >
            Anterior
          </button>
        )}

        {step < 3 ? (
          <button
            className="button-primary min-h-11"
            disabled={saving || calculationError !== undefined}
            type="submit"
          >
            Continuar
          </button>
        ) : (
          <button
            className="button-primary min-h-11"
            disabled={saving || calculationError !== undefined}
            type="submit"
          >
            {saving
              ? 'Guardando…'
              : cut
                ? 'Guardar cambios'
                : 'Guardar corte'}
          </button>
        )}
      </div>
    </form>
  )
}
