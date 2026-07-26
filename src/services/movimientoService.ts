import {
  MovimientoActualizacionDesactualizadaError,
  MovimientoEliminacionDesactualizadaError,
  movimientosRepo,
  type MovimientosRepository,
  type PaginaMovimientos,
} from '../db/movimientosRepo'
import { siguienteTimestamp } from '../domain/timestamp'
import { crearDesgloseEfectivoVacio } from '../models/Efectivo'
import type { Movimiento } from '../models/Movimiento'
import {
  convertirPesosACentavos,
  desglosesEfectivoIguales,
} from './efectivo'
import {
  calcularTotalBilletes,
  validarMovimiento,
  type DatosMovimiento,
  type ResultadoValidacion,
} from './movimientoValidation'

function normalizarDatos(datos: DatosMovimiento): DatosMovimiento {
  if (datos.formaPago === 'efectivo') {
    let monto = Number.NaN

    try {
      monto = calcularTotalBilletes(datos.billetes)
    } catch {
      // La validación detallada del desglose se ejecuta después.
    }

    return {
      ...datos,
      monto,
    }
  }

  return {
    ...datos,
    billetes: crearDesgloseEfectivoVacio(),
  }
}

export class MovimientoValidationError extends Error {
  readonly errores: string[]

  constructor(errores: string[]) {
    super(errores.join('. '))
    this.name = 'MovimientoValidationError'
    this.errores = errores
  }
}

export class MovimientoNoEditableError extends Error {
  constructor(id: string) {
    super(`El movimiento exportado con id "${id}" no puede modificarse`)
    this.name = 'MovimientoNoEditableError'
  }
}

export class MovimientoNoEncontradoError extends Error {
  constructor(id: string) {
    super(`No existe el movimiento con id "${id}"`)
    this.name = 'MovimientoNoEncontradoError'
  }
}

export class MovimientoDesactualizadoError extends Error {
  constructor(id: string) {
    super(
      `El movimiento con id "${id}" cambió desde que fue consultado`,
    )
    this.name = 'MovimientoDesactualizadoError'
  }
}

export class MovimientoCashCutsNoEditableError extends Error {
  constructor(id: string) {
    super(
      `El monto y desglose del movimiento generado con id "${id}" no pueden modificarse`,
    )
    this.name = 'MovimientoCashCutsNoEditableError'
  }
}

export class MovimientoService {
  private readonly repository: MovimientosRepository

  constructor(repository: MovimientosRepository = movimientosRepo) {
    this.repository = repository
  }

  validar(datos: DatosMovimiento): ResultadoValidacion {
    return validarMovimiento(normalizarDatos(datos))
  }

  async crear(datos: DatosMovimiento): Promise<Movimiento> {
    const datosNormalizados = normalizarDatos(datos)

    this.validarSinErrores(datosNormalizados)

    const ahora = new Date().toISOString()
    const movimiento: Movimiento = {
      ...datosNormalizados,
      concepto: datosNormalizados.concepto.trim(),
      notas: datosNormalizados.notas?.trim() || undefined,
      id: crypto.randomUUID(),
      estadoExportacion: 'pendiente',
      creadoEn: ahora,
      actualizadoEn: ahora,
    }

    await this.repository.guardar(movimiento)

    return movimiento
  }

  obtenerPagina(opciones: PaginaMovimientos): Promise<Movimiento[]> {
    return this.repository.obtenerPagina(opciones)
  }

  obtenerPorId(id: string): Promise<Movimiento | undefined> {
    return this.repository.obtenerPorId(id)
  }

  async actualizar(
    id: string,
    datos: DatosMovimiento,
    expectedActualizadoEn: string,
  ): Promise<Movimiento> {
    const movimientoActual = await this.obtenerEditable(id)

    if (movimientoActual.actualizadoEn !== expectedActualizadoEn) {
      throw new MovimientoDesactualizadoError(id)
    }

    const generadoDesdeCortes =
      movimientoActual.source?.type === 'cash-cuts'
    const datosNormalizados = generadoDesdeCortes
      ? this.normalizarEdicionCashCuts(movimientoActual, datos)
      : normalizarDatos(datos)

    this.validarSinErrores(datosNormalizados)

    const actualizadoEn = siguienteTimestamp(
      movimientoActual.actualizadoEn,
    )
    const cambios = generadoDesdeCortes
      ? {
          fechaMovimiento: datosNormalizados.fechaMovimiento,
          concepto: datosNormalizados.concepto.trim(),
          notas: datosNormalizados.notas?.trim() || undefined,
          actualizadoEn,
        }
      : {
          ...datosNormalizados,
          concepto: datosNormalizados.concepto.trim(),
          notas: datosNormalizados.notas?.trim() || undefined,
          actualizadoEn,
        }
    const movimientoActualizado: Movimiento = {
      ...movimientoActual,
      ...cambios,
    }

    try {
      await this.repository.actualizar(
        id,
        cambios,
        expectedActualizadoEn,
      )
    } catch (error: unknown) {
      if (
        error instanceof MovimientoActualizacionDesactualizadaError
      ) {
        throw new MovimientoDesactualizadoError(id)
      }

      throw error
    }

    return movimientoActualizado
  }

  async eliminar(
    id: string,
    expectedActualizadoEn: string,
  ): Promise<void> {
    const movimiento = await this.obtenerEditable(id)

    if (movimiento.actualizadoEn !== expectedActualizadoEn) {
      throw new MovimientoDesactualizadoError(id)
    }

    try {
      await this.repository.eliminar(id, expectedActualizadoEn)
    } catch (error: unknown) {
      if (
        error instanceof MovimientoEliminacionDesactualizadaError
      ) {
        throw new MovimientoDesactualizadoError(id)
      }

      throw error
    }
  }

  private validarSinErrores(datos: DatosMovimiento): void {
    const { errores } = this.validar(datos)

    if (errores.length > 0) {
      throw new MovimientoValidationError(errores)
    }
  }

  private async obtenerEditable(id: string): Promise<Movimiento> {
    const movimiento = await this.repository.obtenerPorId(id)

    if (!movimiento) {
      throw new MovimientoNoEncontradoError(id)
    }

    if (movimiento.estadoExportacion === 'exportado') {
      throw new MovimientoNoEditableError(id)
    }

    return movimiento
  }

  private normalizarEdicionCashCuts(
    current: Movimiento,
    datos: DatosMovimiento,
  ): DatosMovimiento {
    const datosFinancierosCoinciden =
      datos.tipo === current.tipo &&
      datos.categoria === current.categoria &&
      datos.formaPago === current.formaPago &&
      convertirPesosACentavos(datos.monto) ===
        convertirPesosACentavos(current.monto) &&
      desglosesEfectivoIguales(datos.billetes, current.billetes)

    if (!datosFinancierosCoinciden) {
      throw new MovimientoCashCutsNoEditableError(current.id)
    }

    return {
      tipo: current.tipo,
      fechaMovimiento: datos.fechaMovimiento,
      monto: current.monto,
      concepto: datos.concepto,
      categoria: current.categoria,
      formaPago: current.formaPago,
      billetes: { ...current.billetes },
      notas: datos.notas,
    }
  }
}

export const movimientoService = new MovimientoService()
