import { useCallback, useEffect, useState } from 'react'
import type { Movimiento } from '../models/Movimiento'
import { movimientoService } from '../services/movimientoService'
import { MovimientoForm } from '../components/MovimientoForm'

const TAMANO_PAGINA = 10
const formatoMoneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

type MovimientosProps = {
  revision: number
}

export function Movimientos({ revision }: MovimientosProps) {
  const [pagina, setPagina] = useState(0)
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [editando, setEditando] = useState<Movimiento>()
  const [cargando, setCargando] = useState(true)
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

  async function eliminar(movimiento: Movimiento) {
    const confirmado = window.confirm(
      `¿Eliminar el movimiento “${movimiento.concepto}”?`,
    )

    if (!confirmado) {
      return
    }

    try {
      await movimientoService.eliminar(movimiento.id)
      await cargar()
    } catch (cause: unknown) {
      console.error('No fue posible eliminar el movimiento', cause)
      setError('No fue posible eliminar el movimiento')
    }
  }

  if (editando) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-slate-950">
          Editar movimiento
        </h2>
        <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
          <MovimientoForm
            movimiento={editando}
            onCancelar={() => setEditando(undefined)}
            onGuardado={() => {
              setEditando(undefined)
              void cargar()
            }}
          />
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-950">Movimientos</h2>
      <p className="mt-1 text-sm text-slate-600">
        Los registros exportados son de solo lectura.
      </p>

      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        {cargando && (
          <p className="py-8 text-center text-slate-500">Cargando…</p>
        )}

        {!cargando && movimientos.length === 0 && (
          <p className="rounded-2xl bg-white p-8 text-center text-slate-500 ring-1 ring-slate-200">
            No hay movimientos en esta página.
          </p>
        )}

        {movimientos.map((movimiento) => (
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
                    className="button-secondary py-2"
                    type="button"
                    onClick={() => setEditando(movimiento)}
                  >
                    Editar
                  </button>
                  <button
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    type="button"
                    onClick={() => void eliminar(movimiento)}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <button
          className="button-secondary"
          disabled={pagina === 0 || cargando}
          type="button"
          onClick={() => setPagina((actual) => actual - 1)}
        >
          Anterior
        </button>
        <span className="text-sm text-slate-600">Página {pagina + 1}</span>
        <button
          className="button-secondary"
          disabled={movimientos.length < TAMANO_PAGINA || cargando}
          type="button"
          onClick={() => setPagina((actual) => actual + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  )
}
