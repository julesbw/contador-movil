import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CajaSyncStatus } from './CajaSyncStatus'

describe('CajaSyncStatus', () => {
  it('anuncia la carga y confirma que conserva el snapshot anterior', () => {
    const html = renderToStaticMarkup(
      <CajaSyncStatus state={{ status: 'loading', hasSnapshot: true }} />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('aria-live="polite"')
    expect(html).toContain('Sincronizando con esta computadora')
    expect(html).toContain('último dato disponible permanece visible')
  })

  it('muestra un error local y mantiene el último dato disponible', () => {
    const html = renderToStaticMarkup(
      <CajaSyncStatus
        state={{
          status: 'error',
          message: 'No se pudo conectar con esta computadora.',
          hasSnapshot: true,
        }}
      />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('No se pudo conectar con esta computadora.')
    expect(html).toContain('Mostrando el último dato disponible.')
  })

  it('bloquea conceptualmente el dato nuevo ante identidad incompatible', () => {
    const html = renderToStaticMarkup(
      <CajaSyncStatus state={{ status: 'mismatch', hasSnapshot: true }} />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('La identidad no coincide')
    expect(html).toContain('El dato nuevo fue bloqueado')
    expect(html).toContain('Revisa el perfil antes de continuar')
  })

  it('anuncia una sincronización exitosa', () => {
    const html = renderToStaticMarkup(
      <CajaSyncStatus state={{ status: 'success' }} />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('Sincronización completada.')
  })
})
