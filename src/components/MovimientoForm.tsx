import { useState, type FormEvent } from 'react'
import { CATEGORIAS } from '../models/Categoria'
import {
  FORMAS_PAGO,
  type Billetes,
  type Movimiento,
} from '../models/Movimiento'
import {
  movimientoService,
  MovimientoValidationError,
} from '../services/movimientoService'
import {
  calcularTotalBilletes,
  type DatosMovimiento,
} from '../services/movimientoValidation'

const DENOMINACIONES: Array<{
  key: keyof Billetes
  label: string
  valor: number
}> = [
  { key: 'b1000', label: '$1,000', valor: 1000 },
  { key: 'b500', label: '$500', valor: 500 },
  { key: 'b200', label: '$200', valor: 200 },
  { key: 'b100', label: '$100', valor: 100 },
  { key: 'b50', label: '$50', valor: 50 },
  { key: 'b20', label: '$20', valor: 20 },
  { key: 'monedas', label: 'Monedas', valor: 1 },
]

const BILLETES_EN_CERO: Billetes = {
  b1000: 0,
  b500: 0,
  b200: 0,
  b100: 0,
  b50: 0,
  b20: 0,
  monedas: 0,
}

const formatoMoneda = new Intl.NumberFormat('es-MX', {
  currency: 'MXN',
  maximumFractionDigits: 2,
  style: 'currency',
})

type ValoresFormulario = {
  fechaMovimiento: string
  monto: string
  concepto: string
  categoria: Movimiento['categoria']
  formaPago: Movimiento['formaPago']
  billetes: Record<keyof Billetes, string>
  notas: string
}

type MovimientoFormProps = {
  movimiento?: Movimiento
  onGuardado: (movimiento: Movimiento) => void
  onCancelar?: () => void
}

function fechaLocalActual(): string {
  const ahora = new Date()
  const offset = ahora.getTimezoneOffset() * 60_000

  return new Date(ahora.getTime() - offset).toISOString().slice(0, 10)
}

function crearValoresIniciales(movimiento?: Movimiento): ValoresFormulario {
  return {
    fechaMovimiento: movimiento?.fechaMovimiento ?? fechaLocalActual(),
    monto: movimiento ? String(movimiento.monto) : '',
    concepto: movimiento?.concepto ?? '',
    categoria: movimiento?.categoria ?? CATEGORIAS[0],
    formaPago: movimiento?.formaPago ?? 'efectivo',
    billetes: {
      b1000: String(movimiento?.billetes.b1000 ?? 0),
      b500: String(movimiento?.billetes.b500 ?? 0),
      b200: String(movimiento?.billetes.b200 ?? 0),
      b100: String(movimiento?.billetes.b100 ?? 0),
      b50: String(movimiento?.billetes.b50 ?? 0),
      b20: String(movimiento?.billetes.b20 ?? 0),
      monedas: String(movimiento?.billetes.monedas ?? 0),
    },
    notas: movimiento?.notas ?? '',
  }
}

