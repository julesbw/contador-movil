import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { CashCut } from '../models/CashCut'
import { CashCutForm } from './CashCutForm'
import {
  nextCashCutFormStep,
  previousCashCutFormStep,
} from './cashCutFormSteps'

describe('CashCutForm', () => {
  it('inicia en conteo y no renderiza dos contadores simultáneos', () => {
    const html = renderToStaticMarkup(
      <CashCutForm
        onCancel={() => undefined}
        onSave={() => Promise.resolve()}
      />,
    )

    expect(html).toContain('Efectivo actual en caja')
    expect(html).toContain('Fecha y hora')
    expect(html).toContain('1. Conteo')
    expect(html).toContain('2. Fondo')
    expect(html).toContain('3. Confirmación')
    expect(html).not.toContain('Fondo que permanecerá en caja')
    expect(html).toContain('type="datetime-local"')
    expect(html).toContain('type="submit">Continuar</button>')
  })

  it('avanza y retrocede por los tres pasos sin saltos', () => {
    expect(nextCashCutFormStep(1)).toBe(2)
    expect(nextCashCutFormStep(2)).toBe(3)
    expect(previousCashCutFormStep(3)).toBe(2)
    expect(previousCashCutFormStep(2)).toBe(1)
  })

  it('muestra validación en vez de fallar con un total fuera de rango', () => {
    const zeroBreakdown = {
      b1000: 0,
      b500: 0,
      b200: 0,
      b100: 0,
      b50: 0,
      b20: 0,
      monedas: 0,
    }
    const cut: CashCut = {
      id: 'overflow',
      date: '2026-07-26T18:00:00.000Z',
      concept: 'Corte fuera de rango',
      countedBreakdown: {
        ...zeroBreakdown,
        b1000: Number.MAX_SAFE_INTEGER,
      },
      countedAmount: 0,
      fundBreakdown: zeroBreakdown,
      fundAmount: 0,
      withdrawnBreakdown: zeroBreakdown,
      withdrawnAmount: 0,
      status: 'pending',
      createdAt: '2026-07-26T18:00:00.000Z',
      updatedAt: '2026-07-26T18:00:00.000Z',
    }

    const html = renderToStaticMarkup(
      <CashCutForm
        cut={cut}
        onCancel={() => undefined}
        onSave={() => Promise.resolve()}
      />,
    )

    expect(html).toContain(
      'El desglose de efectivo está fuera del rango permitido.',
    )
  })
})
