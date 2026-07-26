import type { Categoria } from './Categoria'
import type { DesgloseEfectivo } from './Efectivo'

export const TIPOS_MOVIMIENTO = ['entrada', 'salida'] as const
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number]

export const FORMAS_PAGO = [
  'efectivo',
  'tarjeta',
  'transferencia',
  'otro',
] as const
export type FormaPago = (typeof FORMAS_PAGO)[number]

export const ESTADOS_EXPORTACION = ['pendiente', 'exportado'] as const
export type EstadoExportacion = (typeof ESTADOS_EXPORTACION)[number]

export type Billetes = DesgloseEfectivo

export type CashCutMovementSource = {
  type: 'cash-cuts'
  cashCutIds: string[]
}

export type Movimiento = {
  id: string
  tipo: TipoMovimiento
  fechaMovimiento: string
  monto: number
  concepto: string
  categoria: Categoria
  formaPago: FormaPago
  billetes: Billetes
  notas?: string
  source?: CashCutMovementSource
  estadoExportacion: EstadoExportacion
  exportadoEn?: string
  loteExportacionId?: string
  creadoEn: string
  actualizadoEn: string
}
