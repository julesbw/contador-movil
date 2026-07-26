import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Cortes } from './Cortes'

describe('Cortes', () => {
  it('muestra la entrada al wizard y los filtros principales', () => {
    const html = renderToStaticMarkup(
      <Cortes
        onMovimientoCreado={() => undefined}
        onVerMovimiento={() => undefined}
      />,
    )

    expect(html).toContain('Cortes de caja')
    expect(html).toContain('Nuevo corte')
    expect(html).toContain('Pendientes')
    expect(html).toContain('Incluidos')
    expect(html).toContain('Cargando cortes')
  })
})
