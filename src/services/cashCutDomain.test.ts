import { describe, expect, it } from 'vitest'
import type { CashCut } from '../models/CashCut'
import {
  crearDesgloseEfectivoVacio,
  type DesgloseEfectivo,
} from '../models/Efectivo'
import {
  CashCutAlreadyIncludedError,
  CashCutsDifferentStoresError,
  CashCutValidationError,
  crearCorteCaja,
  crearMovimientoDesdeCortes,
  type CreateCashCutInput,
} from './cashCutDomain'

const NOW = '2026-07-26T18:30:00.000Z'

function crearDesglose(
  cambios: Partial<DesgloseEfectivo> = {},
): DesgloseEfectivo {
  return {
    ...crearDesgloseEfectivoVacio(),
    ...cambios,
  }
}

function crearInput(
  cambios: Partial<CreateCashCutInput> = {},
): CreateCashCutInput {
  return {
    date: '2026-07-26T18:00:00.000Z',
    concept: ' Corte vespertino ',
    storeName: ' Tienda Centro ',
    notes: ' Entrega ',
    countedBreakdown: crearDesglose({
      b1000: 2,
      b500: 1,
      monedas: 0.3,
    }),
    fundBreakdown: crearDesglose({
      b500: 1,
      monedas: 0.1,
    }),
    ...cambios,
  }
}

function crearCorte(
  id = 'cut-1',
  cambios: Partial<CashCut> = {},
): CashCut {
  return {
    ...crearCorteCaja(crearInput(), { id, now: NOW }),
    ...cambios,
  }
}

describe('crearCorteCaja', () => {
  it('calcula contado, fondo y retiro por denominación', () => {
    const cashCut = crearCorte()

    expect(cashCut).toMatchObject({
      id: 'cut-1',
      concept: 'Corte vespertino',
      storeName: 'Tienda Centro',
      notes: 'Entrega',
      countedAmount: 2500.3,
      fundAmount: 500.1,
      withdrawnAmount: 2000.2,
      status: 'pending',
      createdAt: NOW,
      updatedAt: NOW,
    })
    expect(cashCut.withdrawnBreakdown).toEqual(
      crearDesglose({ b1000: 2, monedas: 0.2 }),
    )
  })

  it('autogenera concepto y permite retiro cero', () => {
    const breakdown = crearDesglose({ b100: 1 })
    const cashCut = crearCorteCaja(
      crearInput({
        concept: ' ',
        countedBreakdown: breakdown,
        fundBreakdown: breakdown,
      }),
      { id: 'cut-zero', now: NOW },
    )

    expect(cashCut.concept).toBe('Corte de caja Tienda Centro')
    expect(cashCut.withdrawnAmount).toBe(0)
  })

  it('rechaza conteo vacío y fondos superiores al conteo', () => {
    expect(() =>
      crearCorteCaja(
        crearInput({
          countedBreakdown: crearDesglose(),
          fundBreakdown: crearDesglose(),
        }),
        { id: 'empty', now: NOW },
      ),
    ).toThrow(CashCutValidationError)

    expect(() =>
      crearCorteCaja(
        crearInput({
          countedBreakdown: crearDesglose({ b100: 1 }),
          fundBreakdown: crearDesglose({ b100: 2 }),
        }),
        { id: 'invalid-fund', now: NOW },
      ),
    ).toThrow(CashCutValidationError)
  })

  it('exige una fecha y hora reales para el corte', () => {
    expect(() =>
      crearCorteCaja(
        crearInput({ date: '2026-07-26' }),
        { id: 'date-only', now: NOW },
      ),
    ).toThrow(CashCutValidationError)
    expect(() =>
      crearCorteCaja(
        crearInput({ date: '2026-02-30T12:00:00.000Z' }),
        { id: 'invalid-date', now: NOW },
      ),
    ).toThrow(CashCutValidationError)
  })
})

