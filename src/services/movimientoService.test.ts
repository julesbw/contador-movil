import { describe, expect, it } from 'vitest'
import type {
  MovimientosRepository,
  PaginaMovimientos,
  CambiosMovimiento,
} from '../db/movimientosRepo'
import type { Movimiento } from '../models/Movimiento'
import type { DatosMovimiento } from './movimientoValidation'
import {
  MovimientoNoEditableError,
  MovimientoService,
} from './movimientoService'

function crearDatos(): DatosMovimiento {
  return {
    tipo: 'salida',
    fechaMovimiento: '2026-07-08',
    monto: 100,
    concepto: ' Transporte ',
    categoria: 'Transporte',
    formaPago: 'efectivo',
    billetes: {
      b1000: 0,
      b500: 0,
      b200: 0,
      b100: 1,
      b50: 0,
      b20: 0,
      monedas: 0,
    },
    notas: ' ',
  }
}

function crearRepository(
  inicial: Movimiento[] = [],
): MovimientosRepository & { registros: Movimiento[] } {
  const registros = [...inicial]

  return {
    registros,
    guardar(movimiento) {
      registros.push(movimiento)
      return Promise.resolve(movimiento.id)
    },
    obtenerPorId(id) {
      return Promise.resolve(registros.find((item) => item.id === id))
    },
    obtenerPagina(_opciones: PaginaMovimientos) {
      return Promise.resolve(registros)
    },
    obtenerPendientes() {
      return Promise.resolve(
        registros.filter(({ estadoExportacion }) => estadoExportacion === 'pendiente'),
      )
    },
    obtenerTodos() {
      return Promise.resolve(registros)
    },
    marcarExportados() {
      return Promise.resolve()
    },
    actualizar(id, cambios: CambiosMovimiento) {
      const indice = registros.findIndex((item) => item.id === id)
      registros[indice] = { ...registros[indice], ...cambios }
      return Promise.resolve()
    },
    eliminar(id) {
      const indice = registros.findIndex((item) => item.id === id)
      registros.splice(indice, 1)
      return Promise.resolve()
    },
  }
}

describe('MovimientoService', () => {
  it('crea movimientos pendientes con UUID y valores normalizados', async () => {
    const repository = crearRepository()
    const service = new MovimientoService(repository)

    const movimiento = await service.crear(crearDatos())

    expect(movimiento.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(movimiento.estadoExportacion).toBe('pendiente')
    expect(movimiento.concepto).toBe('Transporte')
    expect(movimiento.notas).toBeUndefined()
    expect(repository.registros).toHaveLength(1)
  })

  it('impide editar o eliminar movimientos exportados', async () => {
    const exportado: Movimiento = {
      ...crearDatos(),
      concepto: 'Transporte',
      id: crypto.randomUUID(),
      estadoExportacion: 'exportado',
      creadoEn: new Date().toISOString(),
      actualizadoEn: new Date().toISOString(),
    }
    const service = new MovimientoService(crearRepository([exportado]))

    await expect(service.actualizar(exportado.id, crearDatos())).rejects.toBeInstanceOf(
      MovimientoNoEditableError,
    )
    await expect(service.eliminar(exportado.id)).rejects.toBeInstanceOf(
      MovimientoNoEditableError,
    )
  })
})
