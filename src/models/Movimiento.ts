import type { Categoria } from './Categoria'

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

export type Billetes = {
  b1000: number
  b500: number
  b200: number
  b100: number
  b50: number
  b20: number
  monedas: number
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
  estadoExportacion: EstadoExportacion
  exportadoEn?: string
  loteExportacionId?: string
  creadoEn: string
  actualizadoEn: string
}
