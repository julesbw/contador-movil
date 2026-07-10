import { useState } from 'react'
import {
  descargarArchivoJson,
  exportService,
  type LotePendiente,
} from '../services/exportService'

type ExportarProps = {
  onExportacionConfirmada: () => void
}

export function Exportar({
  onExportacionConfirmada,
}: ExportarProps) {
  const [lotePendiente, setLotePendiente] = useState<LotePendiente>()
  const [procesando, setProcesando] = useState(false)
  const [mensaje, setMensaje] = useState<string>()
  const [error, setError] = useState<string>()

  async function exportarPendientes() {
    setProcesando(true)
    setMensaje(undefined)
    setError(undefined)

    try {
      const lote = await exportService.prepararPendientes()
      descargarArchivoJson(lote)
      setLotePendiente(lote)
    } catch (cause: unknown) {
      console.error('No fue posible exportar los movimientos', cause)
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
      onExportacionConfirmada()
    } catch (cause: unknown) {
      console.error('No fue posible confirmar la exportación', cause)
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
        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <h3 className="font-semibold text-slate-950">
            Exportar pendientes
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Genera un lote con movimientos pendientes. Después deberás
            confirmar manualmente que el archivo quedó guardado.
          </p>
          <button
            className="button-primary mt-5"
            disabled={procesando || Boolean(lotePendiente)}
            type="button"
            onClick={() => void exportarPendientes()}
          >
            Generar pendientes
          </button>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
          <h3 className="font-semibold text-slate-950">
            Exportar todo
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Descarga un respaldo completo sin cambiar el estado de ningún
            movimiento.
          </p>
          <button
            className="button-secondary mt-5"
            disabled={procesando || Boolean(lotePendiente)}
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
