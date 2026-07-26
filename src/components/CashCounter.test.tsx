import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { DesgloseEfectivo } from '../models/Efectivo'
import { CashCounter } from './CashCounter'
import { parseCashCounterInput } from './cashCounterInput'

const breakdown: DesgloseEfectivo = {
  b1000: 2,
  b500: 1,
  b200: 0,
  b100: 0,
  b50: 0,
  b20: 0,
  monedas: 25.5,
}

describe('CashCounter', () => {
  it('muestra las denominaciones y el total en tiempo real', () => {
    const html = renderToStaticMarkup(
      <CashCounter showTotal value={breakdown} />,
    )
    const formatter = new Intl.NumberFormat('es-MX', {
      currency: 'MXN',
      maximumFractionDigits: 2,
      style: 'currency',
    })

    expect(html).toContain('Cantidad de billetes de 1000 pesos')
    expect(html).toContain('Monto total en monedas')
    expect(html).toContain('decimal')
    expect(html).toContain(formatter.format(2525.5))
  })

  it('reserva el resumen en el flujo y desplaza solo las denominaciones', () => {
    const html = renderToStaticMarkup(
      <CashCounter
        showTotal
        totalLabel="Monto del movimiento"
        value={breakdown}
      />,
    )

    expect(html).toContain(
      'max-height:min(36rem, calc(100dvh - 2rem))',
    )
    expect(html).toContain(
      'min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto',
    )
    expect(html).toContain('min-h-16 shrink-0')
    expect(html).not.toContain('sticky bottom-0')
  })

  it('expone los máximos por denominación para el fondo', () => {
    const html = renderToStaticMarkup(
      <CashCounter
        maxByDenomination={breakdown}
        value={{ ...breakdown, b1000: 1 }}
      />,
    )

    expect(html).toContain('Máx.')
  })

  it('bloquea la edición en la variante de solo lectura', () => {
    const html = renderToStaticMarkup(
      <CashCounter readOnly value={breakdown} />,
    )

    expect(html).toContain('readOnly=""')
  })

  it('deshabilita todos los controles mientras se guarda', () => {
    const html = renderToStaticMarkup(
      <CashCounter disabled value={breakdown} />,
    )

    expect(html).toContain('<fieldset')
    expect(html).toContain('disabled=""')
    expect(html.match(/disabled=""/g)).toHaveLength(8)
  })

  it('acepta centavos y rechaza billetes decimales o máximos excedidos', () => {
    expect(parseCashCounterInput('12,50', true)).toBe(12.5)
    expect(parseCashCounterInput('1.5', false)).toBeUndefined()
    expect(parseCashCounterInput('3', false, 2)).toBeUndefined()
    expect(parseCashCounterInput('2', false, 2)).toBe(2)
    expect(
      parseCashCounterInput(
        String(Number.MAX_SAFE_INTEGER),
        false,
        undefined,
        1000,
      ),
    ).toBeUndefined()
  })
})
