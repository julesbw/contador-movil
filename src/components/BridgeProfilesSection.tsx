import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import type { BridgeSourceResponse } from '../api/bridgeContracts'
import type { BridgeProfile } from '../models/BridgeProfile'
import {
  bridgeProfileService,
  type BridgeProfileService,
} from '../services/bridgeProfileService'
import { isBridgeProfileVerified } from '../services/bridgeProfileVerification'
import { getBridgeErrorMessage } from '../services/bridgeErrorMessages'
import {
  BridgeRelinkCompletionError,
  relinkAndSynchronizeBridgeProfile,
} from '../services/bridgeRelinkService'
import {
  cajaSyncService,
  type CajaSyncService,
} from '../services/cajaSyncService'

type RelinkCandidate = {
  profile: BridgeProfile
  source: BridgeSourceResponse
}

type BridgeProfilesSectionProps = {
  profileService?: BridgeProfileService
  syncService?: CajaSyncService
}

const EMPTY_FORM = {
  name: '',
  baseUrl: '',
  token: '',
}

export function BridgeProfilesSection({
  profileService = bridgeProfileService,
  syncService = cajaSyncService,
}: BridgeProfilesSectionProps) {
  const [profiles, setProfiles] = useState<BridgeProfile[]>([])
  const [activeId, setActiveId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [form, setForm] = useState(EMPTY_FORM)
  const [showToken, setShowToken] = useState(false)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [message, setMessage] = useState<string>()
  const [error, setError] = useState<string>()
  const [relinkCandidate, setRelinkCandidate] =
    useState<RelinkCandidate>()
  const abortRef = useRef<AbortController | undefined>(undefined)
  const operationIdRef = useRef(0)

  const load = useCallback(async () => {
    const [availableProfiles, active] = await Promise.all([
      profileService.listar(),
      profileService.obtenerActivo(),
    ])
    setProfiles(availableProfiles)
    setActiveId(active?.id)
  }, [profileService])

  useEffect(() => {
    let mounted = true

    load()
      .catch(() => {
        if (mounted) {
          setError('No fue posible cargar los perfiles guardados.')
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
      operationIdRef.current += 1
      abortRef.current?.abort()
    }
  }, [load])

  function resetForm() {
    setEditingId(undefined)
    setForm(EMPTY_FORM)
    setShowToken(false)
  }

  function edit(profile: BridgeProfile) {
    setEditingId(profile.id)
    setForm({
      name: profile.name,
      baseUrl: profile.baseUrl,
      token: profile.token,
    })
    setShowToken(false)
    setMessage(undefined)
    setError(undefined)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setProcessing(true)
    setMessage(undefined)
    setError(undefined)

    try {
      if (editingId) {
        const updated = await profileService.actualizar(editingId, form)
        setMessage(
          isBridgeProfileVerified(updated)
            ? 'Perfil actualizado.'
            : 'Perfil actualizado. Verifica la conexión nuevamente.',
        )
      } else {
        await profileService.crear(form)
        setMessage('Perfil guardado. Ahora verifica su identidad.')
      }

      resetForm()
      await load()
    } catch (cause) {
      setError(getBridgeErrorMessage(cause))
    } finally {
      setProcessing(false)
    }
  }

  async function verify(profile: BridgeProfile) {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setProcessing(true)
    setMessage(undefined)
    setError(undefined)
    setRelinkCandidate(undefined)

    try {
      const result = await profileService.verificar(
        profile.id,
        controller.signal,
      )

      if (result.status === 'mismatch') {
        setRelinkCandidate({ profile: result.profile, source: result.source })
        return
      }

      if (result.status === 'requires-confirmation') {
        const confirmed = window.confirm(
          `El bridge se identifica como “${result.source.source_name}”. ¿Vincular esta identidad al perfil “${result.profile.name}”?`,
        )

        if (!confirmed) {
          return
        }

        await profileService.confirmarPrimeraIdentidad(
          result.profile.id,
          result.profile.updatedAt,
          result.source,
        )
      }

      setMessage('Identidad verificada correctamente.')
      await load()
    } catch (cause) {
      if (!controller.signal.aborted) {
        setError(getBridgeErrorMessage(cause))
      }
    } finally {
      setProcessing(false)
      abortRef.current = undefined
    }
  }

  async function relink() {
    if (!relinkCandidate) {
      return
    }

    const confirmed = window.confirm(
      `La URL corresponde a “${relinkCandidate.source.source_name}”, una identidad distinta. Se eliminará el snapshot guardado para “${relinkCandidate.profile.name}”, el perfil quedará activo y se intentará sincronizar nuevamente. ¿Continuar?`,
    )

    if (!confirmed) {
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const operationId = ++operationIdRef.current
    setProcessing(true)
    setMessage(undefined)
    setError(undefined)

    try {
      const updated = await relinkAndSynchronizeBridgeProfile(
        profileService,
        syncService,
        {
          profile: relinkCandidate.profile,
          source: relinkCandidate.source,
          signal: controller.signal,
        },
      )

      if (operationId !== operationIdRef.current) {
        return
      }

      setRelinkCandidate(undefined)
      setProfiles((current) =>
        current.map((profile) => (profile.id === updated.id ? updated : profile)),
      )
      setActiveId(updated.id)
      setMessage('Identidad reemplazada y Caja sincronizada.')
    } catch (cause) {
      if (operationId !== operationIdRef.current) {
        return
      }

      if (cause instanceof BridgeRelinkCompletionError) {
        setRelinkCandidate(undefined)
        setProfiles((current) =>
          current.map((profile) =>
            profile.id === cause.profile.id ? cause.profile : profile,
          ),
        )

        if (cause.stage === 'sync') {
          setActiveId(cause.profile.id)
          setMessage(
            'La identidad fue reemplazada y el perfil quedó activo, pero la sincronización no terminó.',
          )
        } else {
          setMessage(
            'La identidad fue reemplazada, pero no fue posible seleccionar el perfil.',
          )
        }

        setError(getBridgeErrorMessage(cause.cause))
      } else {
        setError(getBridgeErrorMessage(cause))
      }
    } finally {
      if (operationId === operationIdRef.current) {
        setProcessing(false)
        abortRef.current = undefined
      }
    }
  }

  async function selectActive(id: string) {
    setProcessing(true)
    setMessage(undefined)
    setError(undefined)

    try {
      await profileService.seleccionarActivo(id)
      setActiveId(id)
      setMessage('Computadora activa actualizada.')
    } catch (cause) {
      setError(getBridgeErrorMessage(cause))
    } finally {
      setProcessing(false)
    }
  }

  async function remove(profile: BridgeProfile) {
    if (!window.confirm(`¿Eliminar el perfil “${profile.name}” y su snapshot guardado?`)) {
      return
    }

    setProcessing(true)
    setMessage(undefined)
    setError(undefined)

    try {
      await profileService.eliminar(profile.id)
      if (editingId === profile.id) {
        resetForm()
      }
      setRelinkCandidate(undefined)
      setMessage('Perfil eliminado.')
      await load()
    } catch (cause) {
      setError(getBridgeErrorMessage(cause))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-7">
      <h3 className="text-lg font-semibold text-slate-950">
        Computadoras de Caja
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Guarda un perfil por bridge. El token permanece únicamente en este
        dispositivo y nunca se incluye en exportaciones.
      </p>

      {message && (
        <p
          aria-live="polite"
          className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"
          role="status"
        >
          {message}
        </p>
      )}
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {relinkCandidate && (
        <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4" role="alert">
          <p className="font-semibold text-amber-950">
            La identidad no coincide
          </p>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            El perfil estaba vinculado a otra computadora. El bridge actual se
            identifica como “{relinkCandidate.source.source_name}”. No se
            guardó ningún snapshot nuevo.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className="button-primary"
              disabled={processing}
              type="button"
              onClick={() => void relink()}
            >
              Re-vincular identidad
            </button>
            <button
              className="button-secondary"
              disabled={processing}
              type="button"
              onClick={() => setRelinkCandidate(undefined)}
            >
              Conservar perfil actual
            </button>
          </div>
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={save}>
        <h4 className="font-semibold text-slate-900">
          {editingId ? 'Editar perfil' : 'Agregar computadora'}
        </h4>
        <label className="block text-sm font-medium text-slate-700">
          Nombre local
          <input
            className="field"
            maxLength={80}
            required
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          URL privada
          <input
            autoCapitalize="none"
            autoCorrect="off"
            className="field"
            inputMode="url"
            placeholder="https://equipo.example"
            required
            type="url"
            value={form.baseUrl}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                baseUrl: event.target.value,
              }))
            }
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Token de lectura
          <div className="mt-2 flex gap-2">
            <input
              autoCapitalize="none"
              autoComplete="current-password"
              className="field mt-0 min-w-0 flex-1"
              name="bridge-token"
              required
              spellCheck={false}
              type={showToken ? 'text' : 'password'}
              value={form.token}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  token: event.target.value,
                }))
              }
            />
            <button
              aria-pressed={showToken}
              className="button-secondary shrink-0"
              type="button"
              onClick={() => setShowToken((current) => !current)}
            >
              {showToken ? 'Ocultar' : 'Mostrar'}
            </button>
          </div>
        </label>
        <div className="flex flex-wrap gap-3">
          <button className="button-primary" disabled={processing} type="submit">
            {processing
              ? 'Procesando…'
              : editingId
                ? 'Guardar cambios'
                : 'Guardar perfil'}
          </button>
          {editingId && (
            <button
              className="button-secondary"
              disabled={processing}
              type="button"
              onClick={resetForm}
            >
              Cancelar edición
            </button>
          )}
        </div>
      </form>

      <div className="mt-7 space-y-3" aria-busy={loading}>
        <h4 className="font-semibold text-slate-900">Perfiles guardados</h4>
        {loading && <p className="text-sm text-slate-500">Cargando…</p>}
        {!loading && profiles.length === 0 && (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            No hay computadoras configuradas.
          </p>
        )}
        {profiles.map((profile) => (
          <article
            className="rounded-xl border border-slate-200 p-4"
            key={profile.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h5 className="break-words font-semibold text-slate-950">
                  {profile.name}
                </h5>
                <p className="mt-1 break-all text-xs text-slate-500">
                  {profile.baseUrl}
                </p>
                <p className="mt-2 text-sm text-slate-600">
                  {profile.sourceName
                    ? `Bridge: ${profile.sourceName}`
                    : 'Identidad pendiente de verificación'}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  checked={activeId === profile.id}
                  className="size-4 accent-teal-700"
                  disabled={processing}
                  name="active-bridge-profile"
                  type="radio"
                  onChange={() => void selectActive(profile.id)}
                />
                Usar en Caja
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="button-secondary py-2"
                disabled={processing}
                type="button"
                onClick={() => void verify(profile)}
              >
                Verificar
              </button>
              <button
                className="button-secondary py-2"
                disabled={processing}
                type="button"
                onClick={() => edit(profile)}
              >
                Editar
              </button>
              <button
                className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                disabled={processing}
                type="button"
                onClick={() => void remove(profile)}
              >
                Eliminar
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
