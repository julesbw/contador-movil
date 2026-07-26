import type { DesgloseEfectivo } from './Efectivo'

export const CASH_CUT_STATUSES = ['pending', 'included'] as const
export type CashCutStatus = (typeof CASH_CUT_STATUSES)[number]

export type CashCut = {
  id: string
  date: string
  concept: string
  storeId?: string
  storeName?: string
  notes?: string
  countedBreakdown: DesgloseEfectivo
  countedAmount: number
  fundBreakdown: DesgloseEfectivo
  fundAmount: number
  withdrawnBreakdown: DesgloseEfectivo
  withdrawnAmount: number
  status: CashCutStatus
  movementId?: string
  createdAt: string
  updatedAt: string
}

export function obtenerIdentidadTienda(
  cashCut: Pick<CashCut, 'storeId' | 'storeName'>,
): string {
  const storeId = cashCut.storeId?.trim()

  if (storeId) {
    return `id:${storeId}`
  }

  const storeName = cashCut.storeName?.trim()

  return storeName
    ? `name:${storeName.toLocaleLowerCase('es-MX')}`
    : 'sin-tienda'
}
