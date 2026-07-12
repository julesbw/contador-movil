import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import packageJson from '../../package.json'
import { formatBuildDate } from '../config/appInfo'
import { AppInfoSection } from './AppInfoSection'

const info = {
  version: packageJson.version,
  buildDate: '2026-07-11T22:42:00.000Z',
  commitSha: 'local',
} as const

describe('AppInfoSection', () => {
  it('muestra la versión de package.json, la fecha de build y el commit local', () => {
    const html = renderToStaticMarkup(<AppInfoSection info={info} />)

    expect(html).toContain('Información de la aplicación')
    expect(html).toContain(packageJson.version)
    expect(html).toContain('2026-07-11T22:42:00.000Z')
    expect(html).toContain('local')
  })

  it('conserva el valor original cuando la fecha no es válida', () => {
    expect(formatBuildDate('fecha-desconocida')).toBe('fecha-desconocida')
  })
})
