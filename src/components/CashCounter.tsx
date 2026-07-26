import { useEffect, useId, useState } from 'react'
import {
  DENOMINACIONES_EFECTIVO,
  type DesgloseEfectivo,
} from '../models/Efectivo'
import { calcularTotalEfectivo } from '../services/efectivo'
import { parseCashCounterInput } from './cashCounterInput'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  currency: 'MXN',
  maximumFractionDigits: 2,
  style: 'currency',
})

const quantityFormatter = new Intl.NumberFormat('es-MX', {
  maximumFractionDigits: 0,
})

type CashCounterProps = {
  value: DesgloseEfectivo
  onChange?: (value: DesgloseEfectivo) => void
  maxByDenomination?: Partial<DesgloseEfectivo>
  disabled?: boolean
  readOnly?: boolean
  showTotal?: boolean
  totalLabel?: string
  legend?: string
}

type CashValueInputProps = {
  value: number
  maximum?: number
  unitValue: number
  allowsDecimal: boolean
  disabled: boolean
  readOnly: boolean
  ariaLabel: string
  describedBy?: string
  onValidChange: (value: number) => boolean
}

function formatInputValue(value: number, readOnly: boolean): string {
  return value === 0 && !readOnly ? '' : String(value)
}

function CashValueInput({
  value,
  maximum,
  unitValue,
  allowsDecimal,
  disabled,
  readOnly,
  ariaLabel,
  describedBy,
  onValidChange,
}: CashValueInputProps) {
  const [rawValue, setRawValue] = useState(() =>
    formatInputValue(value, readOnly),
  )
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) {
      setRawValue(formatInputValue(value, readOnly))
    }
  }, [focused, readOnly, value])

  function change(raw: string) {
    const nextValue = parseCashCounterInput(
      raw,
      allowsDecimal,
      maximum,
      unitValue,
    )

    if (nextValue === undefined) {
      return
    }

    if (onValidChange(nextValue)) {
      setRawValue(raw)
    }
  }

  return (
    <input
      aria-describedby={describedBy}
      aria-label={ariaLabel}
      className="h-11 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-base text-slate-950 outline-none transition read-only:bg-slate-50 focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 disabled:bg-slate-100 disabled:text-slate-500"
      disabled={disabled}
      inputMode={allowsDecimal ? 'decimal' : 'numeric'}
      pattern={allowsDecimal ? '[0-9]*([.,][0-9]{0,2})?' : '[0-9]*'}
      readOnly={readOnly}
      type="text"
      value={rawValue}
      onBlur={() => {
        setFocused(false)
        setRawValue(formatInputValue(value, readOnly))
      }}
      onChange={(event) => change(event.target.value)}
      onFocus={() => setFocused(true)}
    />
  )
}

export function CashCounter({
  value,
  onChange,
  maxByDenomination,
  disabled = false,
  readOnly = false,
  showTotal = false,
  totalLabel = 'Total',
  legend = 'Desglose de efectivo',
}: CashCounterProps) {
  const fieldsetId = useId()
  let total: number | undefined

  try {
    total = calcularTotalEfectivo(value)
  } catch {
    total = undefined
  }

  function changeValue(
    key: keyof DesgloseEfectivo,
    nextValue: number,
  ): boolean {
    if (disabled || readOnly || !onChange) {
      return false
    }

    const nextBreakdown = { ...value, [key]: nextValue }

    try {
      calcularTotalEfectivo(nextBreakdown)
    } catch {
      return false
    }

    onChange(nextBreakdown)

    return true
  }

  return (
    <fieldset
      className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      disabled={disabled}
    >
      <legend className="sr-only">{legend}</legend>
      <div
        className="flex min-h-0 flex-col"
        style={{
          maxHeight: 'min(36rem, calc(100dvh - 2rem))',
        }}
      >
        <div className="shrink-0 px-4 py-3 sm:px-5">
          <p
            aria-hidden="true"
            className="text-sm font-semibold text-slate-900"
          >
            {legend}
          </p>
        </div>
        <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain border-t border-slate-200 px-4 sm:px-5">
          {DENOMINACIONES_EFECTIVO.map(
            ({ key, label, valor, permiteDecimal }) => {
              const maximum = maxByDenomination?.[key]
              const maximumId =
                maximum === undefined
                  ? undefined
                  : `${fieldsetId}-${key}-maximum`

              return (
                <label
                  className="grid min-h-16 scroll-mb-3 grid-cols-[3.5rem_minmax(4rem,5rem)_minmax(0,1fr)] items-center gap-2 text-sm sm:grid-cols-[6rem_minmax(5rem,6rem)_minmax(0,1fr)]"
                  key={key}
                >
                  <span className="font-medium text-slate-700">
                    {label}
                  </span>
                  <span>
                    <CashValueInput
                      allowsDecimal={permiteDecimal}
                      ariaLabel={
                        permiteDecimal
                          ? 'Monto total en monedas'
                          : `Cantidad de billetes de ${valor} pesos`
                      }
                      describedBy={maximumId}
                      disabled={disabled}
                      maximum={maximum}
                      readOnly={readOnly}
                      unitValue={valor}
                      value={value[key]}
                      onValidChange={(nextValue) =>
                        changeValue(key, nextValue)
                      }
                    />
                    {maximum !== undefined && (
                      <span
                        className="mt-1 block text-center text-xs text-slate-500"
                        id={maximumId}
                      >
                        Máx.{' '}
                        {permiteDecimal
                          ? currencyFormatter.format(maximum)
                          : quantityFormatter.format(maximum)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 text-right font-semibold tabular-nums text-slate-800">
                    {currencyFormatter.format(
                      permiteDecimal
                        ? value[key]
                        : value[key] * valor,
                    )}
                  </span>
                </label>
              )
            },
          )}
        </div>

        {showTotal && (
          <div
            aria-live="polite"
            className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5"
          >
            <p className="text-sm font-semibold text-slate-700">
              {totalLabel}
            </p>
            <p
              className={
                total === undefined
                  ? 'text-sm font-semibold text-red-700'
                  : 'text-xl font-bold tabular-nums text-slate-950 sm:text-2xl'
              }
            >
              {total === undefined
                ? 'Desglose no válido'
                : currencyFormatter.format(total)}
            </p>
          </div>
        )}
      </div>
    </fieldset>
  )
}
