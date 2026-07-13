import { useEffect, useState } from 'react'
import type { Movimiento } from '../models/Movimiento'
import {
  descargarArchivoJson,
  exportService,
  PendientesDesactualizadosError,
  type LotePendiente,
} from '../services/exportService'
import {
  alternarSeleccion,
  calcularTotalSeleccionado,
  seleccionarTodosLosIds,
} from '../services/exportSelection'

const formatoMoneda = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

const MENSAJE_LISTA_DESACTUALIZADA =
  'La lista cambió porque uno o más movimientos ya no están pendientes. Se recargaron los movimientos disponibles.'

type ExportarProps = {
  onExportacionConfirmada: () => void
}

export function Exportar({
  onExportacionConfirmada,
}: ExportarProps) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [seleccionados, setSeleccionados] = useState<Set<string>>(
    () => new Set(),
  )
  const [cargando, setCargando] = useState(true)
  const [lotePendiente, setLotePendiente] = useState<LotePendiente>()
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    let activo = true

    exportService
      .obtenerPendientes()
      .then((pendientes) => {
        if (activo) {
          setMovimientos(pendientes)
          setSeleccionados(seleccionarTodosLosIds(pendientes))
        }
      })
      .catch((cause: unknown) => {
        console.error('No fue posible cargar los movimientos pendientes', cause)

        if (activo) {
          setError('No fue posible cargar los movimientos pendientes')
        }
      })
      .finally(() => {
        if (activo) {
          setCargando(false)
        }
      })

    return () => {
      activo = false
    }
  }, [])

  const totalSeleccionado = calcularTotalSeleccionado(
    movimientos,
    seleccionados,
  )

  async function recargarPendientes(mensajeError?: string) {
    setCargando(true)

    try {
      const pendientes = await exportService.obtenerPendientes()
      setMovimientos(pendientes)
      setSeleccionados(seleccionarTodosLosIds(pendientes))

      if (mensajeError) {
        setError(mensajeError)
      }
    } catch (cause: unknown) {
      console.error('No fue posible recargar los movimientos pendientes', cause)
      setError('No fue posible cargar los movimientos pendientes')
    } finally {
      setCargando(false)
    }
  }

  async function exportarPendientes() {
    setProcesando(true)
    setMensaje(undefined)
    setError(undefined)

    try {
      const lote = await exportService.prepararPendientesSeleccionados([
        ...seleccionados,
      ])
      descargarArchivoJson(lote)
      setLotePendiente(lote)
    } catch (cause: unknown) {
      console.error('No fue posible exportar los movimientos', cause)

      if (cause instanceof PendientesDesactualizadosError) {
        await recargarPendientes(MENSAJE_LISTA_DESACTUALIZADA)
        return
      }

      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible exportar los movimientos',
      )
    } finally {
      setProcesando(false)
    }
  }

  async function confirmarExportacion() {
    if (!lotePendiente) {
      return
    }

    setProcesando(true)
    setError(undefined)

    try {
      await exportService.confirmarPendientes(lotePendiente)
      setMensaje(
        `${lotePendiente.movimientoIds.length} movimientos marcados como exportados`,
      )
      setLotePendiente(undefined)
      await recargarPendientes()
      onExportacionConfirmada()
    } catch (cause: unknown) {
      console.error('No fue posible confirmar la exportación', cause)

      if (cause instanceof PendientesDesactualizadosError) {
        setLotePendiente(undefined)
        await recargarPendientes(MENSAJE_LISTA_DESACTUALIZADA)
        return
      }

      setError('No fue posible confirmar la exportación')
    } finally {
      setProcesando(false)
    }
  }

  async function exportarTodo() {
    setProcesando(true)
    setMensaje(undefined)
    setError(undefined)

    try {
      const respaldo = await exportService.prepararRespaldo()
      descargarArchivoJson(respaldo)
      setMensaje(
        `Respaldo generado con ${respaldo.archivo.total_movimientos} movimientos. Ningún estado fue modificado.`,
      )
    } catch (cause: unknown) {
      console.error('No fue posible generar el respaldo', cause)
      setError(
        cause instanceof Error
          ? cause.message
          : 'No fue posible generar el respaldo',
      )
    } finally {
      setProcesando(false)
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-950">Exportar</h2>
      <p className="mt-1 text-sm text-slate-600">
        Guarda tus movimientos en archivos JSON compatibles con Contador.
      </p>

      {error && (
        <p className="mt-6 rounded-xl bg-red-50 p-4 text-sm text-red-800">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="mt-6 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {mensaje}
        </p>
      )}

      {lotePendiente && (
        <div
          className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5"
          role="alert"
        >
          <h3 className="font-semibold text-amber-950">
            Confirma la exportación
          </h3>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Se generó el archivo con {lotePendiente.movimientoIds.length}{' '}
            movimientos. Confirma únicamente si pudiste guardarlo o
            compartirlo correctamente.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="button-primary"
              disabled={procesando}
              type="button"
              onClick={() => void confirmarExportacion()}
            >
              Sí, marcar como exportados
            </button>
            <button
              className="button-secondary"
              disabled={procesando}
              type="button"
              onClick={() => setLotePendiente(undefined)}
            >
              No marcar todavía
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:col-span-2 sm:p-6">
          <h3 className="font-semibold text-slate-950">
            Exportar pendientes
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Selecciona los movimientos que incluirá el lote. Después deberás
            confirmar manualmente que el archivo quedó guardado.
          </p>

          {cargando && (
            <p className="py-8 text-center text-slate-500">
              Cargando movimientos pendientes…
            </p>
          )}

          {!cargando && movimientos.length === 0 && (
            <p className="mt-5 rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-600">
              No hay movimientos pendientes de exportación.
            </p>
          )}

          {!cargando && movimientos.length > 0 && (
            <>
              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  className="button-secondary py-2"
                  disabled={procesando || Boolean(lotePendiente)}
                  type="button"
                  onClick={() =>
                    setSeleccionados(seleccionarTodosLosIds(movimientos))
                  }
                >
                  Seleccionar todos
                </button>
                <button
                  className="button-secondary py-2"
                  disabled={procesando || Boolean(lotePendiente)}
                  type="button"
                  onClick={() => setSeleccionados(new Set())}
                >
                  Deseleccionar todos
                </button>
              </div>

              <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
                {movimientos.map((movimiento) => (
                  <label
                    className="flex min-h-16 cursor-pointer items-start gap-3 bg-white p-3 transition hover:bg-slate-50"
                    key={movimiento.id}
                  >
                    <input
                      className="mt-1 size-5 shrink-0 accent-teal-700"
                      type="checkbox"
                      checked={seleccionados.has(movimiento.id)}
                      disabled={procesando || Boolean(lotePendiente)}
                      onChange={() =>
                        setSeleccionados((actuales) =>
                          alternarSeleccion(actuales, movimiento.id),
                        )
                      }
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 font-semibold text-slate-950">
                          {movimiento.concepto}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-slate-950">
                          {formatoMoneda.format(movimiento.monto)}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-slate-500">
                        {movimiento.fechaMovimiento} · {movimiento.categoria}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-sm font-medium text-slate-700">
                  {seleccionados.size} de {movimientos.length} movimientos
                  seleccionados
                </p>
                <p className="mt-1 text-lg font-bold tabular-nums text-slate-950">
                  Total seleccionado: {formatoMoneda.format(totalSeleccionado)}
                </p>
              </div>
            </>
          )}

          <button
            className="button-primary mt-5"
            disabled={
              cargando ||
              procesando ||
              seleccionados.size === 0 ||
              Boolean(lotePendiente)
            }
            type="button"
            onClick={() => void exportarPendientes()}
          >
            Exportar seleccionados
          </button>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:col-span-2 sm:p-6">
          <h3 className="font-semibold text-slate-950">
            Exportar todo
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Descarga un respaldo completo sin cambiar el estado de ningún
            movimiento.
          </p>
          <button
            className="button-secondary mt-5"
            disabled={cargando || procesando || Boolean(lotePendiente)}
            type="button"
            onClick={() => void exportarTodo()}
          >
            Generar respaldo
          </button>
        </article>
      </div>
    </section>
  )
}
