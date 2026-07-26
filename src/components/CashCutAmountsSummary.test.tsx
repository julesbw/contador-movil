import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CashCutAmountsSummary } from './CashCutAmountsSummary'

describe('CashCutAmountsSummary', () => {
  it('separa contado, fondo y retirado con importes decimales', () => {
    const html = renderToStaticMarkup(
      <CashCutAmountsSummary
        countedAmount={8500.5}
        fundAmount={1500.25}
        withdrawnAmount={7000.25}
      />,
    )
    const formatter = new Intl.NumberFormat('es-MX', {
      currency: 'MXN',
      maximumFractionDigits: 2,
      style: 'currency',
    })

    expect(html).toContain('Efectivo contado')
    expect(html).toContain('Fondo de caja')
    expect(html).toContain('Efectivo retirado')
    expect(html).toContain(formatter.format(7000.25))
  })
})
