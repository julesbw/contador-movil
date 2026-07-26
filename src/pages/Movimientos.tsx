import { useCallback, useEffect, useState } from 'react'
import type { Movimiento } from '../models/Movimiento'
import {
  movimientoService,
  MovimientoDesactualizadoError,
} from '../services/movimientoService'
import { MovimientoForm } from '../components/MovimientoForm'

const TAMANO_PAGINA = 10
const formatoMoneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

type MovimientosProps = {
  revision: number
  movimientoEnfocadoId?: string
}

export function Movimientos({
  revision,
  movimientoEnfocadoId,
}: MovimientosProps) {
  const [pagina, setPagina] = useState(0)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [movimientoEnfocado, setMovimientoEnfocado] =
    useState<Movimiento>()
  const [mostrandoEnfocado, setMostrandoEnfocado] = useState(false)
  const [editando, setEditando] = useState<Movimiento>()
  const [cargando, setCargando] = useState(true)
  const [eliminandoId, setEliminandoId] = useState<string>()
  const [error, setError] = useState<string>()

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(undefined)

    try {
      const registros = await movimientoService.obtenerPagina({
        pagina,
        tamanoPagina: TAMANO_PAGINA,
      })
      setMovimientos(registros)
    } catch (cause: unknown) {
      console.error('No fue posible consultar los movimientos', cause)
      setError('No fue posible consultar los movimientos')
    } finally {
      setCargando(false)
    }
  }, [pagina])

  useEffect(() => {
    void cargar()
  }, [cargar, revision])

  useEffect(() => {
    let active = true

    if (!movimientoEnfocadoId) {
      setMovimientoEnfocado(undefined)
      setMostrandoEnfocado(false)
      return
    }

    movimientoService
      .obtenerPorId(movimientoEnfocadoId)
      .then((movimiento) => {
        if (!active) {
          return
        }

        if (!movimiento) {
          setError('El movimiento relacionado ya no existe.')
          setMovimientoEnfocado(undefined)
          setMostrandoEnfocado(false)
          return
        }

        setMovimientoEnfocado(movimiento)
        setMostrandoEnfocado(true)
      })
      .catch((cause: unknown) => {
        console.error('No fue posible consultar el movimiento', cause)

        if (active) {
          setError('No fue posible consultar el movimiento relacionado.')
        }
      })

    return () => {
      active = false
    }
  }, [movimientoEnfocadoId, revision])

  async function eliminar(movimiento: Movimiento) {
    if (eliminandoId !== undefined) {
      return
    }

    const advertenciaCortes =
      movimiento.source?.type === 'cash-cuts'
        ? `\n\nAl eliminar esta entrada, ${movimiento.source.cashCutIds.length === 1 ? 'el corte relacionado volverá' : 'los cortes relacionados volverán'} a estar pendientes.`
        : ''
    const confirmado = window.confirm(
      `¿Eliminar el movimiento “${movimiento.concepto}”?${advertenciaCortes}`,
    )

    if (!confirmado) {
      return
    }

    setEliminandoId(movimiento.id)
    setError(undefined)

    try {
      await movimientoService.eliminar(
        movimiento.id,
        movimiento.actualizadoEn,
      )
      setMovimientoEnfocado(undefined)
      setMostrandoEnfocado(false)
      await cargar()
    } catch (cause: unknown) {
      console.error('No fue posible eliminar el movimiento', cause)
      await cargar()
      setError(
        cause instanceof MovimientoDesactualizadoError
          ? 'El movimiento cambió o dejó de estar pendiente. Se recargó la lista.'
          : 'No fue posible eliminar el movimiento',
      )
    } finally {
      setEliminandoId(undefined)
    }
  }

  const movimientosVisibles =
    mostrandoEnfocado && movimientoEnfocado
      ? [movimientoEnfocado]
      : movimientos

  if (editando) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-slate-950">
          Editar movimiento
        </h2>
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <MovimientoForm
            movimiento={editando}
            onCancelar={() => {
              setEditando(undefined)
              void cargar()
            }}
            onGuardado={() => {
              setEditando(undefined)
              setMovimientoEnfocado(undefined)
              setMostrandoEnfocado(false)
              void cargar()
            }}
          />
        </div>
      </section>
    )
  }

  return (
    <section aria-busy={eliminandoId !== undefined}>
      <h2 className="text-2xl font-bold text-slate-950">Movimientos</h2>
      <p className="mt-1 text-sm text-slate-600">
        {mostrandoEnfocado
          ? 'Movimiento relacionado con el corte seleccionado.'
          : 'Los registros exportados son de solo lectura.'}
      </p>

      {mostrandoEnfocado && (
        <button
          className="button-secondary mt-4"
          disabled={eliminandoId !== undefined}
          type="button"
          onClick={() => setMostrandoEnfocado(false)}
        >
          Mostrar todos
        </button>
      )}

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {cargando && (
          <p className="py-8 text-center text-slate-500">Cargando…</p>
        )}

        {!cargando && movimientosVisibles.length === 0 && (
          <p className="rounded-2xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">
            No hay movimientos en esta página.
          </p>
        )}

        {movimientosVisibles.map((movimiento) => (
          <article
            className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
            key={movimiento.id}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {movimiento.concepto}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {movimiento.fechaMovimiento} · {movimiento.categoria}
                </p>
                {movimiento.source?.type === 'cash-cuts' && (
                  <p className="mt-1 text-xs font-medium text-teal-700">
                    Generado a partir de{' '}
                    {movimiento.source.cashCutIds.length}{' '}
                    {movimiento.source.cashCutIds.length === 1
                      ? 'corte de caja'
                      : 'cortes de caja'}
                  </p>
                )}
              </div>
              <p className="font-bold text-slate-950">
                {formatoMoneda.format(movimiento.monto)}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span
                className={
                  movimiento.estadoExportacion === 'pendiente'
                    ? 'badge bg-amber-100 text-amber-800'
                    : 'badge bg-emerald-100 text-emerald-800'
                }
              >
                {movimiento.estadoExportacion}
              </span>

              {movimiento.estadoExportacion === 'pendiente' && (
                <div className="flex gap-2">
                  <button
                    className="button-secondary min-h-11"
                    disabled={eliminandoId !== undefined}
                    type="button"
                    onClick={() => setEditando(movimiento)}
                  >
                    Editar
                  </button>
                  <button
                    className="min-h-11 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    disabled={eliminandoId !== undefined}
                    type="button"
                    onClick={() => void eliminar(movimiento)}
                  >
                    {eliminandoId === movimiento.id
                      ? 'Eliminando…'
                      : 'Eliminar'}
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      {!mostrandoEnfocado && (
        <div className="mt-6 flex items-center justify-between">
        <button
          className="button-secondary"
          disabled={
            pagina === 0 ||
            cargando ||
            eliminandoId !== undefined
          }
          type="button"
          onClick={() => setPagina((actual) => actual - 1)}
        >
          Anterior
        </button>
        <span className="text-sm text-slate-600">Página {pagina + 1}</span>
        <button
          className="button-secondary"
          disabled={
            movimientos.length < TAMANO_PAGINA ||
            cargando ||
            eliminandoId !== undefined
          }
          type="button"
          onClick={() => setPagina((actual) => actual + 1)}
        >
          Siguiente
        </button>
        </div>
      )}
    </section>
  )
}
