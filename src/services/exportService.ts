import {
  MovimientosLoteDesactualizadoError,
  movimientosRepo,
  type MovimientosRepository,
} from '../db/movimientosRepo'
import type { Movimiento } from '../models/Movimiento'
import {
  configService,
  type ConfigService,
} from './configService'
import { ordenarPendientesPorFecha } from './exportSelection'

type MovimientoExportado = {
  id: string
  tipo: Movimiento['tipo']
  fecha_movimiento: string
  monto: number
  concepto: string
  categoria: Movimiento['categoria']
  forma_pago: Movimiento['formaPago']
  billetes: Movimiento['billetes']
  notas: string
  creado_en: string
  actualizado_en: string
}

export type ArchivoExportacion = {
  version: '1.0'
  origen: 'contador_mobile_pwa'
  tipo_exportacion: 'movimientos'
  lote_exportacion_id: string
  fecha_exportacion: string
  zona_horaria: string
  dispositivo_id: string
  capturado_por: string
  total_movimientos: number
  movimientos: MovimientoExportado[]
}

export type LotePendiente = {
  archivo: ArchivoExportacion
  movimientoIds: string[]
  nombreArchivo: string
}

export class PendientesDesactualizadosError extends Error {
  constructor() {
    super('Uno o más movimientos ya no están pendientes')
    this.name = 'PendientesDesactualizadosError'
  }
}

function mapearMovimiento(movimiento: Movimiento): MovimientoExportado {
  return {
    id: movimiento.id,
    tipo: movimiento.tipo,
    fecha_movimiento: movimiento.fechaMovimiento,
    monto: movimiento.monto,
    concepto: movimiento.concepto,
    categoria: movimiento.categoria,
    forma_pago: movimiento.formaPago,
    billetes: movimiento.billetes,
    notas: movimiento.notas ?? '',
    creado_en: movimiento.creadoEn,
    actualizado_en: movimiento.actualizadoEn,
  }
}

function fechaParaNombre(fechaIso: string): string {
  return fechaIso.replaceAll(':', '-').replace(/\.\d{3}Z$/, 'Z')
}

export class ExportService {
  private readonly repository: MovimientosRepository
  private readonly configuracion: ConfigService

  constructor(
    repository: MovimientosRepository = movimientosRepo,
    configuracion: ConfigService = configService,
  ) {
    this.repository = repository
    this.configuracion = configuracion
  }

  async prepararPendientes(): Promise<LotePendiente> {
    const movimientos = await this.obtenerPendientes()

    if (movimientos.length === 0) {
      throw new Error('No hay movimientos pendientes para exportar')
    }

    const loteExportacionId = crypto.randomUUID()
    const archivo = await this.crearArchivo(movimientos, loteExportacionId)

    return {
      archivo,
      movimientoIds: movimientos.map(({ id }) => id),
      nombreArchivo: `movimientos-pendientes-${fechaParaNombre(archivo.fecha_exportacion)}.json`,
    }
  }

  async obtenerPendientes(): Promise<Movimiento[]> {
    const movimientos = await this.repository.obtenerPendientes()

    return ordenarPendientesPorFecha(movimientos)
  }

  async prepararPendientesSeleccionados(
    movimientoIds: readonly string[],
  ): Promise<LotePendiente> {
    if (movimientoIds.length === 0) {
      throw new Error('Selecciona al menos un movimiento para exportar')
    }

    const idsSolicitados = new Set(movimientoIds)

    if (idsSolicitados.size !== movimientoIds.length) {
      throw new PendientesDesactualizadosError()
    }

    const pendientes = await this.obtenerPendientes()
    const movimientos = pendientes.filter(({ id }) =>
      idsSolicitados.has(id),
    )

    if (movimientos.length !== idsSolicitados.size) {
      throw new PendientesDesactualizadosError()
    }

    const loteExportacionId = crypto.randomUUID()
    const archivo = await this.crearArchivo(movimientos, loteExportacionId)

    return {
      archivo,
      movimientoIds: movimientos.map(({ id }) => id),
      nombreArchivo: `movimientos-pendientes-${fechaParaNombre(archivo.fecha_exportacion)}.json`,
    }
  }

  async prepararRespaldo(): Promise<LotePendiente> {
    const movimientos = await this.repository.obtenerTodos()

    if (movimientos.length === 0) {
      throw new Error('No hay movimientos para respaldar')
    }

    const archivo = await this.crearArchivo(
      movimientos,
      crypto.randomUUID(),
    )

    return {
      archivo,
      movimientoIds: [],
      nombreArchivo: `respaldo-movimientos-${fechaParaNombre(archivo.fecha_exportacion)}.json`,
    }
  }

  async confirmarPendientes(lote: LotePendiente): Promise<void> {
    if (lote.movimientoIds.length === 0) {
      throw new Error('El lote no contiene movimientos pendientes')
    }

    try {
      await this.repository.marcarExportados(
        lote.movimientoIds,
        lote.archivo.lote_exportacion_id,
        new Date().toISOString(),
      )
    } catch (cause: unknown) {
      if (cause instanceof MovimientosLoteDesactualizadoError) {
        throw new PendientesDesactualizadosError()
      }

      throw cause
    }
  }

  private async crearArchivo(
    movimientos: Movimiento[],
    loteExportacionId: string,
  ): Promise<ArchivoExportacion> {
    const configuracion = await this.configuracion.inicializar()

    return {
      version: '1.0',
      origen: 'contador_mobile_pwa',
      tipo_exportacion: 'movimientos',
      lote_exportacion_id: loteExportacionId,
      fecha_exportacion: new Date().toISOString(),
      zona_horaria: Intl.DateTimeFormat().resolvedOptions().timeZone,
      dispositivo_id: configuracion.dispositivoId,
      capturado_por: configuracion.capturadoPor,
      total_movimientos: movimientos.length,
      movimientos: movimientos.map(mapearMovimiento),
    }
  }
}

export function descargarArchivoJson(lote: LotePendiente): void {
  const contenido = JSON.stringify(lote.archivo, null, 2)
  const blob = new Blob([contenido], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')

  enlace.href = url
  enlace.download = lote.nombreArchivo
  enlace.click()

  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const exportService = new ExportService()
