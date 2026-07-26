import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CashCut } from '../models/CashCut'
import { CashCutList } from './CashCutList'

const zeroBreakdown: CashCut['countedBreakdown'] = {
  b1000: 0,
  b500: 0,
  b200: 0,
  b100: 0,
  b50: 0,
  b20: 0,
  monedas: 0,
}

function createCut(
  status: CashCut['status'],
  id = `cut-${status}`,
): CashCut {
  return {
    id,
    date: '2026-07-26T18:30:00.000Z',
    concept: 'Corte vespertino',
    storeName: 'Tienda Centro',
    countedBreakdown: zeroBreakdown,
    countedAmount: 8000,
    fundBreakdown: zeroBreakdown,
    fundAmount: 1000,
    withdrawnBreakdown: zeroBreakdown,
    withdrawnAmount: 7000,
    status,
    movementId: status === 'included' ? 'movement-1' : undefined,
    createdAt: '2026-07-26T18:30:00.000Z',
    updatedAt: '2026-07-26T18:30:00.000Z',
  }
}

const handlers = {
  onFilterChange: () => undefined,
  onSelectionChange: () => undefined,
  onView: () => undefined,
  onEdit: () => undefined,
  onDelete: () => undefined,
  onViewMovement: () => undefined,
}

describe('CashCutList', () => {
  it('muestra selección y acciones editables solo para pendientes', () => {
    const html = renderToStaticMarkup(
      <CashCutList
        {...handlers}
        cuts={[createCut('pending')]}
        filter="pending"
        selectedIds={[]}
      />,
    )

    expect(html).toContain('type="checkbox"')
    expect(html).toContain('Editar')
    expect(html).toContain('Eliminar')
    expect(html).not.toContain('Ver movimiento')
  })

  it('muestra el vínculo al movimiento sin controles de edición', () => {
    const html = renderToStaticMarkup(
      <CashCutList
        {...handlers}
        cuts={[createCut('included')]}
        filter="included"
        selectedIds={[]}
      />,
    )

    expect(html).toContain('Ver movimiento')
    expect(html).not.toContain('type="checkbox"')
    expect(html).not.toContain('>Editar</button>')
    expect(html).not.toContain('>Eliminar</button>')
  })

  it('bloquea las acciones de toda la lista durante un borrado', () => {
    const html = renderToStaticMarkup(
      <CashCutList
        {...handlers}
        busyCutId="cut-1"
        cuts={[
          createCut('pending', 'cut-1'),
          createCut('pending', 'cut-2'),
        ]}
        filter="pending"
        selectedIds={[]}
      />,
    )

    expect(html).toContain('Eliminando…')
    expect(html).toMatch(
      /disabled="" type="button">Eliminar<\/button>/,
    )
    expect(html.match(/disabled="" type="checkbox"/g)).toHaveLength(2)
  })
})
