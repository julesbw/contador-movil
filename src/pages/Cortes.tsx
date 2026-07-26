import { useCallback, useEffect, useMemo, useState } from 'react'
import { CashCutConsolidationForm } from '../components/CashCutConsolidationForm'
import { CashCutDetail } from '../components/CashCutDetail'
import { CashCutForm } from '../components/CashCutForm'
import {
  CashCutList,
  type CashCutFilter,
} from '../components/CashCutList'
import {
  summarizeCashCuts,
  toggleCashCutSelection,
} from '../components/cashCutUi'
import {
  obtenerIdentidadTienda,
  type CashCut,
} from '../models/CashCut'
import type { Movimiento } from '../models/Movimiento'
import type {
  CreateCashCutInput,
  CreateMovementFromCashCutsInput,
} from '../services/cashCutDomain'
import { cashCutService } from '../services/cashCutService'

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  currency: 'MXN',
  maximumFractionDigits: 2,
  style: 'currency',
})

type CortesProps = {
  onMovimientoCreado: (movimiento: Movimiento) => void
  onVerMovimiento: (id: string) => void
  onEdicionActivaChange?: (active: boolean) => void
  onOperacionActivaChange?: (active: boolean) => void
}

type View =
  | { type: 'list' }
  | { type: 'create' }
  | { type: 'edit'; cut: CashCut }
  | { type: 'detail'; cut: CashCut }
  | { type: 'consolidate' }

