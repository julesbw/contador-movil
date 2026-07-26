import { describe, expect, it } from 'vitest'
import type { CashCut } from '../models/CashCut'
import {
  cashCutSuggestedConcept,
  fromDateTimeLocal,
  summarizeCashCuts,
  toggleCashCutSelection,
} from './cashCutUi'

function createCut(overrides: Partial<CashCut> = {}): CashCut {
  return {
    id: 'cut-1',
    date: '2026-07-26T18:30:00.000Z',
    concept: 'Corte vespertino',
    storeName: 'Tienda Centro',
    countedBreakdown: {
      b1000: 1,
      b500: 0,
      b200: 0,
      b100: 0,
      b50: 0,
      b20: 0,
      monedas: 0,
    },
    countedAmount: 1000,
    fundBreakdown: {
      b1000: 0,
      b500: 0,
      b200: 0,
      b100: 0,
      b50: 0,
      b20: 0,
      monedas: 0,
    },
    fundAmount: 0,
    withdrawnBreakdown: {
      b1000: 1,
      b500: 0,
      b200: 0,
      b100: 0,
      b50: 0,
      b20: 0,
      monedas: 0,
    },
    withdrawnAmount: 1000,
    status: 'pending',
    createdAt: '2026-07-26T18:30:00.000Z',
    updatedAt: '2026-07-26T18:30:00.000Z',
    ...overrides,
  }
}

describe('cashCutUi', () => {
  it('permite seleccionar varios cortes pendientes de la misma tienda', () => {
    const first = createCut()
    const second = createCut({ id: 'cut-2' })
    const result = toggleCashCutSelection(
      [first.id],
      second,
      [first, second],
    )

    expect(result).toEqual({ selectedIds: ['cut-1', 'cut-2'] })
  })

  it('bloquea la selección de cortes de tiendas distintas', () => {
    const first = createCut()
    const second = createCut({
      id: 'cut-2',
      storeName: 'Tienda Norte',
    })
    const result = toggleCashCutSelection(
      [first.id],
      second,
      [first, second],
    )

    expect(result.selectedIds).toEqual(['cut-1'])
    expect(result.error).toContain('misma tienda')
  })

  it('rechaza un corte incluido y propone concepto con la tienda', () => {
    const cut = createCut({
      status: 'included',
      movementId: 'movement-1',
    })

    expect(toggleCashCutSelection([], cut, [cut]).error).toContain(
      'ya fue incluido',
    )
    expect(cashCutSuggestedConcept([cut])).toBe(
      'Corte de Caja Tienda Centro',
    )
  })

  it('convierte datetime-local a una fecha ISO válida', () => {
    expect(fromDateTimeLocal('2026-07-26T18:30')).toMatch(
      /^2026-07-2[67]T/,
    )
  })

  it('resume monedas en centavos y detecta montos inconsistentes', () => {
    const first = createCut({
      withdrawnBreakdown: {
        b1000: 0,
        b500: 0,
        b200: 0,
        b100: 0,
        b50: 0,
        b20: 0,
        monedas: 0.1,
      },
      withdrawnAmount: 0.1,
    })
    const second = createCut({
      id: 'cut-2',
      withdrawnBreakdown: {
        b1000: 0,
        b500: 0,
        b200: 0,
        b100: 0,
        b50: 0,
        b20: 0,
        monedas: 0.2,
      },
      withdrawnAmount: 0.2,
    })

    expect(summarizeCashCuts([first, second]).amount).toBe(0.3)
    expect(
      summarizeCashCuts([
        { ...first, withdrawnAmount: 50 },
      ]).error,
    ).toContain('no coincide')
  })
})
