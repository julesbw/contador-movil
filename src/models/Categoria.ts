export const CATEGORIAS = [
  'Transporte',
  'Comida',
  'Compras',
  'Sueldos',
  'Mantenimiento',
  'Servicios',
  'Otros',
] as const

export type Categoria = (typeof CATEGORIAS)[number]
