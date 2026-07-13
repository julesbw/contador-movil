import type { Movimiento } from '../models/Movimiento'

export function ordenarPendientesPorFecha(
  movimientos: readonly Movimiento[],
): Movimiento[] {
  return [...movimientos].sort(
    (a, b) =>
      b.fechaMovimiento.localeCompare(a.fechaMovimiento) ||
      b.creadoEn.localeCompare(a.creadoEn) ||
      a.id.localeCompare(b.id),
  )
}

export function seleccionarTodosLosIds(
  movimientos: readonly Movimiento[],
): Set<string> {
  return new Set(movimientos.map(({ id }) => id))
}

export function alternarSeleccion(
  seleccionados: ReadonlySet<string>,
  movimientoId: string,
): Set<string> {
  const siguienteSeleccion = new Set(seleccionados)

  if (siguienteSeleccion.has(movimientoId)) {
    siguienteSeleccion.delete(movimientoId)
  } else {
    siguienteSeleccion.add(movimientoId)
  }

  return siguienteSeleccion
}

export function obtenerMovimientosSeleccionados(
  movimientos: readonly Movimiento[],
  seleccionados: ReadonlySet<string>,
): Movimiento[] {
  return movimientos.filter(({ id }) => seleccionados.has(id))
}

export function calcularTotalSeleccionado(
  movimientos: readonly Movimiento[],
  seleccionados: ReadonlySet<string>,
): number {
  return obtenerMovimientosSeleccionados(movimientos, seleccionados).reduce(
    (total, { monto }) => total + monto,
    0,
  )
}
