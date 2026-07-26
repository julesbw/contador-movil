import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CashCut } from '../models/CashCut'
import { CashCutConsolidationForm } from './CashCutConsolidationForm'

const emptyBreakdown = {
  b1000: 0,
  b500: 0,
  b200: 0,
  b100: 0,
  b50: 0,
  b20: 0,
  monedas: 0,
}

function createCut(
  id: string,
  storeName = 'Tienda Centro',
): CashCut {
  return {
    id,
    date: '2026-07-26T18:30:00.000Z',
    concept: 'Corte vespertino',
    storeName,
    countedBreakdown: { ...emptyBreakdown, b1000: 1 },
    countedAmount: 1000,
    fundBreakdown: emptyBreakdown,
    fundAmount: 0,
    withdrawnBreakdown: { ...emptyBreakdown, b1000: 1 },
    withdrawnAmount: 1000,
    status: 'pending',
    createdAt: '2026-07-26T18:30:00.000Z',
    updatedAt: '2026-07-26T18:30:00.000Z',
  }
}

describe('CashCutConsolidationForm', () => {
  it('resume varios cortes y el desglose agregado', () => {
    const html = renderToStaticMarkup(
      <CashCutConsolidationForm
        cuts={[createCut('cut-1'), createCut('cut-2')]}
        onCancel={() => undefined}
        onSave={() => Promise.resolve()}
      />,
    )

    expect(html).toContain('2 cortes pendientes')
    expect(html).toContain('Corte de Caja Tienda Centro')
    expect(html).toContain('Desglose total de la entrada')
    expect(html).not.toContain('disabled="" type="submit"')
  })

  it('bloquea tiendas distintas con un mensaje visible', () => {
    const html = renderToStaticMarkup(
      <CashCutConsolidationForm
        cuts={[
          createCut('cut-1'),
          createCut('cut-2', 'Tienda Norte'),
        ]}
        onCancel={() => undefined}
        onSave={() => Promise.resolve()}
      />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('misma tienda')
    expect(html).toContain('disabled="" type="submit"')
  })
})
