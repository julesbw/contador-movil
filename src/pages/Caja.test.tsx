import { renderToStaticMarkup } from 'react-dom/server'
import type { ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { BridgeProfile } from '../models/BridgeProfile'
import {
  CajaProfileSelector,
  CajaProfileStatus,
  CajaSyncButton,
} from './Caja'

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

const verifiedProfile: BridgeProfile = {
  ...profiles[0],
  sourceId: '00000000-0000-4000-8000-000000000001',
  sourceName: 'Equipo verificado',
  lastVerifiedAt: profiles[0].updatedAt,
}

const editedProfile: BridgeProfile = {
  ...verifiedProfile,
  updatedAt: '2026-07-16T12:01:00.000Z',
}

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

describe('CajaProfileStatus', () => {
  it('muestra verificación pendiente y no anuncia que está listo', () => {
    const html = renderToStaticMarkup(
      <CajaProfileStatus
        profile={profiles[0]}
        state={{ status: 'idle' }}
      />,
    )

    expect(html).toContain('role="status"')
    expect(html).toContain('Perfil pendiente de verificación')
    expect(html).toContain('Verifica la conexión en Ajustes')
    expect(html).not.toContain('Listo para sincronizar')
  })

  it('conserva el estado idle para un perfil verificado', () => {
    const html = renderToStaticMarkup(
      <CajaProfileStatus
        profile={verifiedProfile}
        state={{ status: 'idle' }}
      />,
    )

    expect(html).toContain('Listo para sincronizar')
    expect(html).not.toContain('Perfil pendiente de verificación')
  })

  it('vuelve al estado pendiente cuando el perfil fue editado', () => {
    const html = renderToStaticMarkup(
      <CajaProfileStatus
        profile={editedProfile}
        state={{ status: 'idle' }}
      />,
    )

    expect(html).toContain('Perfil pendiente de verificación')
    expect(html).not.toContain('Listo para sincronizar')
  })
})

describe('CajaSyncButton', () => {
  it('bloquea un perfil sin verificar y no propaga la acción', () => {
    const onSynchronize = vi.fn()
    const button = CajaSyncButton({
      profile: profiles[0],
      selectingProfile: false,
      synchronizing: false,
      onSynchronize,
    }) as ReactElement<{
      children: string
      disabled: boolean
      onClick: () => void
      type: string
    }>

    expect(button.props.type).toBe('button')
    expect(button.props.children).toBe('Sincronizar')
    expect(button.props.disabled).toBe(true)

    button.props.onClick()

    expect(onSynchronize).not.toHaveBeenCalled()
  })

  it('mantiene disponible la acción para un perfil verificado', () => {
    const onSynchronize = vi.fn()
    const button = CajaSyncButton({
      profile: verifiedProfile,
      selectingProfile: false,
      synchronizing: false,
      onSynchronize,
    }) as ReactElement<{
      disabled: boolean
      onClick: () => void
    }>

    expect(button.props.disabled).toBe(false)

    button.props.onClick()

    expect(onSynchronize).toHaveBeenCalledOnce()
  })

  it('bloquea la acción cuando la configuración cambió después de verificar', () => {
    const onSynchronize = vi.fn()
    const button = CajaSyncButton({
      profile: editedProfile,
      selectingProfile: false,
      synchronizing: false,
      onSynchronize,
    }) as ReactElement<{
      disabled: boolean
      onClick: () => void
    }>

    expect(button.props.disabled).toBe(true)

    button.props.onClick()

    expect(onSynchronize).not.toHaveBeenCalled()
  })
})
