import {
  crearDesgloseEfectivoVacio,
  DENOMINACIONES_EFECTIVO,
  type DesgloseEfectivo,
} from '../models/Efectivo'

const TOLERANCIA_CENTAVOS = 1e-7

export type ResultadoValidacionEfectivo = {
  errores: string[]
}

export class DesgloseEfectivoInvalidoError extends Error {
  readonly errores: string[]

  constructor(errores: string[]) {
    super(errores.join('. '))
    this.name = 'DesgloseEfectivoInvalidoError'
    this.errores = errores
  }
}

export class FondoEfectivoInvalidoError extends Error {
  readonly errores: string[]

  constructor(errores: string[]) {
    super(errores.join('. '))
    this.name = 'FondoEfectivoInvalidoError'
    this.errores = errores
  }
}

export function convertirPesosACentavos(valor: number): number {
  const valorEnCentavos = valor * 100
  const centavos = Math.round(valorEnCentavos)

  if (
    !Number.isFinite(valor) ||
    !Number.isSafeInteger(centavos) ||
    Math.abs(valorEnCentavos - centavos) > TOLERANCIA_CENTAVOS
  ) {
    throw new DesgloseEfectivoInvalidoError([
      'Los importes deben expresarse con un máximo de dos decimales',
    ])
  }

  return centavos
}

export function convertirCentavosAPesos(centavos: number): number {
  if (!Number.isSafeInteger(centavos)) {
    throw new DesgloseEfectivoInvalidoError([
      'El importe en centavos está fuera del rango permitido',
    ])
  }

  return centavos / 100
}

export function validarDesgloseEfectivo(
  desglose: DesgloseEfectivo,
): ResultadoValidacionEfectivo {
  const errores: string[] = []

  for (const denominacion of DENOMINACIONES_EFECTIVO) {
    const cantidad = desglose[denominacion.key]

    if (!Number.isFinite(cantidad) || cantidad < 0) {
      errores.push(
        `${denominacion.label} debe contener un valor no negativo`,
      )
      continue
    }

    if (
      !denominacion.permiteDecimal &&
      !Number.isSafeInteger(cantidad)
    ) {
      errores.push(
        `${denominacion.label} debe contener una cantidad entera`,
      )
      continue
    }

    if (denominacion.permiteDecimal) {
      try {
        convertirPesosACentavos(cantidad)
      } catch {
        errores.push(
          `${denominacion.label} admite como máximo dos decimales`,
        )
      }
    }
  }

  if (errores.length === 0) {
    try {
      calcularTotalCentavosSinValidar(desglose)
    } catch (error: unknown) {
      errores.push(
        error instanceof DesgloseEfectivoInvalidoError
          ? error.message
          : 'El total de efectivo está fuera del rango permitido',
      )
    }
  }

  return { errores }
}

function calcularTotalCentavosSinValidar(
  desglose: DesgloseEfectivo,
): number {
  let totalCentavos = convertirPesosACentavos(desglose.monedas)

  for (const denominacion of DENOMINACIONES_EFECTIVO) {
    if (denominacion.key === 'monedas') {
      continue
    }

    const subtotalCentavos =
      desglose[denominacion.key] * denominacion.valor * 100

    if (!Number.isSafeInteger(subtotalCentavos)) {
      throw new DesgloseEfectivoInvalidoError([
        'El total de efectivo está fuera del rango permitido',
      ])
    }

    totalCentavos += subtotalCentavos

    if (!Number.isSafeInteger(totalCentavos)) {
      throw new DesgloseEfectivoInvalidoError([
        'El total de efectivo está fuera del rango permitido',
      ])
    }
  }

  return totalCentavos
}

function validarSinErrores(desglose: DesgloseEfectivo): void {
  const { errores } = validarDesgloseEfectivo(desglose)

  if (errores.length > 0) {
    throw new DesgloseEfectivoInvalidoError(errores)
  }
}

export function calcularTotalEfectivo(
  desglose: DesgloseEfectivo,
): number {
  validarSinErrores(desglose)

  return convertirCentavosAPesos(
    calcularTotalCentavosSinValidar(desglose),
  )
}

export function sumarDesglosesEfectivo(
  desgloses: readonly DesgloseEfectivo[],
): DesgloseEfectivo {
  const suma = crearDesgloseEfectivoVacio()
  let monedasCentavos = 0

  for (const desglose of desgloses) {
    validarSinErrores(desglose)

    for (const denominacion of DENOMINACIONES_EFECTIVO) {
      if (denominacion.key === 'monedas') {
        monedasCentavos += convertirPesosACentavos(
          desglose.monedas,
        )
      } else {
        suma[denominacion.key] += desglose[denominacion.key]

        if (!Number.isSafeInteger(suma[denominacion.key])) {
          throw new DesgloseEfectivoInvalidoError([
            'La suma de billetes está fuera del rango permitido',
          ])
        }
      }
    }
  }

  suma.monedas = convertirCentavosAPesos(monedasCentavos)
  validarSinErrores(suma)

  return suma
}

export function validarFondoContraConteo(
  contado: DesgloseEfectivo,
  fondo: DesgloseEfectivo,
): ResultadoValidacionEfectivo {
  const errores = [
    ...validarDesgloseEfectivo(contado).errores,
    ...validarDesgloseEfectivo(fondo).errores,
  ]

  if (errores.length > 0) {
    return { errores: [...new Set(errores)] }
  }

  for (const denominacion of DENOMINACIONES_EFECTIVO) {
    const excede =
      denominacion.key === 'monedas'
        ? convertirPesosACentavos(fondo.monedas) >
          convertirPesosACentavos(contado.monedas)
        : fondo[denominacion.key] > contado[denominacion.key]

    if (excede) {
      errores.push(
        `El fondo de ${denominacion.label} supera el efectivo contado`,
      )
    }
  }

  return { errores }
}

export function restarDesglosesEfectivo(
  contado: DesgloseEfectivo,
  fondo: DesgloseEfectivo,
): DesgloseEfectivo {
  const { errores } = validarFondoContraConteo(contado, fondo)

  if (errores.length > 0) {
    throw new FondoEfectivoInvalidoError(errores)
  }

  const retiro = crearDesgloseEfectivoVacio()

  for (const denominacion of DENOMINACIONES_EFECTIVO) {
    if (denominacion.key === 'monedas') {
      retiro.monedas = convertirCentavosAPesos(
        convertirPesosACentavos(contado.monedas) -
          convertirPesosACentavos(fondo.monedas),
      )
    } else {
      retiro[denominacion.key] =
        contado[denominacion.key] - fondo[denominacion.key]
    }
  }

  return retiro
}

export function desglosesEfectivoIguales(
  primero: DesgloseEfectivo,
  segundo: DesgloseEfectivo,
): boolean {
  return DENOMINACIONES_EFECTIVO.every(({ key }) =>
    key === 'monedas'
      ? convertirPesosACentavos(primero.monedas) ===
        convertirPesosACentavos(segundo.monedas)
      : primero[key] === segundo[key],
  )
}

export const calculateCashTotal = calcularTotalEfectivo
export const sumCashBreakdowns = sumarDesglosesEfectivo
export const subtractCashBreakdowns = restarDesglosesEfectivo
export const validateFundAgainstCounted = validarFondoContraConteo
