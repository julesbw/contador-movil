import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed'
    platform: string
  }>
}

export type EstadoInstalacion =
  | 'instalada'
  | 'disponible'
  | 'no-disponible'
  | 'descartada'

export type InstalacionPwa = {
  estado: EstadoInstalacion
  instalar: () => Promise<void>
}

function estaInstalada(): boolean {
  const navigatorConStandalone = navigator as Navigator & {
    standalone?: boolean
  }

  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorConStandalone.standalone === true
  )
}

export function usePwaInstall(): InstalacionPwa {
  const [evento, setEvento] = useState<BeforeInstallPromptEvent>()
  const [estado, setEstado] = useState<EstadoInstalacion>(() =>
    estaInstalada() ? 'instalada' : 'no-disponible',
  )

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault()
      setEvento(event as BeforeInstallPromptEvent)
      setEstado('disponible')
    }

    function handleAppInstalled() {
      setEvento(undefined)
      setEstado('instalada')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt,
      )
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const instalar = useCallback(async () => {
    if (!evento) {
      return
    }

    await evento.prompt()
    const eleccion = await evento.userChoice

    setEvento(undefined)
    setEstado(
      eleccion.outcome === 'accepted' ? 'instalada' : 'descartada',
    )
  }, [evento])

  return { estado, instalar }
}
