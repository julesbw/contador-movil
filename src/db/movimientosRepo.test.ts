import 'fake-indexeddb/auto'
import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { CashCut } from '../models/CashCut'
import type { Movimiento } from '../models/Movimiento'
import { db } from './db'
import {
  MovimientoActualizacionDesactualizadaError,
  MovimientoCashCutsInconsistenteError,
  MovimientoEliminacionDesactualizadaError,
  MovimientosLoteDesactualizadoError,
  movimientosRepo,
} from './movimientosRepo'

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

function crearCorteIncluido(
  id: string,
  movementId: string,
): CashCut {
  const ahora = '2026-07-08T12:00:00.000Z'
  const breakdown = {
    b1000: 0,
    b500: 0,
    b200: 0,
    b100: 1,
    b50: 0,
    b20: 0,
    monedas: 0,
  }

  return {
    id,
    date: ahora,
    concept: `Corte ${id}`,
    countedBreakdown: breakdown,
    countedAmount: 100,
    fundBreakdown: {
      ...breakdown,
      b100: 0,
    },
    fundAmount: 0,
    withdrawnBreakdown: breakdown,
    withdrawnAmount: 100,
    status: 'included',
    movementId,
    createdAt: ahora,
    updatedAt: ahora,
  }
}

function snapshot(movimiento: Movimiento) {
  return {
    id: movimiento.id,
    actualizadoEn: movimiento.actualizadoEn,
  }
}

