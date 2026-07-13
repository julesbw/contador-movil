import { describe, expect, it } from 'vitest'
import type { Movimiento } from '../models/Movimiento'
import {
  alternarSeleccion,
  calcularTotalSeleccionado,
  obtenerMovimientosSeleccionados,
  ordenarPendientesPorFecha,
  seleccionarTodosLosIds,
} from './exportSelection'

function crearMovimiento(
  id: string,
  fechaMovimiento: string,
  creadoEn: string,
  monto: number,
): Movimiento {
  return {
    id,
    tipo: 'salida',
    fechaMovimiento,
    monto,
    concepto: `Movimiento ${id}`,
    categoria: 'Otros',
    formaPago: 'tarjeta',
    billetes: {
      b1000: 0,
      b500: 0,
      b200: 0,
      b100: 0,
      b50: 0,
      b20: 0,
      monedas: 0,
    },
    estadoExportacion: 'pendiente',
    creadoEn,
    actualizadoEn: creadoEn,
  }
}

const movimientos = [
  crearMovimiento('b', '2026-07-10', '2026-07-10T10:00:00.000Z', 200),
  crearMovimiento('a', '2026-07-11', '2026-07-11T09:00:00.000Z', 100),
  crearMovimiento('c', '2026-07-11', '2026-07-11T10:00:00.000Z', 300),
]

describe('selección de exportación', () => {
  it('ordena por fecha, creación e id de forma determinista', () => {
    expect(ordenarPendientesPorFecha(movimientos).map(({ id }) => id)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('selecciona todos y alterna sin mutar el Set original', () => {
    const todos = seleccionarTodosLosIds(movimientos)
    const sinB = alternarSeleccion(todos, 'b')
    const conBNuevamente = alternarSeleccion(sinB, 'b')

    expect([...todos]).toEqual(['b', 'a', 'c'])
    expect([...sinB]).toEqual(['a', 'c'])
    expect([...conBNuevamente]).toEqual(['a', 'c', 'b'])
  })

  it('deriva cantidad y total desde monto', () => {
    const seleccionados = new Set(['a', 'c'])

    expect(
      obtenerMovimientosSeleccionados(movimientos, seleccionados),
    ).toHaveLength(2)
    expect(calcularTotalSeleccionado(movimientos, seleccionados)).toBe(400)
    expect(calcularTotalSeleccionado(movimientos, new Set())).toBe(0)
  })
})
