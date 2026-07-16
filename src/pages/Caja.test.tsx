import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BridgeProfile } from '../models/BridgeProfile'
import { CajaProfileSelector } from './Caja'

const profiles: BridgeProfile[] = [
  {
    id: 'profile-1',
    name: 'Caja principal',
    baseUrl: 'https://equipo.example.ts.net',
    token: 'secret-token',
    createdAt: '2026-07-16T12:00:00.000Z',
    updatedAt: '2026-07-16T12:00:00.000Z',
  },
]

describe('CajaProfileSelector', () => {
  it('permanece habilitado para permitir cambiar perfil durante una sync', () => {
    const html = renderToStaticMarkup(
      <CajaProfileSelector
        activeProfileId={profiles[0]?.id}
        profiles={profiles}
        selectingProfile={false}
        onSelect={() => undefined}
      />,
    )

    expect(html).not.toContain('disabled=""')
    expect(html).toContain('Caja principal')
  })

  it('se deshabilita únicamente mientras se persiste otra selección', () => {
    const html = renderToStaticMarkup(
      <CajaProfileSelector
        profiles={profiles}
        selectingProfile
        onSelect={() => undefined}
      />,
    )

    expect(html).toContain('disabled=""')
  })
})
