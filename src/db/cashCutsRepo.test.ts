import 'fake-indexeddb/auto'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CashCut } from '../models/CashCut'
import type { Billetes, Movimiento } from '../models/Movimiento'
import {
  CashCutDesactualizadoError,
  CashCutNoPendienteError,
  CashCutsDuplicadosError,
  CashCutsMovimientoInconsistenteError,
  CashCutsTiendasDistintasError,
  cashCutsRepo,
} from './cashCutsRepo'
import { db } from './db'

const BREAKDOWN_VACIO: Billetes = {
  b1000: 0,
  b500: 0,
  b200: 0,
  b100: 0,
  b50: 0,
  b20: 0,
  monedas: 0,
}

function crearCorte(
  id: string,
  opciones: Partial<CashCut> = {},
): CashCut {
  const ahora = '2026-07-26T12:00:00.000Z'
  const withdrawnBreakdown = {
    ...BREAKDOWN_VACIO,
    b100: 1,
    monedas: 0.25,
  }

  return {
    id,
    date: '2026-07-26T11:00:00.000Z',
    concept: `Corte ${id}`,
    storeId: 'tienda-1',
    storeName: 'Tienda 1',
    countedBreakdown: {
      ...BREAKDOWN_VACIO,
      b100: 2,
      monedas: 0.25,
    },
    countedAmount: 200.25,
    fundBreakdown: {
      ...BREAKDOWN_VACIO,
      b100: 1,
    },
    fundAmount: 100,
    withdrawnBreakdown,
    withdrawnAmount: 100.25,
    status: 'pending',
    createdAt: ahora,
    updatedAt: ahora,
    ...opciones,
  }
}

function sumarBreakdowns(cortes: readonly CashCut[]): Billetes {
  return cortes.reduce<Billetes>(
    (suma, { withdrawnBreakdown }) => ({
      b1000: suma.b1000 + withdrawnBreakdown.b1000,
      b500: suma.b500 + withdrawnBreakdown.b500,
      b200: suma.b200 + withdrawnBreakdown.b200,
      b100: suma.b100 + withdrawnBreakdown.b100,
      b50: suma.b50 + withdrawnBreakdown.b50,
      b20: suma.b20 + withdrawnBreakdown.b20,
      monedas:
        Math.round(
          (suma.monedas + withdrawnBreakdown.monedas) * 100,
        ) / 100,
    }),
    { ...BREAKDOWN_VACIO },
  )
}

