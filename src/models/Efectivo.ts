export const DENOMINACIONES_EFECTIVO = [
  {
    key: 'b1000',
    label: '$1,000',
    valor: 1000,
    permiteDecimal: false,
  },
  {
    key: 'b500',
    label: '$500',
    valor: 500,
    permiteDecimal: false,
  },
  {
    key: 'b200',
    label: '$200',
    valor: 200,
    permiteDecimal: false,
  },
  {
    key: 'b100',
    label: '$100',
    valor: 100,
    permiteDecimal: false,
  },
  {
    key: 'b50',
    label: '$50',
    valor: 50,
    permiteDecimal: false,
  },
  {
    key: 'b20',
    label: '$20',
    valor: 20,
    permiteDecimal: false,
  },
  {
    key: 'monedas',
    label: 'Monedas',
    valor: 1,
    permiteDecimal: true,
  },
] as const

export type DenominacionEfectivo =
  (typeof DENOMINACIONES_EFECTIVO)[number]
export type ClaveDenominacionEfectivo = DenominacionEfectivo['key']
export type DesgloseEfectivo = Record<ClaveDenominacionEfectivo, number>

export const DESGLOSE_EFECTIVO_EN_CERO = {
  b1000: 0,
  b500: 0,
  b200: 0,
  b100: 0,
  b50: 0,
  b20: 0,
  monedas: 0,
} as const satisfies DesgloseEfectivo

export function crearDesgloseEfectivoVacio(): DesgloseEfectivo {
  return { ...DESGLOSE_EFECTIVO_EN_CERO }
}
