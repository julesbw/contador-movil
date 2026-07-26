import { useState, type FormEvent } from 'react'
import { CATEGORIAS_MANUALES } from '../models/Categoria'
import { crearDesgloseEfectivoVacio } from '../models/Efectivo'
import {
  FORMAS_PAGO,
  type Billetes,
  type Movimiento,
} from '../models/Movimiento'
import {
  movimientoService,
  MovimientoDesactualizadoError,
  MovimientoNoEditableError,
  MovimientoValidationError,
} from '../services/movimientoService'
import {
  calcularTotalBilletes,
  type DatosMovimiento,
} from '../services/movimientoValidation'
import { CashCounter } from './CashCounter'

type ValoresFormulario = {
  fechaMovimiento: string
  monto: string
  concepto: string
  categoria: Movimiento['categoria']
  formaPago: Movimiento['formaPago']
  billetes: Billetes
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
    categoria: movimiento?.categoria ?? CATEGORIAS_MANUALES[0],
    formaPago: movimiento?.formaPago ?? 'efectivo',
    billetes: movimiento
      ? { ...movimiento.billetes }
      : crearDesgloseEfectivoVacio(),
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
  const generadoDesdeCortes =
    movimiento?.source?.type === 'cash-cuts'
  let totalContado = Number.NaN

  try {
    totalContado = calcularTotalBilletes(valores.billetes)
  } catch {
    // El servicio mostrará el error de validación sin perder el formulario.
  }

  function crearDatos(): DatosMovimiento {
    return {
      tipo: movimiento?.tipo ?? 'salida',
      fechaMovimiento: valores.fechaMovimiento,
      monto: esEfectivo ? totalContado : Number(valores.monto),
      concepto: valores.concepto,
      categoria: valores.categoria,
      formaPago: valores.formaPago,
      billetes: esEfectivo
        ? valores.billetes
        : crearDesgloseEfectivoVacio(),
      notas: valores.notas,
    }
  }

  async function guardar(ignorarAdvertencia = false) {
    if (guardando) {
      return
    }

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
        ? await movimientoService.actualizar(
            movimiento.id,
            datos,
            movimiento.actualizadoEn,
          )
        : await movimientoService.crear(datos)

      onGuardado(guardado)
    } catch (error: unknown) {
      if (error instanceof MovimientoValidationError) {
        setErrores(error.errores)
      } else if (error instanceof MovimientoNoEditableError) {
        setErrores([
          'El movimiento ya fue exportado y no puede modificarse.',
        ])
      } else if (error instanceof MovimientoDesactualizadoError) {
        setErrores([
          'El movimiento cambió desde que se abrió. Vuelve a cargarlo antes de editar.',
        ])
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

      {generadoDesdeCortes && movimiento?.source && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          Este movimiento fue generado a partir de{' '}
          {movimiento.source.cashCutIds.length}{' '}
          {movimiento.source.cashCutIds.length === 1
            ? 'corte de caja'
            : 'cortes de caja'}
          . Solo puedes modificar fecha, concepto y notas.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="min-w-0 space-y-2 text-sm font-medium text-slate-700">
          Fecha
          <div className="mt-2 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2.5 transition focus-within:border-teal-600 focus-within:ring-2 focus-within:ring-teal-600/20">
            <input
              className="block w-full min-w-0 border-0 bg-transparent p-0 text-base text-slate-950 outline-none"
              disabled={guardando}
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
          </div>
        </label>

        {!esEfectivo && (
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Monto
            <input
              className="field"
              disabled={guardando}
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
          disabled={guardando}
          required
          value={valores.concepto}
          onChange={(event) =>
            setValores({ ...valores, concepto: event.target.value })
          }
        />
      </label>

      {generadoDesdeCortes ? (
        <dl className="grid gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="font-medium text-slate-500">Tipo</dt>
            <dd className="mt-1 capitalize text-slate-900">
              {movimiento.tipo}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Categoría</dt>
            <dd className="mt-1 text-slate-900">
              {movimiento.categoria}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">Forma de pago</dt>
            <dd className="mt-1 capitalize text-slate-900">
              {movimiento.formaPago}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 text-sm font-medium text-slate-700">
            Categoría
            <select
              className="field"
              disabled={guardando}
              value={valores.categoria}
              onChange={(event) =>
                setValores({
                  ...valores,
                  categoria: event.target.value as Movimiento['categoria'],
                })
              }
            >
              {CATEGORIAS_MANUALES.map((categoria) => (
                <option key={categoria}>{categoria}</option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-700">
            Forma de pago
            <select
              className="field"
              disabled={guardando}
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
      )}

      {esEfectivo && (
        <CashCounter
          disabled={guardando}
          readOnly={generadoDesdeCortes}
          showTotal
          legend="Desglose de efectivo"
          totalLabel="Monto del movimiento"
          value={valores.billetes}
          onChange={(billetes) =>
            setValores({ ...valores, billetes })
          }
        />
      )}

      <label className="space-y-2 text-sm font-medium text-slate-700">
        Notas (opcional)
        <textarea
          className="field min-h-24 resize-y"
          disabled={guardando}
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
              disabled={guardando}
              type="button"
              onClick={() => setAdvertencia(undefined)}
            >
              Revisar
            </button>
            <button
              className="button-primary"
              disabled={guardando}
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
