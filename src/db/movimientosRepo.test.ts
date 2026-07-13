import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { Movimiento } from '../models/Movimiento'
import { db } from './db'
import { movimientosRepo } from './movimientosRepo'

function crearMovimiento(id: string): Movimiento {
  const ahora = new Date().toISOString()

  return {
    id,
    tipo: 'salida',
    fechaMovimiento: '2026-07-08',
    monto: 100,
    concepto: `Movimiento ${id}`,
    categoria: 'Otros',
    formaPago: 'otro',
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
    creadoEn: ahora,
    actualizadoEn: ahora,
  }
}

beforeEach(async () => {
  db.close()
  await db.delete()
  await db.open()
})

afterAll(async () => {
  db.close()
  await db.delete()
})

describe('movimientosRepo', () => {
  it('pagina los movimientos sin cargar la tabla completa', async () => {
    await movimientosRepo.guardar(crearMovimiento('a'))
    await movimientosRepo.guardar(
      { ...crearMovimiento('b'), fechaMovimiento: '2026-07-09' },
    )

    const pagina = await movimientosRepo.obtenerPagina({
      pagina: 0,
      tamanoPagina: 1,
    })

    expect(pagina).toHaveLength(1)
    expect(pagina[0]?.id).toBe('b')
  })

  it('marca un lote completo como exportado', async () => {
    await movimientosRepo.guardar(crearMovimiento('a'))
    await movimientosRepo.guardar(crearMovimiento('b'))

    await movimientosRepo.marcarExportados(
      ['a', 'b'],
      'lote-1',
      '2026-07-08T12:00:00.000Z',
    )

    const movimientos = await movimientosRepo.obtenerTodos()

    expect(movimientos).toHaveLength(2)
    expect(
      movimientos.every(
        ({ estadoExportacion, loteExportacionId }) =>
          estadoExportacion === 'exportado' &&
          loteExportacionId === 'lote-1',
      ),
    ).toBe(true)
  })

  it('mantiene pendiente un movimiento que no pertenece al lote', async () => {
    await movimientosRepo.guardar(crearMovimiento('seleccionado'))
    await movimientosRepo.guardar(crearMovimiento('pendiente'))

    await movimientosRepo.marcarExportados(
      ['seleccionado'],
      'lote-parcial',
      '2026-07-08T12:00:00.000Z',
    )

    expect(await movimientosRepo.obtenerPorId('seleccionado')).toMatchObject({
      estadoExportacion: 'exportado',
      loteExportacionId: 'lote-parcial',
    })
    const noSeleccionado = await movimientosRepo.obtenerPorId('pendiente')

    expect(noSeleccionado).toMatchObject({
      estadoExportacion: 'pendiente',
    })
    expect(noSeleccionado?.loteExportacionId).toBeUndefined()
  })

  it('no actualiza parcialmente un lote desactualizado', async () => {
    await movimientosRepo.guardar(crearMovimiento('vigente'))
    await movimientosRepo.guardar({
      ...crearMovimiento('ya-exportado'),
      estadoExportacion: 'exportado',
    })

    await expect(
      movimientosRepo.marcarExportados(
        ['vigente', 'ya-exportado'],
        'lote-invalido',
        '2026-07-08T12:00:00.000Z',
      ),
    ).rejects.toThrow('ya no están pendientes')

    expect(await movimientosRepo.obtenerPorId('vigente')).toMatchObject({
      estadoExportacion: 'pendiente',
    })
  })
})
