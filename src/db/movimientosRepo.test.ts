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
})