beforeEach(async () => {
  vi.restoreAllMocks()
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
    const movimientos = [crearMovimiento('a'), crearMovimiento('b')]

    await db.movimientos.bulkAdd(movimientos)

    await movimientosRepo.marcarExportados(
      movimientos.map(snapshot),
      'lote-1',
      '2026-07-08T12:00:00.000Z',
    )

    const guardados = await movimientosRepo.obtenerTodos()

    expect(guardados).toHaveLength(2)
    expect(
      guardados.every(
        ({ estadoExportacion, loteExportacionId }) =>
          estadoExportacion === 'exportado' &&
          loteExportacionId === 'lote-1',
      ),
    ).toBe(true)
  })

  it('mantiene pendiente un movimiento que no pertenece al lote', async () => {
    const seleccionado = crearMovimiento('seleccionado')

    await movimientosRepo.guardar(seleccionado)
    await movimientosRepo.guardar(crearMovimiento('pendiente'))

    await movimientosRepo.marcarExportados(
      [snapshot(seleccionado)],
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
    const vigente = crearMovimiento('vigente')
    const exportado = {
      ...crearMovimiento('ya-exportado'),
      estadoExportacion: 'exportado' as const,
    }

    await movimientosRepo.guardar(vigente)
    await movimientosRepo.guardar(exportado)

    await expect(
      movimientosRepo.marcarExportados(
        [snapshot(vigente), snapshot(exportado)],
        'lote-invalido',
        '2026-07-08T12:00:00.000Z',
      ),
    ).rejects.toThrow('ya no están pendientes')

    expect(await movimientosRepo.obtenerPorId('vigente')).toMatchObject({
      estadoExportacion: 'pendiente',
    })
  })

  it('rechaza atómicamente la confirmación de un snapshot editado', async () => {
    const vigente = crearMovimiento('vigente')
    const editado = crearMovimiento('editado')
    const snapshots = [snapshot(vigente), snapshot(editado)]

    await db.movimientos.bulkAdd([vigente, editado])
    await movimientosRepo.actualizar(
      editado.id,
      {
        concepto: 'Editado después de descargar',
        actualizadoEn: new Date(
          Date.parse(editado.actualizadoEn) + 1,
        ).toISOString(),
      },
      editado.actualizadoEn,
    )

    await expect(
      movimientosRepo.marcarExportados(
        snapshots,
        'lote-obsoleto',
        '2026-07-08T12:02:00.000Z',
      ),
    ).rejects.toBeInstanceOf(MovimientosLoteDesactualizadoError)

    expect(
      (await db.movimientos.toArray()).every(
        ({ estadoExportacion }) =>
          estadoExportacion === 'pendiente',
      ),
    ).toBe(true)
  })

  it('impide que una edición concurrente sobrescriba la exportación confirmada', async () => {
    const movimiento = crearMovimiento('carrera-exportacion')
    const expectedActualizadoEn = movimiento.actualizadoEn

    await movimientosRepo.guardar(movimiento)
    await movimientosRepo.marcarExportados(
      [snapshot(movimiento)],
      'lote-carrera',
      '2026-07-08T12:00:00.000Z',
    )

    await expect(
      movimientosRepo.actualizar(
        movimiento.id,
        {
          concepto: 'No debe persistirse',
          actualizadoEn: new Date(
            Date.parse(expectedActualizadoEn) + 1,
          ).toISOString(),
        },
        expectedActualizadoEn,
      ),
    ).rejects.toBeInstanceOf(
      MovimientoActualizacionDesactualizadaError,
    )

    expect(await movimientosRepo.obtenerPorId(movimiento.id)).toMatchObject({
      concepto: movimiento.concepto,
      estadoExportacion: 'exportado',
      loteExportacionId: 'lote-carrera',
    })
  })

  it('revierte sus cortes incluidos al eliminar un movimiento pendiente', async () => {
    const movimiento = {
      ...crearMovimiento('movimiento-cortes'),
      source: {
        type: 'cash-cuts' as const,
        cashCutIds: ['corte-1', 'corte-2'],
      },
    }
    const cortes = movimiento.source.cashCutIds.map((id) =>
      crearCorteIncluido(id, movimiento.id),
    )

    await db.movimientos.add(movimiento)
    await db.cashCuts.bulkAdd(cortes)

    await movimientosRepo.eliminar(
      movimiento.id,
      movimiento.actualizadoEn,
    )

    expect(await db.movimientos.get(movimiento.id)).toBeUndefined()

    const cortesRevertidos = await db.cashCuts.bulkGet(
      cortes.map(({ id }) => id),
    )

    expect(
      cortesRevertidos.every(
        (cashCut) =>
          cashCut?.status === 'pending' &&
          cashCut.movementId === undefined,
      ),
    ).toBe(true)
  })

  it('rechaza una eliminación con snapshot obsoleto sin revertir cortes', async () => {
    const cashCut = crearCorteIncluido(
      'corte-edicion',
      'movimiento-edicion',
    )
    const movimiento: Movimiento = {
      ...crearMovimiento(cashCut.movementId!),
      source: {
        type: 'cash-cuts',
        cashCutIds: [cashCut.id],
      },
    }
    const snapshotAnterior = movimiento.actualizadoEn
    const actualizadoEn = new Date(
      Date.parse(snapshotAnterior) + 1,
    ).toISOString()

    await db.movimientos.add(movimiento)
    await db.cashCuts.add(cashCut)
    await movimientosRepo.actualizar(
      movimiento.id,
      {
        concepto: 'Movimiento actualizado',
        actualizadoEn,
      },
      snapshotAnterior,
    )

    await expect(
      movimientosRepo.eliminar(
        movimiento.id,
        snapshotAnterior,
      ),
    ).rejects.toBeInstanceOf(MovimientoEliminacionDesactualizadaError)

    expect(await db.movimientos.get(movimiento.id)).toMatchObject({
      concepto: 'Movimiento actualizado',
      actualizadoEn,
    })
    expect(await db.cashCuts.get(cashCut.id)).toEqual(cashCut)
  })

  it('permite revertir tras descargar y rechaza confirmar después la versión eliminada', async () => {
    const cashCut = crearCorteIncluido(
      'corte-descargado',
      'movimiento-descargado',
    )
    const movimiento: Movimiento = {
      ...crearMovimiento(cashCut.movementId!),
      source: {
        type: 'cash-cuts',
        cashCutIds: [cashCut.id],
      },
    }
    const downloadedSnapshot = snapshot(movimiento)

    await db.movimientos.add(movimiento)
    await db.cashCuts.add(cashCut)

    await movimientosRepo.eliminar(
      movimiento.id,
      movimiento.actualizadoEn,
    )

    await expect(
      movimientosRepo.marcarExportados(
        [downloadedSnapshot],
        'lote-descargado',
        '2026-07-26T13:00:00.000Z',
      ),
    ).rejects.toBeInstanceOf(MovimientosLoteDesactualizadoError)

    expect(await db.movimientos.get(movimiento.id)).toBeUndefined()
    expect(await db.cashCuts.get(cashCut.id)).toMatchObject({
      status: 'pending',
    })
  })

  it('no elimina un movimiento confirmado como exportado ni revierte sus cortes', async () => {
    const cashCut = crearCorteIncluido(
      'corte-exportado',
      'movimiento-exportado',
    )
    const movimiento: Movimiento = {
      ...crearMovimiento(cashCut.movementId!),
      estadoExportacion: 'exportado',
      exportadoEn: '2026-07-08T13:00:00.000Z',
      source: {
        type: 'cash-cuts',
        cashCutIds: [cashCut.id],
      },
    }

    await db.movimientos.add(movimiento)
    await db.cashCuts.add(cashCut)

    await expect(
      movimientosRepo.eliminar(
        movimiento.id,
        movimiento.actualizadoEn,
      ),
    ).rejects.toBeInstanceOf(MovimientoEliminacionDesactualizadaError)

    expect(await db.movimientos.get(movimiento.id)).toEqual(movimiento)
    expect(await db.cashCuts.get(cashCut.id)).toEqual(cashCut)
  })

  it('aborta sin cambios parciales si la relación con cortes es inconsistente', async () => {
    const movimiento: Movimiento = {
      ...crearMovimiento('movimiento-inconsistente'),
      source: {
        type: 'cash-cuts',
        cashCutIds: ['corte-existente', 'corte-faltante'],
      },
    }
    const cashCut = crearCorteIncluido(
      'corte-existente',
      movimiento.id,
    )

    await db.movimientos.add(movimiento)
    await db.cashCuts.add(cashCut)

    await expect(
      movimientosRepo.eliminar(
        movimiento.id,
        movimiento.actualizadoEn,
      ),
    ).rejects.toBeInstanceOf(MovimientoCashCutsInconsistenteError)

    expect(await db.movimientos.get(movimiento.id)).toEqual(movimiento)
    expect(await db.cashCuts.get(cashCut.id)).toEqual(cashCut)
  })

  it('revierte la restauración de cortes si falla la eliminación del movimiento', async () => {
    const cashCut = crearCorteIncluido(
      'corte-rollback',
      'movimiento-rollback',
    )
    const movimiento: Movimiento = {
      ...crearMovimiento(cashCut.movementId!),
      source: {
        type: 'cash-cuts',
        cashCutIds: [cashCut.id],
      },
    }

    await db.movimientos.add(movimiento)
    await db.cashCuts.add(cashCut)
    vi.spyOn(db.movimientos, 'delete').mockRejectedValueOnce(
      new Error('Fallo simulado'),
    )

    await expect(
      movimientosRepo.eliminar(
        movimiento.id,
        movimiento.actualizadoEn,
      ),
    ).rejects.toThrow('Fallo simulado')

    expect(await db.movimientos.get(movimiento.id)).toEqual(movimiento)
    expect(await db.cashCuts.get(cashCut.id)).toEqual(cashCut)
  })
})