export function Cortes({
  onMovimientoCreado,
  onVerMovimiento,
  onEdicionActivaChange,
  onOperacionActivaChange,
}: CortesProps) {
  const [cuts, setCuts] = useState<CashCut[]>([])
  const [filter, setFilter] = useState<CashCutFilter>('pending')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [view, setView] = useState<View>({ type: 'list' })
  const [loading, setLoading] = useState(true)
  const [busyCutId, setBusyCutId] = useState<string>()
  const [mutationInProgress, setMutationInProgress] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)

    try {
      const records = await cashCutService.obtenerTodos()
      setCuts(records)
      setView((current) => {
        if (current.type !== 'edit' && current.type !== 'detail') {
          return current
        }

        const refreshed = records.find(
          (cut) => cut.id === current.cut.id,
        )

        return refreshed
          ? { ...current, cut: refreshed }
          : current
      })
      setSelectedIds((current) =>
        current.filter((id) =>
          records.some(
            (cut) => cut.id === id && cut.status === 'pending',
          ),
        ),
      )
    } catch (cause: unknown) {
      console.error('No fue posible consultar los cortes', cause)
      setError('No fue posible consultar los cortes guardados.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const isEditing =
    view.type === 'create' ||
    view.type === 'edit' ||
    view.type === 'consolidate'

  useEffect(() => {
    onEdicionActivaChange?.(isEditing)
  }, [isEditing, onEdicionActivaChange])

  useEffect(
    () => () => {
      onEdicionActivaChange?.(false)
    },
    [onEdicionActivaChange],
  )

  const operationInProgress =
    mutationInProgress || busyCutId !== undefined

  useEffect(() => {
    onOperacionActivaChange?.(operationInProgress)
  }, [onOperacionActivaChange, operationInProgress])

  useEffect(
    () => () => {
      onOperacionActivaChange?.(false)
    },
    [onOperacionActivaChange],
  )

  useEffect(() => {
    if (!isEditing && !operationInProgress) {
      return
    }

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload)
    }
  }, [isEditing, operationInProgress])

  const filteredCuts = useMemo(
    () => cuts.filter((cut) => cut.status === filter),
    [cuts, filter],
  )
  const selectedCuts = useMemo(
    () => cuts.filter((cut) => selectedIds.includes(cut.id)),
    [cuts, selectedIds],
  )
  const selectedSummary = useMemo(
    () => summarizeCashCuts(selectedCuts),
    [selectedCuts],
  )
  const selectedHasDifferentStores =
    new Set(selectedCuts.map(obtenerIdentidadTienda)).size > 1

  function showList() {
    setError(undefined)
    setView({ type: 'list' })
    void load()
  }

  function changeFilter(nextFilter: CashCutFilter) {
    setFilter(nextFilter)
    setError(undefined)

    if (nextFilter === 'included') {
      setSelectedIds([])
    }
  }

  function changeSelection(cut: CashCut) {
    if (busyCutId !== undefined) {
      return
    }

    const result = toggleCashCutSelection(selectedIds, cut, cuts)

    setSelectedIds(result.selectedIds)
    setError(result.error)
  }

  async function createCut(input: CreateCashCutInput) {
    setMutationInProgress(true)

    try {
      await cashCutService.crear(input)
      setNotice('Corte guardado. Está listo para consolidarse.')
      setFilter('pending')
      setView({ type: 'list' })
      await load()
    } finally {
      setMutationInProgress(false)
    }
  }

  async function updateCut(cut: CashCut, input: CreateCashCutInput) {
    setMutationInProgress(true)

    try {
      await cashCutService.actualizar(cut.id, input, cut.updatedAt)
      setNotice('Los cambios del corte se guardaron.')
      setView({ type: 'list' })
      await load()
    } catch (cause: unknown) {
      await load()
      throw cause
    } finally {
      setMutationInProgress(false)
    }
  }

  async function deleteCut(cut: CashCut) {
    if (busyCutId !== undefined) {
      return
    }

    if (
      !window.confirm(`¿Eliminar el corte “${cut.concept}”?`)
    ) {
      return
    }

    setBusyCutId(cut.id)
    setError(undefined)

    try {
      await cashCutService.eliminar(cut.id, cut.updatedAt)
      setSelectedIds((current) =>
        current.filter((id) => id !== cut.id),
      )
      setNotice('Corte eliminado.')
      await load()
    } catch (cause: unknown) {
      console.error('No fue posible eliminar el corte', cause)
      await load()
      setError(
        'No fue posible eliminar el corte. Puede haber cambiado desde que se consultó.',
      )
    } finally {
      setBusyCutId(undefined)
    }
  }

  async function createMovement(
    input: CreateMovementFromCashCutsInput,
  ) {
    setMutationInProgress(true)

    try {
      const movement = await cashCutService.crearMovimiento(
        selectedIds,
        input,
      )

      setSelectedIds([])
      setNotice('Entrada creada y cortes marcados como incluidos.')
      setFilter('included')
      setView({ type: 'list' })
      await load()
      onMovimientoCreado(movement)
    } catch (cause: unknown) {
      await load()
      throw cause
    } finally {
      setMutationInProgress(false)
    }
  }

  if (view.type === 'create') {
    return (
      <CashCutForm
        onCancel={showList}
        onSave={createCut}
      />
    )
  }

  if (view.type === 'edit') {
    return (
      <CashCutForm
        cut={view.cut}
        onCancel={showList}
        onSave={(input) => updateCut(view.cut, input)}
      />
    )
  }

  if (view.type === 'detail') {
    return (
      <CashCutDetail
        cut={view.cut}
        onClose={showList}
        onEdit={
          view.cut.status === 'pending'
            ? (cut) => setView({ type: 'edit', cut })
            : undefined
        }
        onViewMovement={onVerMovimiento}
      />
    )
  }

  if (view.type === 'consolidate') {
    return (
      <CashCutConsolidationForm
        cuts={selectedCuts}
        onCancel={showList}
        onSave={createMovement}
      />
    )
  }

  return (
    <section aria-busy={busyCutId !== undefined}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-950">
            Cortes de caja
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Registra el efectivo contado, el fondo y el retiro.
          </p>
        </div>
        <button
          className="button-primary min-h-11 shrink-0"
          disabled={busyCutId !== undefined}
          type="button"
          onClick={() => {
            setError(undefined)
            setNotice(undefined)
            setView({ type: 'create' })
          }}
        >
          Nuevo corte
        </button>
      </div>

      <div aria-live="polite">
        {notice && (
          <p
            className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
            role="status"
          >
            {notice}
          </p>
        )}
      </div>

      {error && (
        <p
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      )}

      <CashCutList
        busyCutId={busyCutId}
        cuts={filteredCuts}
        filter={filter}
        loading={loading}
        selectedIds={selectedIds}
        onDelete={(cut) => void deleteCut(cut)}
        onEdit={(cut) => {
          setError(undefined)
          setView({ type: 'edit', cut })
        }}
        onFilterChange={changeFilter}
        onSelectionChange={changeSelection}
        onView={(cut) => setView({ type: 'detail', cut })}
        onViewMovement={onVerMovimiento}
      />

      {selectedCuts.length > 0 && filter === 'pending' && (
        <aside
          aria-label="Cortes seleccionados"
          className="sticky bottom-3 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal-200 bg-white/95 p-4 shadow-lg backdrop-blur"
          style={{
            bottom:
              'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {selectedCuts.length}{' '}
              {selectedCuts.length === 1
                ? 'corte seleccionado'
                : 'cortes seleccionados'}
            </p>
            <p
              aria-live="polite"
              className="mt-0.5 font-bold tabular-nums text-teal-800"
            >
              {currencyFormatter.format(selectedSummary.amount)}
            </p>
            {selectedSummary.error && (
              <p className="mt-1 max-w-sm text-xs text-red-700">
                {selectedSummary.error}
              </p>
            )}
            {selectedHasDifferentStores && (
              <p className="mt-1 max-w-sm text-xs text-red-700">
                Solo puedes consolidar cortes de la misma tienda.
              </p>
            )}
          </div>
          <button
            className="button-primary min-h-11"
            disabled={
              busyCutId !== undefined ||
              selectedSummary.error !== undefined ||
              selectedHasDifferentStores
            }
            type="button"
            onClick={() => {
              setError(undefined)
              setView({ type: 'consolidate' })
            }}
          >
            Crear entrada
          </button>
        </aside>
      )}
    </section>
  )
}
