export const CATEGORIAS_MANUALES = [
  'Transporte',
  'Comida',
  'Compras',
  'Sueldos',
  'Mantenimiento',
  'Servicios',
  'Otros',
] as const

export const CATEGORIA_CORTE_CAJA = 'Corte de caja' as const

export const CATEGORIAS = [
  ...CATEGORIAS_MANUALES,
  CATEGORIA_CORTE_CAJA,
] as const

export type Categoria = (typeof CATEGORIAS)[number]
