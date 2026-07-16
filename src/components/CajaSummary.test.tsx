import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import { CajaSummary } from './CajaSummary'

const snapshot: StoredCajaSnapshot = {
  profileId: 'profile-1',
  schemaVersion: '1.0',
  snapshotId: 'snapshot-1',
  sourceId: 'source-1',
  sourceName: 'Mac de Caja',
  scope: 'caja',
  generatedAt: '2026-07-15T12:00:00-06:00',
  receivedAt: '2026-07-15T12:00:01-06:00',
  syncedAt: '2026-07-15T12:00:02-06:00',
  billetes: {
    '1000': 10,
    '500': 2,
    '200': 1,
    '100': 1,
    '50': 0,
    '20': 2,
  },
  total: 11340,
}

describe('CajaSummary', () => {
  it('muestra alias, identidad y total en pesos mexicanos', () => {
    const html = renderToStaticMarkup(
      <CajaSummary profileName="Caja principal" snapshot={snapshot} />,
    )
    const total = new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(snapshot.total)

    expect(html).toContain('Caja principal')
    expect(html).toContain('Mac de Caja')
    expect(html).toContain(total)
  })

  it('renderiza los tres timestamps con elementos time', () => {
    const html = renderToStaticMarkup(
      <CajaSummary profileName="Caja principal" snapshot={snapshot} />,
    )

    expect(html).toContain(`dateTime="${snapshot.generatedAt}"`)
    expect(html).toContain(`dateTime="${snapshot.receivedAt}"`)
    expect(html).toContain(`dateTime="${snapshot.syncedAt}"`)
    expect(html).toContain('Generado en Excel')
    expect(html).toContain('Recibido por el bridge')
    expect(html).toContain('Sincronizado en este dispositivo')
  })

  it('anuncia las advertencias recibidas por props', () => {
    const html = renderToStaticMarkup(
      <CajaSummary
        profileName="Caja principal"
        snapshot={snapshot}
        warnings={['La fecha de generación está en el futuro.']}
      />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('La fecha de generación está en el futuro.')
  })
})
