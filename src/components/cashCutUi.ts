import {
  obtenerIdentidadTienda,
  type CashCut,
} from '../models/CashCut'
import {
  crearDesgloseEfectivoVacio,
  type DesgloseEfectivo,
} from '../models/Efectivo'
import {
  calcularTotalEfectivo,
  convertirPesosACentavos,
  sumarDesglosesEfectivo,
} from '../services/efectivo'

export type CashCutSelectionResult = {
  selectedIds: string[]
  error?: string
}

export type CashCutCashSummary = {
  breakdown: DesgloseEfectivo
  amount: number
  error?: string
}

export function cashCutStoreKey(cut: CashCut): string {
  return obtenerIdentidadTienda(cut)
}

export function toggleCashCutSelection(
  selectedIds: string[],
  cut: CashCut,
  cuts: CashCut[],
): CashCutSelectionResult {
  if (selectedIds.includes(cut.id)) {
    return {
      selectedIds: selectedIds.filter((id) => id !== cut.id),
    }
  }

  if (cut.status !== 'pending') {
    return {
      selectedIds,
      error: 'Este corte ya fue incluido en otro movimiento.',
    }
  }

  const selectedCuts = cuts.filter((item) => selectedIds.includes(item.id))
  const targetStoreKey = cashCutStoreKey(cut)
  const hasDifferentStore = selectedCuts.some(
    (item) => cashCutStoreKey(item) !== targetStoreKey,
  )

  if (hasDifferentStore) {
    return {
      selectedIds,
      error: 'Solo puedes consolidar cortes de la misma tienda.',
    }
  }

  return {
    selectedIds: [...selectedIds, cut.id],
  }
}

export function cashCutSuggestedConcept(cuts: CashCut[]): string {
  const storeName = cuts[0]?.storeName?.trim()

  return storeName ? `Corte de Caja ${storeName}` : 'Corte de Caja'
}

export function summarizeCashCuts(
  cuts: readonly CashCut[],
): CashCutCashSummary {
  try {
    const hasInconsistentCut = cuts.some(
      (cut) =>
        convertirPesosACentavos(cut.withdrawnAmount) !==
        convertirPesosACentavos(
          calcularTotalEfectivo(cut.withdrawnBreakdown),
        ),
    )

    if (hasInconsistentCut) {
      throw new Error('Cash cut amount does not match its breakdown')
    }

    const breakdown = sumarDesglosesEfectivo(
      cuts.map(({ withdrawnBreakdown }) => withdrawnBreakdown),
    )

    return {
      breakdown,
      amount: calcularTotalEfectivo(breakdown),
    }
  } catch {
    return {
      breakdown: crearDesgloseEfectivoVacio(),
      amount: 0,
      error:
        'El monto de uno de los cortes no coincide con su desglose de efectivo.',
    }
  }
}

export function toDateTimeLocal(value?: string): string {
  if (!value) {
    const now = new Date()
    const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)

    return localTime.toISOString().slice(0, 16)
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return value.slice(0, 16)
  }

  const localTime = new Date(
    parsed.getTime() - parsed.getTimezoneOffset() * 60_000,
  )

  return localTime.toISOString().slice(0, 16)
}

export function fromDateTimeLocal(value: string): string {
  const parsed = new Date(value)

  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString()
}

export function toLocalDate(value = new Date()): string {
  const localTime = new Date(
    value.getTime() - value.getTimezoneOffset() * 60_000,
  )

  return localTime.toISOString().slice(0, 10)
}
