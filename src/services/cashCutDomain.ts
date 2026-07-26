import {
  obtenerIdentidadTienda,
  type CashCut,
} from '../models/CashCut'
import { esFechaCalendarioValida } from '../domain/fecha'
import { CATEGORIA_CORTE_CAJA } from '../models/Categoria'
import type { DesgloseEfectivo } from '../models/Efectivo'
import type { Movimiento } from '../models/Movimiento'
import {
  calcularTotalEfectivo,
  convertirPesosACentavos,
  desglosesEfectivoIguales,
  restarDesglosesEfectivo,
  sumarDesglosesEfectivo,
  validarDesgloseEfectivo,
  validarFondoContraConteo,
} from './efectivo'

export type CreateCashCutInput = {
  date: string
  concept?: string
  storeId?: string
  storeName?: string
  notes?: string
  countedBreakdown: DesgloseEfectivo
  fundBreakdown: DesgloseEfectivo
}

export type CreateCashCutContext = {
  id: string
  now: string
}

export type CreateMovementFromCashCutsInput = {
  concept: string
  date: string
  notes?: string
}

export type CreateMovementFromCashCutsContext = {
  id: string
  now: string
}

export class CashCutValidationError extends Error {
  readonly errores: string[]

  constructor(errores: string[]) {
    super(errores.join('. '))
    this.name = 'CashCutValidationError'
    this.errores = errores
  }
}

export class CashCutAlreadyIncludedError extends Error {
  constructor(id: string) {
    super(`El corte con id "${id}" ya fue incluido en otro movimiento`)
    this.name = 'CashCutAlreadyIncludedError'
  }
}

export class CashCutsDifferentStoresError extends Error {
  constructor() {
    super('Solo se pueden consolidar cortes de la misma tienda')
    this.name = 'CashCutsDifferentStoresError'
  }
}

function textoOpcional(value?: string): string | undefined {
  return value?.trim() || undefined
}

export { obtenerIdentidadTienda }

function validarFecha(date: string): string[] {
  const normalized = date.trim()

  if (normalized.length === 0) {
    return ['La fecha y hora del corte es obligatoria']
  }

  const datePart = normalized.slice(0, 10)

  if (
    !/^\d{4}-\d{2}-\d{2}T/.test(normalized) ||
    !esFechaCalendarioValida(datePart) ||
    Number.isNaN(new Date(normalized).getTime())
  ) {
    return ['La fecha y hora del corte no es válida']
  }

  return []
}

function validarFechaMovimiento(date: string): string[] {
  const normalized = date.trim()

  if (normalized.length === 0) {
    return ['La fecha del movimiento es obligatoria']
  }

  return !esFechaCalendarioValida(normalized)
    ? ['La fecha del movimiento no es válida']
    : []
}

function validarIntegridadCorte(cashCut: CashCut): string[] {
  const errores = [
    ...validarDesgloseEfectivo(cashCut.countedBreakdown).errores,
    ...validarFondoContraConteo(
      cashCut.countedBreakdown,
      cashCut.fundBreakdown,
    ).errores,
    ...validarDesgloseEfectivo(cashCut.withdrawnBreakdown).errores,
  ]

  if (errores.length > 0) {
    return [...new Set(errores)]
  }

  const retiroEsperado = restarDesglosesEfectivo(
    cashCut.countedBreakdown,
    cashCut.fundBreakdown,
  )

  if (
    convertirPesosACentavos(cashCut.countedAmount) !==
      convertirPesosACentavos(
        calcularTotalEfectivo(cashCut.countedBreakdown),
      ) ||
    convertirPesosACentavos(cashCut.fundAmount) !==
      convertirPesosACentavos(
        calcularTotalEfectivo(cashCut.fundBreakdown),
      ) ||
    convertirPesosACentavos(cashCut.withdrawnAmount) !==
      convertirPesosACentavos(
        calcularTotalEfectivo(cashCut.withdrawnBreakdown),
      ) ||
    !desglosesEfectivoIguales(
      cashCut.withdrawnBreakdown,
      retiroEsperado,
    )
  ) {
    errores.push('Los montos del corte no coinciden con sus desgloses')
  }

  return [...new Set(errores)]
}