export function MovimientoForm({
  movimiento,
  onGuardado,
  onCancelar,
}: MovimientoFormProps) {
  const [valores, setValores] = useState(() =>
    crearValoresIniciales(movimiento),
  )
  const [errores, setErrores] = useState<string[]>([])
  const [advertencia, setAdvertencia] = useState<string>()
  const [guardando, setGuardando] = useState(false)

  const esEfectivo = valores.formaPago === 'efectivo'
  const billetesNumericos: Billetes = {
    b1000: Number(valores.billetes.b1000),
    b500: Number(valores.billetes.b500),
    b200: Number(valores.billetes.b200),
    b100: Number(valores.billetes.b100),
    b50: Number(valores.billetes.b50),
    b20: Number(valores.billetes.b20),
    monedas: Number(valores.billetes.monedas),
  }
  const totalContado = calcularTotalBilletes(billetesNumericos)

  function crearDatos(): DatosMovimiento {
    return {
      tipo: movimiento?.tipo ?? 'salida',
      fechaMovimiento: valores.fechaMovimiento,
      monto: esEfectivo ? totalContado : Number(valores.monto),
      concepto: valores.concepto,
      categoria: valores.categoria,
      formaPago: valores.formaPago,
      billetes: esEfectivo ? billetesNumericos : BILLETES_EN_CERO,
      notas: valores.notas,
    }
  }

  async function guardar(ignorarAdvertencia = false) {
    const datos = crearDatos()
    const resultado = movimientoService.validar(datos)

    setErrores(resultado.errores)

    if (resultado.errores.length > 0) {
      setAdvertencia(undefined)
      return
    }

    if (!ignorarAdvertencia && resultado.advertencias.length > 0) {
      setAdvertencia(resultado.advertencias[0])
      return
    }

    setGuardando(true)
    setAdvertencia(undefined)

    try {
      const guardado = movimiento
        ? await movimientoService.actualizar(movimiento.id, datos)
        : await movimientoService.crear(datos)

      onGuardado(guardado)
    } catch (error: unknown) {
      if (error instanceof MovimientoValidationError) {
        setErrores(error.errores)
      } else {
        console.error('No fue posible guardar el movimiento', error)
        setErrores(['No fue posible guardar el movimiento'])
      }
    } finally {
      setGuardando(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void guardar()
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      {errores.length > 0 && (
        <div
          className="rounded-xl bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          <ul className="list-disc space-y-1 pl-5">
            {errores.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Fecha
          <input
            className="field"
            type="date"
            required
            value={valores.fechaMovimiento}
            onChange={(event) =>
              setValores({
                ...valores,
                fechaMovimiento: event.target.value,
              })
            }
          />
        </label>

        {!esEfectivo && (
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Monto
            <input
              className="field"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={valores.monto}
              onChange={(event) =>
                setValores({ ...valores, monto: event.target.value })
              }
            />
          </label>
        )}
      </div>

      <label className="space-y-2 text-sm font-medium text-slate-700">
        Concepto
        <input
          className="field"
          required
          value={valores.concepto}
          onChange={(event) =>
            setValores({ ...valores, concepto: event.target.value })
          }
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Categoría
          <select
            className="field"
            value={valores.categoria}
            onChange={(event) =>
              setValores({
                ...valores,
                categoria: event.target.value as Movimiento['categoria'],
              })
            }
          >
            {CATEGORIAS.map((categoria) => (
              <option key={categoria}>{categoria}</option>
            ))}
          </select>
        </label>

        <label className="space-y-2 text-sm font-medium text-slate-700">
          Forma de pago
          <select
            className="field"
            value={valores.formaPago}
            onChange={(event) =>
              setValores({
                ...valores,
                formaPago: event.target.value as Movimiento['formaPago'],
              })
            }
          >
            {FORMAS_PAGO.map((formaPago) => (
              <option key={formaPago} value={formaPago}>
                {formaPago[0].toUpperCase() + formaPago.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {esEfectivo && (
        <fieldset>
          <legend className="text-sm font-semibold text-slate-900">
            Desglose de efectivo
          </legend>
          <div className="mt-3 space-y-3">
            {DENOMINACIONES.map(({ key, label, valor }) => (
              <label
                className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-medium text-slate-600 sm:grid-cols-[7rem_1fr_9rem]"
                key={key}
              >
                <span className="self-center">{label}</span>
                <input
                  className="field"
                  type="number"
                  inputMode={key === 'monedas' ? 'decimal' : 'numeric'}
                  min="0"
                  step={key === 'monedas' ? '0.01' : '1'}
                  aria-label={
                    key === 'monedas'
                      ? 'Monto total en monedas'
                      : `Cantidad de billetes de ${valor} pesos`
                  }
                  value={valores.billetes[key]}
                  onChange={(event) =>
                    setValores({
                      ...valores,
                      billetes: {
                        ...valores.billetes,
                        [key]: event.target.value,
                      },
                    })
                  }
                />
                <span className="self-center text-right text-sm font-semibold text-slate-800">
                  {key === 'monedas'
                    ? `= ${formatoMoneda.format(billetesNumericos[key])}`
                    : `× ${billetesNumericos[key] || 0} = ${formatoMoneda.format(
                        billetesNumericos[key] * valor,
                      )}`}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-4 rounded-2xl bg-slate-900 p-4 text-white">
            <p className="text-sm text-slate-300">Total contado</p>
            <p className="mt-1 text-3xl font-bold">
              {formatoMoneda.format(totalContado)}
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Este total se usará como monto del movimiento.
            </p>
          </div>
        </fieldset>
      )}

      <label className="space-y-2 text-sm font-medium text-slate-700">
        Notas (opcional)
        <textarea
          className="field min-h-24 resize-y"
          value={valores.notas}
          onChange={(event) =>
            setValores({ ...valores, notas: event.target.value })
          }
        />
      </label>

      {advertencia && (
        <div
          className="rounded-xl border border-amber-300 bg-amber-50 p-4"
          role="alert"
        >
          <p className="font-medium text-amber-900">{advertencia}</p>
          <p className="mt-1 text-sm text-amber-800">
            ¿Deseas guardar el movimiento de todos modos?
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="button-secondary"
              type="button"
              onClick={() => setAdvertencia(undefined)}
            >
              Revisar
            </button>
            <button
              className="button-primary"
              type="button"
              onClick={() => void guardar(true)}
            >
              Guardar de todos modos
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button className="button-primary" disabled={guardando} type="submit">
          {guardando
            ? 'Guardando…'
            : movimiento
              ? 'Guardar cambios'
              : 'Guardar movimiento'}
        </button>
        {onCancelar && (
          <button
            className="button-secondary"
            disabled={guardando}
            type="button"
            onClick={onCancelar}
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
