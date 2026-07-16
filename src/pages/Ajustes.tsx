import { useEffect, useState, type FormEvent } from 'react'
import { AppInfoSection } from '../components/AppInfoSection'
import { BridgeProfilesSection } from '../components/BridgeProfilesSection'
import { StoragePersistenceWarning } from '../components/StoragePersistenceWarning'
import type { InstalacionPwa } from '../hooks/usePwaInstall'
import { configService } from '../services/configService'
import {
  ensurePersistentStorage,
  type EstadoPersistencia,
} from '../services/storagePersistService'

type AjustesProps = {
  instalacion: InstalacionPwa
}

export function Ajustes({ instalacion }: AjustesProps) {
  const [dispositivoId, setDispositivoId] = useState('')
  const [capturadoPor, setCapturadoPor] = useState('')
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState<string>()
  const [error, setError] = useState<string>()
  const [storagePersistence, setStoragePersistence] =
    useState<EstadoPersistencia>()

  useEffect(() => {
    let activo = true

    configService
      .inicializar()
      .then((configuracion) => {
        if (activo) {
          setDispositivoId(configuracion.dispositivoId)
          setCapturadoPor(configuracion.capturadoPor)
        }
      })
      .catch((cause: unknown) => {
        console.error('No fue posible cargar la configuración', cause)

        if (activo) {
          setError('No fue posible cargar la configuración')
        }
      })
      .finally(() => {
        if (activo) {
          setCargando(false)
        }
      })

    return () => {
      activo = false
    }
  }, [])

  useEffect(() => {
    let activo = true

    ensurePersistentStorage()
      .then((estado) => {
        if (activo) {
          setStoragePersistence(estado)
        }
      })
      .catch(() => {
        if (activo) {
          setStoragePersistence('denegada')
        }
      })

    return () => {
      activo = false
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setGuardando(true)
    setMensaje(undefined)
    setError(undefined)

    try {
      await configService.guardarCapturadoPor(capturadoPor)
      setCapturadoPor(capturadoPor.trim())
      setMensaje('Ajustes guardados')
    } catch (cause: unknown) {
      console.error('No fue posible guardar la configuración', cause)
      setError('No fue posible guardar la configuración')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section>
      <h2 className="text-2xl font-bold text-slate-950">Ajustes</h2>
      <p className="mt-1 text-sm text-slate-600">
        Configura exportaciones, almacenamiento y computadoras de Caja.
      </p>

      <form
        className="mt-6 space-y-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7"
        onSubmit={handleSubmit}
      >
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Capturado por
          <input
            className="field"
            disabled={cargando}
            placeholder="Nombre de la persona"
            value={capturadoPor}
            onChange={(event) => {
              setCapturadoPor(event.target.value)
              setMensaje(undefined)
            }}
          />
        </label>

        <div>
          <p className="text-sm font-medium text-slate-700">
            ID del dispositivo
          </p>
          <p className="mt-2 break-all rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-600">
            {cargando ? 'Cargando…' : dispositivoId}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Se genera una sola vez y no puede editarse.
          </p>
        </div>

        {mensaje && (
          <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {mensaje}
          </p>
        )}
        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <button
          className="button-primary"
          disabled={cargando || guardando}
          type="submit"
        >
          {guardando ? 'Guardando…' : 'Guardar ajustes'}
        </button>
      </form>

      <BridgeProfilesSection />

      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
        <h3 className="font-semibold text-slate-950">Instalación</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {instalacion.estado === 'instalada' &&
            'La aplicación ya está instalada en este dispositivo.'}
          {instalacion.estado === 'disponible' &&
            'Tu navegador permite instalar la aplicación.'}
          {instalacion.estado === 'descartada' &&
            'La instalación fue cancelada. El navegador podrá ofrecerla nuevamente más adelante.'}
          {instalacion.estado === 'no-disponible' &&
            'Usa la opción “Agregar a pantalla de inicio” del menú de tu navegador si está disponible.'}
        </p>
        {instalacion.estado === 'disponible' && (
          <button
            className="button-primary mt-4"
            type="button"
            onClick={() => void instalacion.instalar()}
          >
            Instalar aplicación
          </button>
        )}

        <StoragePersistenceWarning state={storagePersistence} />
      </div>

      <AppInfoSection />
    </section>
  )
}
