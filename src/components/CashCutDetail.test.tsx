import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CashCut } from '../models/CashCut'
import { CashCutDetail } from './CashCutDetail'

const breakdown = {
  b1000: 1,
  b500: 0,
  b200: 0,
  b100: 0,
  b50: 0,
  b20: 0,
  monedas: 0,
}

function createCut(status: CashCut['status']): CashCut {
  return {
    id: 'cut-1',
    date: '2026-07-26T18:30:00.000Z',
    concept: 'Corte vespertino',
    storeName: 'Tienda Centro',
    countedBreakdown: breakdown,
    countedAmount: 1000,
    fundBreakdown: { ...breakdown, b1000: 0 },
    fundAmount: 0,
    withdrawnBreakdown: breakdown,
    withdrawnAmount: 1000,
    status,
    movementId: status === 'included' ? 'movement-1' : undefined,
    createdAt: '2026-07-26T18:30:00.000Z',
    updatedAt: '2026-07-26T18:30:00.000Z',
  }
}

describe('CashCutDetail', () => {
  it('muestra trazabilidad y permite editar un pendiente', () => {
    const html = renderToStaticMarkup(
      <CashCutDetail
        cut={createCut('pending')}
        onClose={() => undefined}
        onEdit={() => undefined}
      />,
    )

    expect(html).toContain('Efectivo contado')
    expect(html).toContain('Fondo de caja')
    expect(html).toContain('Efectivo retirado')
    expect(html).toContain('Editar corte')
  })

  it('solo ofrece el movimiento para un corte incluido', () => {
    const html = renderToStaticMarkup(
      <CashCutDetail
        cut={createCut('included')}
        onClose={() => undefined}
        onViewMovement={() => undefined}
      />,
    )

    expect(html).toContain('Ver movimiento')
    expect(html).not.toContain('Editar corte')
  })
})
