import { CATEGORIAS } from '../models/Categoria'
import {
  FORMAS_PAGO,
  TIPOS_MOVIMIENTO,
  type Billetes,
  type Movimiento,
} from '../models/Movimiento'

export type DatosMovimiento = Pick<
  Movimiento,
  | 'tipo'
  | 'fechaMovimiento'
  | 'monto'
  | 'concepto'
  | 'categoria'
  | 'formaPago'
  | 'billetes'
  | 'notas'
>

export type ResultadoValidacion = {
  errores: string[]
  advertencias: string[]
}

export function calcularTotalBilletes(billetes: Billetes): number {
  return (
    billetes.b1000 * 1000 +
    billetes.b500 * 500 +
    billetes.b200 * 200 +
    billetes.b100 * 100 +
    billetes.b50 * 50 +
    billetes.b20 * 20 +
    billetes.monedas
  )
}

export function validarMovimiento(
  movimiento: DatosMovimiento,
): ResultadoValidacion {
  const errores: string[] = []
  const advertencias: string[] = []

  if (!TIPOS_MOVIMIENTO.includes(movimiento.tipo)) {
    errores.push('El tipo de movimiento no es válido')
  }

  if (
    movimiento.formaPago !== 'efectivo' &&
    (!Number.isFinite(movimiento.monto) || movimiento.monto <= 0)
  ) {
    errores.push('El monto debe ser mayor a cero')
  }

  if (movimiento.concepto.trim().length === 0) {
    errores.push('El concepto es obligatorio')
  }

  if (!CATEGORIAS.includes(movimiento.categoria)) {
    errores.push('La categoría no es válida')
  }

  if (movimiento.fechaMovimiento.trim().length === 0) {
    errores.push('La fecha es obligatoria')
  }

  if (!FORMAS_PAGO.includes(movimiento.formaPago)) {
    errores.push('La forma de pago no es válida')
  }

  const denominaciones = Object.entries(movimiento.billetes) as Array<
    [keyof Billetes, number]
  >

  if (movimiento.formaPago === 'efectivo') {
    if (
      denominaciones.some(
        ([, cantidad]) => !Number.isFinite(cantidad) || cantidad < 0,
      )
    ) {
      errores.push('El desglose de efectivo contiene valores inválidos')
    }

    if (
      denominaciones.some(
        ([denominacion, cantidad]) =>
          denominacion !== 'monedas' && !Number.isInteger(cantidad),
      )
    ) {
      errores.push('Las cantidades de billetes deben ser números enteros')
    }

    if (errores.length === 0 && calcularTotalBilletes(movimiento.billetes) <= 0) {
      errores.push('El total contado debe ser mayor a cero')
    }
  }

  return { errores, advertencias }
}
