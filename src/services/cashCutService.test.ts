import { describe, expect, it } from 'vitest'
import type {
  CambiosCashCut,
  CashCutSnapshot,
  CashCutsRepository,
} from '../db/cashCutsRepo'
import {
  CashCutNoEncontradoError,
  CashCutNoPendienteError,
} from '../db/cashCutsRepo'
import type { CashCut, CashCutStatus } from '../models/CashCut'
import {
  crearDesgloseEfectivoVacio,
  type DesgloseEfectivo,
} from '../models/Efectivo'
import type { Movimiento } from '../models/Movimiento'
import {
  CashCutAlreadyIncludedError,
  CashCutsDifferentStoresError,
} from './cashCutDomain'
import {
  CashCutConflictError,
  CashCutService,
} from './cashCutService'

function breakdown(
  changes: Partial<DesgloseEfectivo> = {},
): DesgloseEfectivo {
  return {
    ...crearDesgloseEfectivoVacio(),
    ...changes,
  }
}

function cut(id: string, storeName = 'Tienda Centro'): CashCut {
  return {
    id,
    date: '2026-07-26T18:00:00.000Z',
    concept: `Corte ${id}`,
    storeName,
    countedBreakdown: breakdown({ b500: 2 }),
    countedAmount: 1000,
    fundBreakdown: breakdown({ b500: 1 }),
    fundAmount: 500,
    withdrawnBreakdown: breakdown({ b500: 1 }),
    withdrawnAmount: 500,
    status: 'pending',
    createdAt: '2026-07-26T18:00:00.000Z',
    updatedAt: '2026-07-26T18:00:00.000Z',
  }
}

function createRepository(initial: CashCut[] = []): {
  repository: CashCutsRepository
  records: CashCut[]
  consolidated: Movimiento[]
} {
  const records = initial.map((item) => ({ ...item }))
  const consolidated: Movimiento[] = []

  const repository: CashCutsRepository = {
    guardar(cashCut) {
      records.push(cashCut)
      return Promise.resolve(cashCut.id)
    },
    obtenerPorId(id) {
      return Promise.resolve(records.find((item) => item.id === id))
    },
    obtenerPorEstado(status: CashCutStatus) {
      return Promise.resolve(
        records.filter((item) => item.status === status),
      )
    },
    obtenerTodos() {
      return Promise.resolve(records)
    },
    actualizarPendiente(
      id: string,
      changes: CambiosCashCut,
    ) {
      const current = records.find((item) => item.id === id)

      if (current) {
        Object.assign(current, changes)
      }

      return Promise.resolve()
    },
    eliminarPendiente(id) {
      const index = records.findIndex((item) => item.id === id)

      if (index >= 0) {
        records.splice(index, 1)
      }

      return Promise.resolve()
    },
    consolidar(
      movimiento: Movimiento,
      expectedCuts: readonly CashCutSnapshot[],
    ) {
      consolidated.push(movimiento)

      for (const expected of expectedCuts) {
        const current = records.find(
          (item) => item.id === expected.id,
        )

        if (current) {
          current.status = 'included'
          current.movementId = movimiento.id
        }
      }

      return Promise.resolve()
    },
  }

  return { repository, records, consolidated }
}

describe('CashCutService', () => {
  it('crea, actualiza y elimina cortes pendientes', async () => {
    const state = createRepository()
    const service = new CashCutService(state.repository)
    const created = await service.crear({
      date: '2026-07-26T18:00:00.000Z',
      storeName: ' Tienda Centro ',
      countedBreakdown: breakdown({ b500: 2 }),
      fundBreakdown: breakdown({ b500: 1 }),
    })

    expect(created.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    expect(state.records).toHaveLength(1)
    expect(created.withdrawnAmount).toBe(500)

    const updated = await service.actualizar(
      created.id,
      {
        date: created.date,
        concept: 'Cierre actualizado',
        storeName: 'Tienda Centro',
        countedBreakdown: breakdown({ b500: 4 }),
        fundBreakdown: breakdown({ b500: 1 }),
      },
      created.updatedAt,
    )

    expect(updated).toMatchObject({
      id: created.id,
      concept: 'Cierre actualizado',
      countedAmount: 2000,
      fundAmount: 500,
      withdrawnAmount: 1500,
      createdAt: created.createdAt,
    })
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(
      Date.parse(updated.createdAt),
    )

    await service.eliminar(created.id, updated.updatedAt)

    expect(state.records).toHaveLength(0)
  })

  it('crea un movimiento y delega la inclusión atómica', async () => {
    const first = cut('cut-1')
    const second = cut('cut-2')
    const state = createRepository([first, second])
    const service = new CashCutService(state.repository)
    const movimiento = await service.crearMovimiento(
      [first.id, second.id],
      {
        concept: 'Corte de Caja Tienda Centro',
        date: '2026-07-26',
      },
    )

    expect(movimiento).toMatchObject({
      tipo: 'entrada',
      categoria: 'Corte de caja',
      monto: 1000,
      source: {
        type: 'cash-cuts',
        cashCutIds: ['cut-1', 'cut-2'],
      },
    })
    expect(state.consolidated).toEqual([movimiento])
    expect(
      state.records.every(
        (item) =>
          item.status === 'included' &&
          item.movementId === movimiento.id,
      ),
    ).toBe(true)
  })

  it('rechaza cortes inexistentes o de tiendas distintas antes de persistir', async () => {
    const state = createRepository([
      cut('center'),
      cut('north', 'Tienda Norte'),
    ])
    const service = new CashCutService(state.repository)
    const input = {
      concept: 'Corte',
      date: '2026-07-26',
    }

    await expect(
      service.crearMovimiento(['missing'], input),
    ).rejects.toBeInstanceOf(CashCutNoEncontradoError)
    await expect(
      service.crearMovimiento(['center', 'north'], input),
    ).rejects.toBeInstanceOf(CashCutsDifferentStoresError)
    expect(state.consolidated).toHaveLength(0)
  })

  it('conserva el updatedAt de la UI como control de concurrencia', async () => {
    const current = cut('cut-stale')
    const state = createRepository([current])
    const service = new CashCutService(state.repository)
    const input = {
      date: current.date,
      concept: current.concept,
      storeName: current.storeName,
      countedBreakdown: current.countedBreakdown,
      fundBreakdown: current.fundBreakdown,
    }

    await expect(
      service.actualizar(current.id, input, 'snapshot-obsoleto'),
    ).rejects.toBeInstanceOf(CashCutConflictError)
    await expect(
      service.eliminar(current.id, 'snapshot-obsoleto'),
    ).rejects.toBeInstanceOf(CashCutConflictError)
    expect(state.records).toEqual([current])
  })

  it('traduce conflictos transaccionales a errores de dominio', async () => {
    const current = cut('cut-race')
    const state = createRepository([current])
    const repository: CashCutsRepository = {
      ...state.repository,
      consolidar() {
        return Promise.reject(
          new CashCutNoPendienteError(current.id),
        )
      },
    }
    const service = new CashCutService(repository)

    await expect(
      service.crearMovimiento([current.id], {
        concept: 'Corte de Caja Tienda Centro',
        date: '2026-07-26',
      }),
    ).rejects.toBeInstanceOf(CashCutAlreadyIncludedError)
  })
})
