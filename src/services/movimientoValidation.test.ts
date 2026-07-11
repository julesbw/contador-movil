import { describe, expect, it } from 'vitest'
import type { DatosMovimiento } from './movimientoValidation'
import {
  calcularTotalBilletes,
  validarMovimiento,
} from './movimientoValidation'

function crearDatos(
  cambios: Partial<DatosMovimiento> = {},
): DatosMovimiento {
  return {
    tipo: 'salida',
    fechaMovimiento: '2026-07-08',
    monto: 100,
    concepto: 'Papelería',
    categoria: 'Compras',
    formaPago: 'efectivo',
    billetes: {
      b1000: 0,
      b500: 0,
      b200: 0,
      b100: 1,
      b50: 0,
      b20: 0,
      monedas: 0,
    },
    notas: '',
    ...cambios,
  }
}

describe('validarMovimiento', () => {
  it('acepta un movimiento en efectivo con total contado mayor a cero', () => {
    expect(validarMovimiento(crearDatos())).toEqual({
      errores: [],
      advertencias: [],
    })
  })

  it('no advierte descuadres cuando el movimiento es en efectivo', () => {
    const resultado = validarMovimiento(crearDatos({ monto: 120 }))

    expect(resultado.errores).toEqual([])
    expect(resultado.advertencias).toEqual([])
  })

  it('rechaza efectivo con total contado en cero', () => {
    const resultado = validarMovimiento(
      crearDatos({
        monto: 0,
        billetes: {
          b1000: 0,
          b500: 0,
          b200: 0,
          b100: 0,
          b50: 0,
          b20: 0,
          monedas: 0,
        },
      }),
    )

    expect(resultado.errores).toContain('El total contado debe ser mayor a cero')
  })

  it('rechaza campos requeridos y montos inválidos', () => {
    const resultado = validarMovimiento(
      crearDatos({
        formaPago: 'tarjeta',
        monto: 0,
        concepto: ' ',
        fechaMovimiento: '',
      }),
    )

    expect(resultado.errores).toContain('El monto debe ser mayor a cero')
    expect(resultado.errores).toContain('El concepto es obligatorio')
    expect(resultado.errores).toContain('La fecha es obligatoria')
  })

  it('rechaza cantidades negativas o fraccionarias de billetes', () => {
    const resultado = validarMovimiento(
      crearDatos({
        billetes: {
          ...crearDatos().billetes,
          b100: -1,
          b50: 1.5,
        },
      }),
    )

    expect(resultado.errores).toContain(
      'El desglose de efectivo contiene valores inválidos',
    )
    expect(resultado.errores).toContain(
      'Las cantidades de billetes deben ser números enteros',
    )
  })

  it('no valida desglose de efectivo cuando la forma de pago no es efectivo', () => {
    const resultado = validarMovimiento(
      crearDatos({
        formaPago: 'transferencia',
        billetes: {
          ...crearDatos().billetes,
          b100: -1,
          b50: 1.5,
        },
      }),
    )

    expect(resultado.errores).toEqual([])
  })
})

describe('calcularTotalBilletes', () => {
  it('suma denominaciones y monedas', () => {
    expect(
      calcularTotalBilletes({
        b1000: 1,
        b500: 1,
        b200: 1,
        b100: 1,
        b50: 1,
        b20: 1,
        monedas: 12.5,
      }),
    ).toBe(1882.5)
  })
})
