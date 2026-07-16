import { useEffect, useState } from 'react'
import { InstallPrompt } from './components/InstallPrompt'
import { usePwaInstall } from './hooks/usePwaInstall'
import type { Movimiento } from './models/Movimiento'
import { Ajustes } from './pages/Ajustes'
import { Caja } from './pages/Caja'
import { Exportar } from './pages/Exportar'
import { Movimientos } from './pages/Movimientos'
import { NuevoMovimiento } from './pages/NuevoMovimiento'
import { configService } from './services/configService'
import { ensurePersistentStorage } from './services/storagePersistService'

type EstadoInicio = 'iniciando' | 'lista' | 'error'
type Pagina = 'nuevo' | 'movimientos' | 'caja' | 'exportar' | 'ajustes'

function App() {
  const [estadoInicio, setEstadoInicio] = useState<EstadoInicio>('iniciando')
  const [pagina, setPagina] = useState<Pagina>('nuevo')
  const [revision, setRevision] = useState(0)
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
            Movimientos y Caja
          </h1>
        </div>
      </header>

      <InstallPrompt instalacion={instalacion} />

      <nav
        aria-label="Navegación principal"
        className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur"
      >
        <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          <button
            className={pagina === 'nuevo' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'nuevo' ? 'page' : undefined}
            type="button"
            onClick={() => setPagina('nuevo')}
          >
            Nuevo
          </button>
          <button
            className={pagina === 'movimientos' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'movimientos' ? 'page' : undefined}
            type="button"
            onClick={() => setPagina('movimientos')}
          >
            Movimientos
          </button>
          <button
            className={pagina === 'caja' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'caja' ? 'page' : undefined}
            type="button"
            onClick={() => setPagina('caja')}
          >
            Caja
          </button>
          <button
            className={pagina === 'exportar' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'exportar' ? 'page' : undefined}
            type="button"
            onClick={() => setPagina('exportar')}
          >
            Exportar
          </button>
          <button
            className={pagina === 'ajustes' ? 'nav-active' : 'nav-item'}
            aria-current={pagina === 'ajustes' ? 'page' : undefined}
            type="button"
            onClick={() => setPagina('ajustes')}
          >
            Ajustes
          </button>
        </div>
      </nav>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {pagina === 'nuevo' && (
          <NuevoMovimiento onGuardado={handleGuardado} />
        )}
        {pagina === 'movimientos' && <Movimientos revision={revision} />}
        {pagina === 'caja' && (
          <Caja onOpenSettings={() => setPagina('ajustes')} />
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
