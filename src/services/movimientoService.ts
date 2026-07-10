import {
  movimientosRepo,
  type MovimientosRepository,
  type PaginaMovimientos,
} from '../db/movimientosRepo'
import type { Movimiento } from '../models/Movimiento'
import {
  validarMovimiento,
  type DatosMovimiento,
  type ResultadoValidacion,
} from './movimientoValidation'

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

export class MovimientoService {
  private readonly repository: MovimientosRepository

  constructor(repository: MovimientosRepository = movimientosRepo) {
    this.repository = repository
  }

  validar(datos: DatosMovimiento): ResultadoValidacion {
    return validarMovimiento(datos)
  }

  async crear(datos: DatosMovimiento): Promise<Movimiento> {
    this.validarSinErrores(datos)

    const ahora = new Date().toISOString()
    const movimiento: Movimiento = {
      ...datos,
      concepto: datos.concepto.trim(),
      notas: datos.notas?.trim() || undefined,
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

  async actualizar(id: string, datos: DatosMovimiento): Promise<Movimiento> {
    const movimientoActual = await this.obtenerEditable(id)

    this.validarSinErrores(datos)

    const cambios = {
      ...datos,
      concepto: datos.concepto.trim(),
      notas: datos.notas?.trim() || undefined,
      actualizadoEn: new Date().toISOString(),
    }
    const movimientoActualizado: Movimiento = {
      ...movimientoActual,
      ...cambios,
    }

    await this.repository.actualizar(id, cambios)

    return movimientoActualizado
  }

  async eliminar(id: string): Promise<void> {
    await this.obtenerEditable(id)
    await this.repository.eliminar(id)
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
}

export const movimientoService = new MovimientoService()
