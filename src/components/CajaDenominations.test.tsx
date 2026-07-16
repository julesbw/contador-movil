import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import { CajaDenominations } from './CajaDenominations'

const billetes: StoredCajaSnapshot['billetes'] = {
  '1000': 1,
  '500': 2,
  '200': 3,
  '100': 4,
  '50': 5,
  '20': 6,
}

describe('CajaDenominations', () => {
  it('muestra las seis denominaciones ordenadas con cantidad y subtotal', () => {
    const html = renderToStaticMarkup(
      <CajaDenominations billetes={billetes} />,
    )
    const labels = ['$1,000', '$500', '$200', '$100', '$50', '$20']

    labels.reduce((previousIndex, label) => {
      const currentIndex = html.indexOf(`>${label}</th>`)

      expect(currentIndex).toBeGreaterThan(previousIndex)
      return currentIndex
    }, -1)

    expect(html).toContain('Cantidad')
    expect(html).toContain('Subtotal')
    expect(html).toContain(
      new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
      }).format(1000),
    )
  })

  it('conserva negativos y los acompaña con una advertencia textual', () => {
    const html = renderToStaticMarkup(
      <CajaDenominations billetes={{ ...billetes, '500': -2 }} />,
    )
    const subtotalNegativo = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(-1000)

    expect(html).toContain('role="alert"')
    expect(html).toContain('contiene cantidades negativas')
    expect(html).toContain('-2')
    expect(html).toContain(subtotalNegativo)
  })

  it('no muestra advertencia cuando todas las cantidades son no negativas', () => {
    const html = renderToStaticMarkup(
      <CajaDenominations billetes={billetes} />,
    )

    expect(html).not.toContain('role="alert"')
  })
})