function crearMovimiento(
  id: string,
  cortes: readonly CashCut[],
): Movimiento {
  const ahora = '2026-07-26T12:05:00.000Z'

  return {
    id,
    tipo: 'entrada',
    fechaMovimiento: '2026-07-26',
    monto:
      cortes.reduce(
        (centavos, { withdrawnAmount }) =>
          centavos + Math.round(withdrawnAmount * 100),
        0,
      ) / 100,
    concepto: 'Corte de Caja Tienda 1',
    categoria: 'Corte de caja',
    formaPago: 'efectivo',
    billetes: sumarBreakdowns(cortes),
    estadoExportacion: 'pendiente',
    source: {
      type: 'cash-cuts',
      cashCutIds: cortes.map(({ id: cashCutId }) => cashCutId),
    },
    creadoEn: ahora,
    actualizadoEn: ahora,
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

describe('cashCutsRepo', () => {
  it('guarda, actualiza y elimina un corte pendiente con control optimista', async () => {
    const cashCut = crearCorte('corte-1')

    await cashCutsRepo.guardar(cashCut)
    await cashCutsRepo.actualizarPendiente(
      cashCut.id,
      {
        concept: 'Corte corregido',
        updatedAt: '2026-07-26T12:01:00.000Z',
      },
      cashCut.updatedAt,
    )

    expect(await cashCutsRepo.obtenerPorId(cashCut.id)).toMatchObject({
      concept: 'Corte corregido',
      status: 'pending',
      updatedAt: '2026-07-26T12:01:00.000Z',
    })

    await cashCutsRepo.eliminarPendiente(
      cashCut.id,
      '2026-07-26T12:01:00.000Z',
    )

    expect(await cashCutsRepo.obtenerPorId(cashCut.id)).toBeUndefined()
  })

  it('rechaza cambios obsoletos y protege los cortes incluidos', async () => {
    const pending = crearCorte('pendiente')
    const included = crearCorte('incluido', {
      status: 'included',
      movementId: 'movimiento-1',
    })

    await db.cashCuts.bulkAdd([pending, included])

    await expect(
      cashCutsRepo.actualizarPendiente(
        pending.id,
        {
          concept: 'No debe guardarse',
          updatedAt: '2026-07-26T12:01:00.000Z',
        },
        'timestamp-obsoleto',
      ),
    ).rejects.toBeInstanceOf(CashCutDesactualizadoError)
    await expect(
      cashCutsRepo.actualizarPendiente(
        pending.id,
        {
          concept: 'Tampoco debe guardarse',
          updatedAt: pending.updatedAt,
        },
        pending.updatedAt,
      ),
    ).rejects.toBeInstanceOf(CashCutDesactualizadoError)
    await expect(
      cashCutsRepo.eliminarPendiente(
        included.id,
        included.updatedAt,
      ),
    ).rejects.toBeInstanceOf(CashCutNoPendienteError)

    expect(await cashCutsRepo.obtenerPorId(pending.id)).toMatchObject({
      concept: pending.concept,
    })
    expect(await cashCutsRepo.obtenerPorId(included.id)).toBeDefined()
  })

  it('consolida varios cortes y asigna la relación en una transacción', async () => {
    const cortes = [
      crearCorte('corte-1'),
      crearCorte('corte-2', {
        countedBreakdown: {
          ...BREAKDOWN_VACIO,
          b50: 2,
          monedas: 0.1,
        },
        countedAmount: 100.1,
        fundBreakdown: { ...BREAKDOWN_VACIO },
        fundAmount: 0,
        withdrawnBreakdown: {
          ...BREAKDOWN_VACIO,
          b50: 2,
          monedas: 0.1,
        },
        withdrawnAmount: 100.1,
      }),
    ]
    const movimiento = crearMovimiento('movimiento-1', cortes)

    await db.cashCuts.bulkAdd(cortes)
    await cashCutsRepo.consolidar(movimiento, cortes)

    expect(await db.movimientos.get(movimiento.id)).toEqual(movimiento)
    expect(await db.cashCuts.bulkGet(cortes.map(({ id }) => id))).toEqual(
      cortes.map((cashCut) =>
        expect.objectContaining({
          id: cashCut.id,
          status: 'included',
          movementId: movimiento.id,
        }),
      ),
    )
  })

  it('evita doble inclusión ante consolidaciones concurrentes', async () => {
    const cashCut = crearCorte('corte-concurrente')
    const movimientos = [
      crearMovimiento('movimiento-a', [cashCut]),
      crearMovimiento('movimiento-b', [cashCut]),
    ]

    await db.cashCuts.add(cashCut)

    const resultados = await Promise.allSettled(
      movimientos.map((movimiento) =>
        cashCutsRepo.consolidar(movimiento, [cashCut]),
      ),
    )

    expect(
      resultados.filter(({ status }) => status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      resultados.filter(({ status }) => status === 'rejected'),
    ).toHaveLength(1)

    const corteGuardado = await db.cashCuts.get(cashCut.id)
    const movimientosGuardados = await db.movimientos.toArray()

    expect(corteGuardado).toMatchObject({
      status: 'included',
      movementId: movimientosGuardados[0]?.id,
    })
    expect(movimientosGuardados).toHaveLength(1)
  })

  it('rechaza cortes duplicados o de tiendas distintas sin cambios parciales', async () => {
    const cortes = [
      crearCorte('tienda-1'),
      crearCorte('tienda-2', {
        storeId: 'tienda-2',
        storeName: 'Tienda 2',
      }),
    ]

    await db.cashCuts.bulkAdd(cortes)

    await expect(
      cashCutsRepo.consolidar(
        crearMovimiento('movimiento-duplicado', [
          cortes[0]!,
          cortes[0]!,
        ]),
        [cortes[0]!, cortes[0]!],
      ),
    ).rejects.toBeInstanceOf(CashCutsDuplicadosError)

    await expect(
      cashCutsRepo.consolidar(
        crearMovimiento('movimiento-tiendas', cortes),
        cortes,
      ),
    ).rejects.toBeInstanceOf(CashCutsTiendasDistintasError)

    expect(await db.movimientos.count()).toBe(0)
    expect(
      (await db.cashCuts.toArray()).every(
        ({ status, movementId }) =>
          status === 'pending' && movementId === undefined,
      ),
    ).toBe(true)
  })

  it('rechaza snapshots obsoletos y fuentes inconsistentes', async () => {
    const cashCut = crearCorte('corte-1')

    await db.cashCuts.add(cashCut)

    await expect(
      cashCutsRepo.consolidar(crearMovimiento('obsoleto', [cashCut]), [
        {
          ...cashCut,
          updatedAt: '2026-07-26T11:59:00.000Z',
        },
      ]),
    ).rejects.toBeInstanceOf(CashCutDesactualizadoError)

    await expect(
      cashCutsRepo.consolidar(
        {
          ...crearMovimiento('source-invalido', [cashCut]),
          source: {
            type: 'cash-cuts',
            cashCutIds: ['otro-corte'],
          },
        },
        [cashCut],
      ),
    ).rejects.toBeInstanceOf(CashCutsMovimientoInconsistenteError)

    expect(await db.movimientos.count()).toBe(0)
    expect(await db.cashCuts.get(cashCut.id)).toEqual(cashCut)
  })

  it('recalcula montos y desgloses dentro de la transacción', async () => {
    const cashCut = crearCorte('corte-integridad')
    const movimiento = crearMovimiento(
      'movimiento-inconsistente',
      [cashCut],
    )

    await db.cashCuts.add(cashCut)

    await expect(
      cashCutsRepo.consolidar(
        {
          ...movimiento,
          monto: movimiento.monto + 1,
        },
        [cashCut],
      ),
    ).rejects.toBeInstanceOf(CashCutsMovimientoInconsistenteError)
    await expect(
      cashCutsRepo.consolidar(
        {
          ...movimiento,
          billetes: {
            ...movimiento.billetes,
            monedas: movimiento.billetes.monedas + 0.01,
          },
        },
        [cashCut],
      ),
    ).rejects.toBeInstanceOf(CashCutsMovimientoInconsistenteError)

    await db.cashCuts.update(cashCut.id, {
      withdrawnAmount: cashCut.withdrawnAmount + 10,
    })

    await expect(
      cashCutsRepo.consolidar(movimiento, [cashCut]),
    ).rejects.toBeInstanceOf(CashCutsMovimientoInconsistenteError)

    expect(await db.movimientos.count()).toBe(0)
    expect(await db.cashCuts.get(cashCut.id)).toMatchObject({
      id: cashCut.id,
      status: 'pending',
      withdrawnAmount: cashCut.withdrawnAmount + 10,
    })
  })

  it('revierte el movimiento si falla el guardado final de los cortes', async () => {
    const cashCut = crearCorte('corte-1')
    const movimiento = crearMovimiento('movimiento-1', [cashCut])

    await db.cashCuts.add(cashCut)
    vi.spyOn(db.cashCuts, 'bulkPut').mockRejectedValueOnce(
      new Error('Fallo simulado'),
    )

    await expect(
      cashCutsRepo.consolidar(movimiento, [cashCut]),
    ).rejects.toThrow('Fallo simulado')

    expect(await db.movimientos.get(movimiento.id)).toBeUndefined()
    expect(await db.cashCuts.get(cashCut.id)).toEqual(cashCut)
  })
})
