import { useEffect, useState } from 'react'
import { InstallPrompt } from './components/InstallPrompt'
import { usePwaInstall } from './hooks/usePwaInstall'
import type { Movimiento } from './models/Movimiento'
import { Ajustes } from './pages/Ajustes'
import { Caja } from './pages/Caja'
import { Cortes } from './pages/Cortes'
import { Exportar } from './pages/Exportar'
import { Movimientos } from './pages/Movimientos'
import { NuevoMovimiento } from './pages/NuevoMovimiento'
import { configService } from './services/configService'
import { ensurePersistentStorage } from './services/storagePersistService'

type EstadoInicio = 'iniciando' | 'lista' | 'error'
type Pagina =
  | 'nuevo'
  | 'movimientos'
  | 'cortes'
  | 'caja'
  | 'exportar'
  | 'ajustes'

function App() {
  const [estadoInicio, setEstadoInicio] = useState<EstadoInicio>('iniciando')
  const [pagina, setPagina] = useState<Pagina>('nuevo')
  const [revision, setRevision] = useState(0)
  const [edicionCorteActiva, setEdicionCorteActiva] = useState(false)
  const [operacionCorteActiva, setOperacionCorteActiva] =
    useState(false)
  const [movimientoEnfocadoId, setMovimientoEnfocadoId] =
    useState<string>()
  const instalacion = usePwaInstall()

  useEffect(() => {
    let activo = true

    Promise.all([configService.inicializar(), ensurePersistentStorage()])
      .then(() => {
        if (activo) {
          setEstadoInicio('lista')
        }
      })
      .catch((error: unknown) => {
        console.error('No fue posible inicializar la aplicación', error)

        if (activo) {
          setEstadoInicio('error')
        }
      })

    return () => {
      activo = false
    }
  }, [])

  function handleGuardado(_movimiento: Movimiento) {
    setRevision((actual) => actual + 1)
    setPagina('movimientos')
  }

  function navegar(nextPage: Pagina) {
    if (
      pagina === 'cortes' &&
      nextPage !== 'cortes' &&
      operacionCorteActiva
    ) {
      return
    }

    if (
      pagina === 'cortes' &&
      nextPage !== 'cortes' &&
      edicionCorteActiva &&
      !window.confirm(
        'Hay un corte sin terminar. Si sales ahora perderás los cambios no guardados.',
      )
    ) {
      return
    }

    setEdicionCorteActiva(false)
    setOperacionCorteActiva(false)
    setMovimientoEnfocadoId(undefined)
    setPagina(nextPage)
  }

  function verMovimiento(id: string) {
    if (operacionCorteActiva) {
      return
    }

    setEdicionCorteActiva(false)
    setMovimientoEnfocadoId(id)
    setPagina('movimientos')
  }

  if (estadoInicio !== 'lista') {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg items-center px-6">
        <p
          className={
            estadoInicio === 'error'
              ? 'w-full rounded-xl bg-red-50 p-5 text-red-800'
              : 'w-full text-center text-slate-600'
          }
        >
          {estadoInicio === 'iniciando'
            ? 'Preparando el almacenamiento local…'
            : 'No fue posible preparar el almacenamiento local.'}
        </p>
      </main>
    )
  }

  return (
    <div className="min-h-dvh">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
            Contador Móvil
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-950">
            Movimientos, Cortes y Caja
          </h1>
        </div>
      </header>

      <InstallPrompt instalacion={instalacion} />

      <nav
        aria-label="Navegación principal"
        className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          <button
            className={pagina === 'nuevo' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'nuevo' ? 'page' : undefined}
            disabled={operacionCorteActiva}
            type="button"
            onClick={() => navegar('nuevo')}
          >
            Nuevo
          </button>
          <button
            className={pagina === 'movimientos' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'movimientos' ? 'page' : undefined}
            disabled={operacionCorteActiva}
            type="button"
            onClick={() => navegar('movimientos')}
          >
            Movimientos
          </button>
          <button
            className={pagina === 'cortes' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'cortes' ? 'page' : undefined}
            disabled={operacionCorteActiva}
            type="button"
            onClick={() => navegar('cortes')}
          >
            Cortes
          </button>
          <button
            className={pagina === 'caja' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'caja' ? 'page' : undefined}
            disabled={operacionCorteActiva}
            type="button"
            onClick={() => navegar('caja')}
          >
            Caja
          </button>
          <button
            className={pagina === 'exportar' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'exportar' ? 'page' : undefined}
            disabled={operacionCorteActiva}
            type="button"
            onClick={() => navegar('exportar')}
          >
            Exportar
          </button>
          <button
            className={pagina === 'ajustes' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'ajustes' ? 'page' : undefined}
            disabled={operacionCorteActiva}
            type="button"
            onClick={() => navegar('ajustes')}
          >
            Ajustes
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {pagina === 'nuevo' && (
          <NuevoMovimiento onGuardado={handleGuardado} />
        )}
        {pagina === 'movimientos' && (
          <Movimientos
            movimientoEnfocadoId={movimientoEnfocadoId}
            revision={revision}
          />
        )}
        {pagina === 'cortes' && (
          <Cortes
            onEdicionActivaChange={setEdicionCorteActiva}
            onOperacionActivaChange={setOperacionCorteActiva}
            onMovimientoCreado={() =>
              setRevision((actual) => actual + 1)
            }
            onVerMovimiento={verMovimiento}
          />
        )}
        {pagina === 'caja' && (
          <Caja onOpenSettings={() => navegar('ajustes')} />
        )}
        {pagina === 'exportar' && (
          <Exportar
            onExportacionConfirmada={() =>
              setRevision((actual) => actual + 1)
            }
          />
        )}
        {pagina === 'ajustes' && <Ajustes instalacion={instalacion} />}
      </main>
    </div>
  )
}

export default App
