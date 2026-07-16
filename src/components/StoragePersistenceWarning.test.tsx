import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { StoragePersistenceWarning } from './StoragePersistenceWarning'

describe('StoragePersistenceWarning', () => {
  it('advierte cuando la persistencia fue denegada', () => {
    const html = renderToStaticMarkup(
      <StoragePersistenceWarning state="denegada" />,
    )

    expect(html).toContain('role="alert"')
    expect(html).toContain('no confirmó almacenamiento persistente')
  })

  it('no muestra advertencia cuando fue concedida', () => {
    expect(
      renderToStaticMarkup(
        <StoragePersistenceWarning state="concedida" />,
      ),
    ).toBe('')
  })
})
