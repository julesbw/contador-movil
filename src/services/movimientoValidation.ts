import { CATEGORIAS } from '../models/Categoria'
import { esFechaCalendarioValida } from '../domain/fecha'
import {
  FORMAS_PAGO,
  TIPOS_MOVIMIENTO,
  type Movimiento,
} from '../models/Movimiento'
import {
  calcularTotalEfectivo,
  validarDesgloseEfectivo,
} from './efectivo'

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

export const calcularTotalBilletes = calcularTotalEfectivo

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

  const fechaMovimiento = movimiento.fechaMovimiento.trim()

  if (fechaMovimiento.length === 0) {
    errores.push('La fecha es obligatoria')
  } else if (!esFechaCalendarioValida(fechaMovimiento)) {
    errores.push('La fecha no es válida')
  }

  if (!FORMAS_PAGO.includes(movimiento.formaPago)) {
    errores.push('La forma de pago no es válida')
  }

  if (movimiento.formaPago === 'efectivo') {
    const validacionEfectivo = validarDesgloseEfectivo(
      movimiento.billetes,
    )

    if (validacionEfectivo.errores.length > 0) {
      errores.push('El desglose de efectivo contiene valores inválidos')
    }

    if (
      validacionEfectivo.errores.some((error) =>
        error.includes('cantidad entera'),
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
