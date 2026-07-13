import { db } from './db'
import type { Movimiento } from '../models/Movimiento'

export type PaginaMovimientos = {
  pagina: number
  tamanoPagina: number
}

export type CambiosMovimiento = Partial<
  Omit<Movimiento, 'id' | 'creadoEn'>
>

export class MovimientosLoteDesactualizadoError extends Error {
  constructor() {
    super('Uno o más movimientos del lote ya no están pendientes')
    this.name = 'MovimientosLoteDesactualizadoError'
  }
}

export interface MovimientosRepository {
  guardar(movimiento: Movimiento): Promise<string>
  obtenerPorId(id: string): Promise<Movimiento | undefined>
  obtenerPagina(opciones: PaginaMovimientos): Promise<Movimiento[]>
  obtenerPendientes(): Promise<Movimiento[]>
  obtenerTodos(): Promise<Movimiento[]>
  marcarExportados(
    ids: string[],
    loteExportacionId: string,
    exportadoEn: string,
  ): Promise<void>
  actualizar(id: string, cambios: CambiosMovimiento): Promise<void>
  eliminar(id: string): Promise<void>
}

function validarPaginacion({ pagina, tamanoPagina }: PaginaMovimientos) {
  if (!Number.isInteger(pagina) || pagina < 0) {
    throw new RangeError('La página debe ser un entero mayor o igual a cero')
  }

  if (!Number.isInteger(tamanoPagina) || tamanoPagina <= 0) {
    throw new RangeError('El tamaño de página debe ser un entero mayor a cero')
  }
}

export const movimientosRepo: MovimientosRepository = {
  guardar(movimiento) {
    return db.movimientos.add(movimiento)
  },

  obtenerPorId(id) {
    return db.movimientos.get(id)
  },

  obtenerPagina(opciones) {
    validarPaginacion(opciones)

    return db.movimientos
      .orderBy('fechaMovimiento')
      .reverse()
      .offset(opciones.pagina * opciones.tamanoPagina)
      .limit(opciones.tamanoPagina)
      .toArray()
  },

  obtenerPendientes() {
    return db.movimientos
      .where('estadoExportacion')
      .equals('pendiente')
      .toArray()
  },

  obtenerTodos() {
    return db.movimientos.orderBy('fechaMovimiento').reverse().toArray()
  },

  async marcarExportados(ids, loteExportacionId, exportadoEn) {
    await db.transaction('rw', db.movimientos, async () => {
      const movimientos = await db.movimientos.bulkGet(ids)

      if (movimientos.some((movimiento) => !movimiento)) {
        throw new MovimientosLoteDesactualizadoError()
      }

      if (
        movimientos.some(
          (movimiento) => movimiento?.estadoExportacion !== 'pendiente',
        )
      ) {
        throw new MovimientosLoteDesactualizadoError()
      }

      await db.movimientos.bulkUpdate(
        ids.map((key) => ({
          key,
          changes: {
            estadoExportacion: 'exportado',
            exportadoEn,
            loteExportacionId,
            actualizadoEn: exportadoEn,
          },
        })),
      )
    })
  },

  async actualizar(id, cambios) {
    const registrosActualizados = await db.movimientos.update(id, cambios)

    if (registrosActualizados === 0) {
      throw new Error(`No existe el movimiento con id "${id}"`)
    }
  },

  async eliminar(id) {
    await db.movimientos.delete(id)
  },
}
