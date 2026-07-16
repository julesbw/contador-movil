import { useEffect, useRef, useState } from 'react'
import { CajaDenominations } from '../components/CajaDenominations'
import { CajaSummary } from '../components/CajaSummary'
import {
  CajaSyncStatus,
  type CajaSyncState,
} from '../components/CajaSyncStatus'
import type { BridgeProfile } from '../models/BridgeProfile'
import type { StoredCajaSnapshot } from '../models/CajaSnapshot'
import {
  bridgeProfileService,
  type BridgeProfileService,
} from '../services/bridgeProfileService'
import {
  getBridgeErrorCode,
  getBridgeErrorMessage,
} from '../services/bridgeErrorMessages'
import {
  cajaSyncService,
  type CajaSyncService,
} from '../services/cajaSyncService'
import {
  formatCajaTimestampWarning,
  getCajaTimestampWarnings,
} from '../services/cajaTimestampWarnings'

type CajaProps = {
  onOpenSettings: () => void
  profileService?: BridgeProfileService
  syncService?: CajaSyncService
}

type CajaProfileSelectorProps = {
  profiles: readonly BridgeProfile[]
  activeProfileId?: string
  selectingProfile: boolean
  onSelect: (profileId: string) => void
}

export function CajaProfileSelector({
  profiles,
  activeProfileId,
  selectingProfile,
  onSelect,
}: CajaProfileSelectorProps) {
  return (
    <label className="text-sm font-medium text-slate-700">
      Computadora activa
      <select
        className="field"
        disabled={selectingProfile}
        value={activeProfileId ?? ''}
        onChange={(event) => onSelect(event.target.value)}
      >
        <option value="">Selecciona una computadora</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function Caja({
  onOpenSettings,
  profileService = bridgeProfileService,
  syncService = cajaSyncService,
}: CajaProps) {
  const [profiles, setProfiles] = useState<BridgeProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<BridgeProfile>()
  const [snapshot, setSnapshot] = useState<StoredCajaSnapshot>()
  const [loading, setLoading] = useState(true)
  const [selectingProfile, setSelectingProfile] = useState(false)
  const [syncState, setSyncState] = useState<CajaSyncState>({
    status: 'idle',
  })
  const abortRef = useRef<AbortController | undefined>(undefined)
  const requestIdRef = useRef(0)

  useEffect(() => {
    let mounted = true
    const requestId = ++requestIdRef.current

    Promise.all([profileService.listar(), profileService.obtenerActivo()])
      .then(async ([availableProfiles, active]) => {
        const storedSnapshot = active
          ? await syncService.obtenerSnapshot(active.id)
          : undefined

        if (mounted && requestId === requestIdRef.current) {
          setProfiles(availableProfiles)
          setActiveProfile(active)
          setSnapshot(storedSnapshot)
        }
      })
      .catch(() => {
        if (mounted && requestId === requestIdRef.current) {
          setSyncState({
            status: 'error',
            message: 'No fue posible cargar los datos guardados de Caja.',
            hasSnapshot: false,
          })
        }
      })
      .finally(() => {
        if (mounted && requestId === requestIdRef.current) {
          setLoading(false)
        }
      })

    return () => {
      mounted = false
      requestIdRef.current += 1
      abortRef.current?.abort()
    }
  }, [profileService, syncService])

  async function selectProfile(profileId: string) {
    abortRef.current?.abort()
    const requestId = ++requestIdRef.current
    setSelectingProfile(true)
    setSyncState({ status: 'idle' })

    try {
      await profileService.seleccionarActivo(profileId || undefined)
      const selected = profiles.find(({ id }) => id === profileId)
      const storedSnapshot = selected
        ? await syncService.obtenerSnapshot(selected.id)
        : undefined

      if (requestId !== requestIdRef.current) {
        return
      }

      setActiveProfile(selected)
      setSnapshot(storedSnapshot)
    } catch {
      if (requestId !== requestIdRef.current) {
        return
      }

      setSyncState({
        status: 'error',
        message: 'No fue posible cambiar la computadora activa.',
        hasSnapshot: Boolean(snapshot),
      })
    } finally {
      if (requestId === requestIdRef.current) {
        setSelectingProfile(false)
      }
    }
  }

  async function synchronize() {
    if (!activeProfile || !activeProfile.sourceId) {
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestId = ++requestIdRef.current
    const capturedProfileId = activeProfile.id
    const capturedUpdatedAt = activeProfile.updatedAt
    setSyncState({ status: 'loading', hasSnapshot: Boolean(snapshot) })

    try {
      const latest = await syncService.sincronizar(capturedProfileId, {
        signal: controller.signal,
      })

      if (
        requestId !== requestIdRef.current ||
        activeProfile.id !== capturedProfileId ||
        activeProfile.updatedAt !== capturedUpdatedAt
      ) {
        return
      }

      setSnapshot(latest)
      setSyncState({
        status: 'success',
        message: 'Caja se sincronizó correctamente.',
      })
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return
      }

      const code = getBridgeErrorCode(error)

      if (code === 'SYNC_CANCELLED' && controller.signal.aborted) {
        setSyncState({ status: 'idle' })
        return
      }

      setSyncState(
        code === 'SOURCE_MISMATCH'
          ? {
              status: 'mismatch',
              hasSnapshot: Boolean(snapshot),
            }
          : {
              status: 'error',
              message: getBridgeErrorMessage(error),
              hasSnapshot: Boolean(snapshot),
            },
      )
    } finally {
      if (requestId === requestIdRef.current) {
        abortRef.current = undefined
      }
    }
  }

  if (loading) {
    return (
      <section aria-busy="true">
        <h2 className="text-2xl font-bold text-slate-950">Caja</h2>
        <p className="py-10 text-center text-slate-500">
          Cargando datos de Caja…
        </p>
      </section>
    )
  }

  if (profiles.length === 0) {
    return (
      <section>
        <h2 className="text-2xl font-bold text-slate-950">Caja</h2>
        <div className="mt-6 rounded-2xl bg-white p-6 text-center ring-1 ring-slate-200">
          <p className="text-slate-600">
            Configura una computadora en Ajustes.
          </p>
          <button
            className="button-primary mt-4"
            type="button"
            onClick={onOpenSettings}
          >
            Ir a Ajustes
          </button>
        </div>
      </section>
    )
  }

  const warnings = snapshot
    ? getCajaTimestampWarnings(snapshot).map(formatCajaTimestampWarning)
    : []
  const synchronizing = syncState.status === 'loading'

  return (
    <section aria-busy={synchronizing}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">Caja</h2>
          <p className="mt-1 text-sm text-slate-600">
            Consulta manualmente el último estado publicado por Excel.
          </p>
        </div>
        <button
          className="button-secondary self-start sm:self-auto"
          type="button"
          onClick={onOpenSettings}
        >
          Administrar perfiles
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200 sm:p-7">
        <CajaProfileSelector
          activeProfileId={activeProfile?.id}
          profiles={profiles}
          selectingProfile={selectingProfile}
          onSelect={(profileId) => void selectProfile(profileId)}
        />

        {!activeProfile && (
          <p className="mt-4 text-sm text-slate-600">
            Selecciona un perfil para consultar su último snapshot.
          </p>
        )}

        {activeProfile && !activeProfile.sourceId && (
          <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
            Verifica la conexión antes de sincronizar.
          </p>
        )}

        {activeProfile?.sourceId && !snapshot && syncState.status === 'idle' && (
          <p className="mt-4 text-sm text-slate-600">
            Este dispositivo todavía no tiene un snapshot guardado para el
            perfil.
          </p>
        )}

        {activeProfile && (
          <button
            className="button-primary mt-5"
            disabled={
              !activeProfile.sourceId || synchronizing || selectingProfile
            }
            type="button"
            onClick={() => void synchronize()}
          >
            {synchronizing ? 'Sincronizando…' : 'Sincronizar'}
          </button>
        )}
      </div>

      {activeProfile && (
        <div className="mt-5">
          <CajaSyncStatus state={syncState} />
        </div>
      )}

      {activeProfile && snapshot && (
        <div className="mt-6 space-y-5">
          <CajaSummary
            profileName={activeProfile.name}
            snapshot={snapshot}
            warnings={warnings}
          />
          <CajaDenominations billetes={snapshot.billetes} />
        </div>
      )}
    </section>
  )
}