export function crearCorteCaja(
  input: CreateCashCutInput,
  context: CreateCashCutContext,
): CashCut {
  const errores = [
    ...validarFecha(input.date),
    ...validarDesgloseEfectivo(input.countedBreakdown).errores,
    ...validarFondoContraConteo(
      input.countedBreakdown,
      input.fundBreakdown,
    ).errores,
  ]

  if (
    errores.length === 0 &&
    calcularTotalEfectivo(input.countedBreakdown) <= 0
  ) {
    errores.push('El efectivo contado debe ser mayor a cero')
  }

  if (errores.length > 0) {
    throw new CashCutValidationError([...new Set(errores)])
  }

  const storeId = textoOpcional(input.storeId)
  const storeName = textoOpcional(input.storeName)
  const countedBreakdown = { ...input.countedBreakdown }
  const fundBreakdown = { ...input.fundBreakdown }
  const withdrawnBreakdown = restarDesglosesEfectivo(
    countedBreakdown,
    fundBreakdown,
  )
  const concept =
    textoOpcional(input.concept) ??
    (storeName ? `Corte de caja ${storeName}` : 'Corte de caja')

  return {
    id: context.id,
    date: input.date.trim(),
    concept,
    ...(storeId ? { storeId } : {}),
    ...(storeName ? { storeName } : {}),
    ...(textoOpcional(input.notes)
      ? { notes: textoOpcional(input.notes) }
      : {}),
    countedBreakdown,
    countedAmount: calcularTotalEfectivo(countedBreakdown),
    fundBreakdown,
    fundAmount: calcularTotalEfectivo(fundBreakdown),
    withdrawnBreakdown,
    withdrawnAmount: calcularTotalEfectivo(withdrawnBreakdown),
    status: 'pending',
    createdAt: context.now,
    updatedAt: context.now,
  }
}

export function actualizarCorteCaja(
  current: CashCut,
  input: CreateCashCutInput,
  now: string,
): CashCut {
  if (current.status !== 'pending') {
    throw new CashCutAlreadyIncludedError(current.id)
  }

  const updated = crearCorteCaja(input, {
    id: current.id,
    now,
  })

  return {
    ...updated,
    createdAt: current.createdAt,
  }
}

export function crearMovimientoDesdeCortes(
  cashCuts: readonly CashCut[],
  input: CreateMovementFromCashCutsInput,
  context: CreateMovementFromCashCutsContext,
): Movimiento {
  const errores: string[] = []

  if (cashCuts.length === 0) {
    errores.push('Selecciona al menos un corte de caja')
  }

  const ids = cashCuts.map(({ id }) => id)

  if (new Set(ids).size !== ids.length) {
    errores.push('No se puede incluir el mismo corte más de una vez')
  }

  for (const cashCut of cashCuts) {
    if (
      cashCut.status !== 'pending' ||
      cashCut.movementId !== undefined
    ) {
      throw new CashCutAlreadyIncludedError(cashCut.id)
    }

    errores.push(...validarIntegridadCorte(cashCut))
  }

  if (
    new Set(cashCuts.map(obtenerIdentidadTienda)).size > 1
  ) {
    throw new CashCutsDifferentStoresError()
  }

  if (input.concept.trim().length === 0) {
    errores.push('El concepto del movimiento es obligatorio')
  }

  errores.push(...validarFechaMovimiento(input.date))

  const breakdown = sumarDesglosesEfectivo(
    cashCuts.map(({ withdrawnBreakdown }) => withdrawnBreakdown),
  )
  const amount = calcularTotalEfectivo(breakdown)

  if (cashCuts.length > 0 && amount <= 0) {
    errores.push('El efectivo retirado debe ser mayor a cero')
  }

  if (errores.length > 0) {
    throw new CashCutValidationError([...new Set(errores)])
  }

  return {
    id: context.id,
    tipo: 'entrada',
    fechaMovimiento: input.date.trim(),
    monto: amount,
    concepto: input.concept.trim(),
    categoria: CATEGORIA_CORTE_CAJA,
    formaPago: 'efectivo',
    billetes: breakdown,
    ...(textoOpcional(input.notes)
      ? { notas: textoOpcional(input.notes) }
      : {}),
    source: {
      type: 'cash-cuts',
      cashCutIds: ids,
    },
    estadoExportacion: 'pendiente',
    creadoEn: context.now,
    actualizadoEn: context.now,
  }
}

export const createCashCut = crearCorteCaja
export const createMovementFromCashCuts = crearMovimientoDesdeCortes