describe('crearMovimientoDesdeCortes', () => {
  const inputMovimiento = {
    concept: ' Corte de Caja Tienda Centro ',
    date: '2026-07-26',
    notes: ' Dos turnos ',
  }

  it('consolida uno o varios cortes pendientes de la misma tienda', () => {
    const first = crearCorte('cut-1')
    const second = crearCorte('cut-2')
    const movimiento = crearMovimientoDesdeCortes(
      [first, second],
      inputMovimiento,
      { id: 'movement-1', now: NOW },
    )

    expect(movimiento).toMatchObject({
      id: 'movement-1',
      tipo: 'entrada',
      categoria: 'Corte de caja',
      formaPago: 'efectivo',
      monto: 4000.4,
      concepto: 'Corte de Caja Tienda Centro',
      notas: 'Dos turnos',
      estadoExportacion: 'pendiente',
      source: {
        type: 'cash-cuts',
        cashCutIds: ['cut-1', 'cut-2'],
      },
    })
    expect(movimiento.billetes).toEqual(
      crearDesglose({ b1000: 4, monedas: 0.4 }),
    )
  })

  it('rechaza lista vacía, IDs duplicados y cortes incluidos', () => {
    expect(() =>
      crearMovimientoDesdeCortes([], inputMovimiento, {
        id: 'empty',
        now: NOW,
      }),
    ).toThrow(CashCutValidationError)

    const cashCut = crearCorte()

    expect(() =>
      crearMovimientoDesdeCortes(
        [cashCut, cashCut],
        inputMovimiento,
        { id: 'duplicate', now: NOW },
      ),
    ).toThrow(CashCutValidationError)

    expect(() =>
      crearMovimientoDesdeCortes(
        [
          {
            ...cashCut,
            status: 'included',
            movementId: 'other',
          },
        ],
        inputMovimiento,
        { id: 'included', now: NOW },
      ),
    ).toThrow(CashCutAlreadyIncludedError)

    expect(() =>
      crearMovimientoDesdeCortes(
        [
          {
            ...cashCut,
            movementId: 'inconsistent-movement',
          },
        ],
        inputMovimiento,
        { id: 'inconsistent-pending', now: NOW },
      ),
    ).toThrow(CashCutAlreadyIncludedError)
  })

  it('rechaza una fecha de movimiento inexistente', () => {
    expect(() =>
      crearMovimientoDesdeCortes(
        [crearCorte()],
        {
          ...inputMovimiento,
          date: '2026-02-30',
        },
        { id: 'invalid-date', now: NOW },
      ),
    ).toThrow(CashCutValidationError)
  })

  it('bloquea tiendas distintas y mezclar tienda con corte sin tienda', () => {
    const tiendaCentro = crearCorte('center')
    const tiendaNorte = crearCorte('north', {
      storeName: 'Tienda Norte',
    })
    const sinTienda = crearCorte('none', {
      storeName: undefined,
    })

    expect(() =>
      crearMovimientoDesdeCortes(
        [tiendaCentro, tiendaNorte],
        inputMovimiento,
        { id: 'different', now: NOW },
      ),
    ).toThrow(CashCutsDifferentStoresError)
    expect(() =>
      crearMovimientoDesdeCortes(
        [tiendaCentro, sinTienda],
        inputMovimiento,
        { id: 'mixed', now: NOW },
      ),
    ).toThrow(CashCutsDifferentStoresError)
  })

  it('rechaza cortes inconsistentes y un movimiento de retiro cero', () => {
    expect(() =>
      crearMovimientoDesdeCortes(
        [crearCorte('broken', { withdrawnAmount: 1 })],
        inputMovimiento,
        { id: 'broken-movement', now: NOW },
      ),
    ).toThrow(CashCutValidationError)

    const breakdown = crearDesglose({ b100: 1 })
    const zeroCut = crearCorteCaja(
      crearInput({
        countedBreakdown: breakdown,
        fundBreakdown: breakdown,
      }),
      { id: 'zero', now: NOW },
    )

    expect(() =>
      crearMovimientoDesdeCortes([zeroCut], inputMovimiento, {
        id: 'zero-movement',
        now: NOW,
      }),
    ).toThrow(CashCutValidationError)
  })
})
