import { describe, expect, it } from 'vitest'
import {
  crearDesgloseEfectivoVacio,
  type DesgloseEfectivo,
} from '../models/Efectivo'
import {
  calcularTotalEfectivo,
  DesgloseEfectivoInvalidoError,
  FondoEfectivoInvalidoError,
  restarDesglosesEfectivo,
  sumarDesglosesEfectivo,
  validarDesgloseEfectivo,
  validarFondoContraConteo,
} from './efectivo'

function crearDesglose(
  cambios: Partial<DesgloseEfectivo> = {},
): DesgloseEfectivo {
  return {
    ...crearDesgloseEfectivoVacio(),
    ...cambios,
  }
}

describe('dominio de efectivo', () => {
  it('calcula billetes como cantidades y monedas como importe', () => {
    expect(
      calcularTotalEfectivo(
        crearDesglose({
          b1000: 1,
          b500: 1,
          b200: 1,
          b100: 1,
          b50: 1,
          b20: 1,
          monedas: 12.5,
        }),
      ),
    ).toBe(1882.5)
  })

  it('suma y resta monedas en centavos sin errores binarios', () => {
    const suma = sumarDesglosesEfectivo([
      crearDesglose({ b100: 1, monedas: 0.1 }),
      crearDesglose({ b100: 2, monedas: 0.2 }),
    ])

    expect(suma).toEqual(
      crearDesglose({ b100: 3, monedas: 0.3 }),
    )
    expect(
      restarDesglosesEfectivo(
        crearDesglose({ b100: 3, monedas: 0.3 }),
        crearDesglose({ b100: 1, monedas: 0.1 }),
      ),
    ).toEqual(crearDesglose({ b100: 2, monedas: 0.2 }))
  })

  it('maneja desgloses vacíos y una lista vacía', () => {
    const vacio = crearDesglose()

    expect(calcularTotalEfectivo(vacio)).toBe(0)
    expect(sumarDesglosesEfectivo([])).toEqual(vacio)
    expect(restarDesglosesEfectivo(vacio, vacio)).toEqual(vacio)
  })

  it('rechaza negativos, billetes fraccionarios y más de dos decimales', () => {
    expect(
      validarDesgloseEfectivo(
        crearDesglose({
          b100: -1,
          b50: 1.5,
          monedas: 0.001,
        }),
      ).errores,
    ).toHaveLength(3)

    expect(() =>
      calcularTotalEfectivo(crearDesglose({ b20: -1 })),
    ).toThrow(DesgloseEfectivoInvalidoError)
  })

  it('rechaza un total que excede los centavos enteros seguros', () => {
    const desglose = crearDesglose({
      b1000: Number.MAX_SAFE_INTEGER,
    })

    expect(validarDesgloseEfectivo(desglose).errores).toContain(
      'El total de efectivo está fuera del rango permitido',
    )
    expect(() => calcularTotalEfectivo(desglose)).toThrow(
      DesgloseEfectivoInvalidoError,
    )
  })

  it('valida y rechaza un fondo superior por denominación', () => {
    const contado = crearDesglose({ b500: 1, monedas: 10 })
    const fondo = crearDesglose({ b500: 2, monedas: 11 })
    const resultado = validarFondoContraConteo(contado, fondo)

    expect(resultado.errores).toHaveLength(2)
    expect(() =>
      restarDesglosesEfectivo(contado, fondo),
    ).toThrow(FondoEfectivoInvalidoError)
  })
})
