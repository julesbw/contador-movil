import { describe, expect, it } from 'vitest'
import type {
  MovimientosRepository,
  PaginaMovimientos,
  CambiosMovimiento,
} from '../db/movimientosRepo'
import type { Movimiento } from '../models/Movimiento'
import type { DatosMovimiento } from './movimientoValidation'
import {
  MovimientoCashCutsNoEditableError,
  MovimientoDesactualizadoError,
  MovimientoNoEditableError,
  MovimientoService,
  MovimientoValidationError,
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

  it('calcula el monto de efectivo desde el desglose al guardar', async () => {
    const repository = crearRepository()
    const service = new MovimientoService(repository)

    const movimiento = await service.crear({
      ...crearDatos(),
      monto: 1,
      billetes: {
        b1000: 1,
        b500: 2,
        b200: 1,
        b100: 0,
        b50: 1,
        b20: 2,
        monedas: 16,
      },
    })

    expect(movimiento.monto).toBe(2306)
  })

  it('normaliza billetes en cero cuando el pago no es efectivo', async () => {
    const repository = crearRepository()
    const service = new MovimientoService(repository)

    const movimiento = await service.crear({
      ...crearDatos(),
      formaPago: 'tarjeta',
      monto: 250,
    })

    expect(movimiento.monto).toBe(250)
    expect(movimiento.billetes).toEqual({
      b1000: 0,
      b500: 0,
      b200: 0,
      b100: 0,
      b50: 0,
      b20: 0,
      monedas: 0,
    })
  })

  it('convierte un desglose inválido en un error de validación controlado', async () => {
    const service = new MovimientoService(crearRepository())
    const datos = {
      ...crearDatos(),
      billetes: {
        ...crearDatos().billetes,
        monedas: 0.001,
      },
    }

    expect(service.validar(datos).errores).toContain(
      'El desglose de efectivo contiene valores inválidos',
    )
    await expect(service.crear(datos)).rejects.toBeInstanceOf(
      MovimientoValidationError,
    )
  })

  it('rechaza fechas calendario inexistentes', async () => {
    const service = new MovimientoService(crearRepository())

    await expect(
      service.crear({
        ...crearDatos(),
        fechaMovimiento: '2026-02-30',
      }),
    ).rejects.toBeInstanceOf(MovimientoValidationError)
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

    await expect(
      service.actualizar(
        exportado.id,
        crearDatos(),
        exportado.actualizadoEn,
      ),
    ).rejects.toBeInstanceOf(MovimientoNoEditableError)
    await expect(
      service.eliminar(exportado.id, exportado.actualizadoEn),
    ).rejects.toBeInstanceOf(MovimientoNoEditableError)
  })

  it('restringe la edición financiera de movimientos generados desde cortes', async () => {
    const movimiento: Movimiento = {
      ...crearDatos(),
      id: 'movement-from-cuts',
      tipo: 'entrada',
      concepto: 'Corte original',
      categoria: 'Corte de caja',
      source: {
        type: 'cash-cuts',
        cashCutIds: ['cut-1', 'cut-2'],
      },
      estadoExportacion: 'pendiente',
      creadoEn: '2026-07-26T12:00:00.000Z',
      actualizadoEn: '2026-07-26T12:00:00.000Z',
    }
    const repository = crearRepository([movimiento])
    const service = new MovimientoService(repository)
    const datosEditados: DatosMovimiento = {
      tipo: movimiento.tipo,
      fechaMovimiento: '2026-07-27',
      monto: movimiento.monto,
      concepto: 'Corte actualizado',
      categoria: movimiento.categoria,
      formaPago: movimiento.formaPago,
      billetes: { ...movimiento.billetes },
      notas: 'Solo metadatos',
    }

    const updated = await service.actualizar(
      movimiento.id,
      datosEditados,
      movimiento.actualizadoEn,
    )

    expect(updated).toMatchObject({
      fechaMovimiento: '2026-07-27',
      concepto: 'Corte actualizado',
      notas: 'Solo metadatos',
      monto: movimiento.monto,
      billetes: movimiento.billetes,
      source: movimiento.source,
    })

    await expect(
      service.actualizar(
        movimiento.id,
        {
          ...datosEditados,
          monto: 200,
          billetes: {
            ...datosEditados.billetes,
            b100: 2,
          },
        },
        updated.actualizadoEn,
      ),
    ).rejects.toBeInstanceOf(MovimientoCashCutsNoEditableError)
  })

  it('rechaza editar desde una vista anterior a otro cambio', async () => {
    const movimiento: Movimiento = {
      ...crearDatos(),
      concepto: 'Versión original',
      id: 'stale-edit',
      estadoExportacion: 'pendiente',
      creadoEn: '2026-07-26T12:00:00.000Z',
      actualizadoEn: '2026-07-26T12:00:00.000Z',
    }
    const repository = crearRepository([movimiento])
    const service = new MovimientoService(repository)

    repository.registros[0] = {
      ...repository.registros[0]!,
      concepto: 'Cambio de otra pestaña',
      actualizadoEn: '2026-07-26T12:01:00.000Z',
    }

    await expect(
      service.actualizar(
        movimiento.id,
        crearDatos(),
        movimiento.actualizadoEn,
      ),
    ).rejects.toBeInstanceOf(MovimientoDesactualizadoError)
    expect(repository.registros[0]?.concepto).toBe(
      'Cambio de otra pestaña',
    )
  })

  it('rechaza borrar una versión más reciente desde una vista obsoleta', async () => {
    const movimiento: Movimiento = {
      ...crearDatos(),
      concepto: 'Movimiento vigente',
      id: 'stale-delete',
      estadoExportacion: 'pendiente',
      creadoEn: '2026-07-26T12:00:00.000Z',
      actualizadoEn: '2026-07-26T12:00:00.000Z',
    }
    const repository = crearRepository([movimiento])
    const service = new MovimientoService(repository)

    repository.registros[0] = {
      ...repository.registros[0]!,
      actualizadoEn: '2026-07-26T12:01:00.000Z',
    }

    await expect(
      service.eliminar(movimiento.id, movimiento.actualizadoEn),
    ).rejects.toBeInstanceOf(MovimientoDesactualizadoError)
    expect(repository.registros).toHaveLength(1)
  })
})
