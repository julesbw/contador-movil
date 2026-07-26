import { db } from './db'
import { siguienteTimestamp } from '../domain/timestamp'
import type { Movimiento } from '../models/Movimiento'

export type PaginaMovimientos = {
  pagina: number
  tamanoPagina: number
}

export type CambiosMovimiento = Partial<
  Omit<
    Movimiento,
    | 'id'
    | 'creadoEn'
    | 'actualizadoEn'
    | 'estadoExportacion'
    | 'exportadoEn'
    | 'loteExportacionId'
    | 'source'
  >
> &
  Pick<Movimiento, 'actualizadoEn'>

export type MovimientoSnapshot = Pick<
  Movimiento,
  'id' | 'actualizadoEn'
>

export class MovimientosLoteDesactualizadoError extends Error {
  constructor() {
    super('Uno o más movimientos del lote ya no están pendientes')
    this.name = 'MovimientosLoteDesactualizadoError'
  }
}

export class MovimientoEliminacionDesactualizadaError extends Error {
  constructor(id: string) {
    super(
      `El movimiento con id "${id}" ya no existe o dejó de estar pendiente`,
    )
    this.name = 'MovimientoEliminacionDesactualizadaError'
  }
}

export class MovimientoActualizacionDesactualizadaError extends Error {
  constructor(id: string) {
    super(
      `El movimiento con id "${id}" ya no existe, cambió o dejó de estar pendiente`,
    )
    this.name = 'MovimientoActualizacionDesactualizadaError'
  }
}

export class MovimientoCashCutsInconsistenteError extends Error {
  constructor(id: string) {
    super(
      `La relación entre el movimiento con id "${id}" y sus cortes es inconsistente`,
    )
    this.name = 'MovimientoCashCutsInconsistenteError'
  }
}

export interface MovimientosRepository {
  guardar(movimiento: Movimiento): Promise<string>
  obtenerPorId(id: string): Promise<Movimiento | undefined>
  obtenerPagina(opciones: PaginaMovimientos): Promise<Movimiento[]>
  obtenerPendientes(): Promise<Movimiento[]>
  obtenerTodos(): Promise<Movimiento[]>
  marcarExportados(
    snapshots: readonly MovimientoSnapshot[],
    loteExportacionId: string,
    exportadoEn: string,
  ): Promise<void>
  actualizar(
    id: string,
    cambios: CambiosMovimiento,
    expectedActualizadoEn: string,
  ): Promise<void>
  eliminar(id: string, expectedActualizadoEn: string): Promise<void>
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

  async marcarExportados(snapshots, loteExportacionId, exportadoEn) {
    await db.transaction('rw', db.movimientos, async () => {
      const ids = snapshots.map(({ id }) => id)

      if (
        ids.length === 0 ||
        new Set(ids).size !== ids.length
      ) {
        throw new MovimientosLoteDesactualizadoError()
      }

      const movimientos = await db.movimientos.bulkGet(ids)

      if (movimientos.some((movimiento) => !movimiento)) {
        throw new MovimientosLoteDesactualizadoError()
      }

      if (
        movimientos.some(
          (movimiento, index) =>
            movimiento?.estadoExportacion !== 'pendiente' ||
            movimiento.actualizadoEn !==
              snapshots[index]?.actualizadoEn,
        )
      ) {
        throw new MovimientosLoteDesactualizadoError()
      }

      await db.movimientos.bulkUpdate(
        movimientos.map((movimiento, index) => ({
          key: ids[index]!,
          changes: {
            estadoExportacion: 'exportado',
            exportadoEn,
            loteExportacionId,
            actualizadoEn: siguienteTimestamp(
              movimiento!.actualizadoEn,
              Date.parse(exportadoEn),
            ),
          },
        })),
      )
    })
  },

  async actualizar(id, cambios, expectedActualizadoEn) {
    await db.transaction('rw', db.movimientos, async () => {
      const movimiento = await db.movimientos.get(id)
      const currentMilliseconds = movimiento
        ? Date.parse(movimiento.actualizadoEn)
        : Number.NaN
      const nextMilliseconds = Date.parse(cambios.actualizadoEn)

      if (
        !movimiento ||
        movimiento.estadoExportacion !== 'pendiente' ||
        movimiento.actualizadoEn !== expectedActualizadoEn ||
        !Number.isFinite(currentMilliseconds) ||
        !Number.isFinite(nextMilliseconds) ||
        nextMilliseconds <= currentMilliseconds
      ) {
        throw new MovimientoActualizacionDesactualizadaError(id)
      }

      await db.movimientos.update(id, cambios)
    })
  },

  async eliminar(id, expectedActualizadoEn) {
    await db.transaction(
      'rw',
      db.movimientos,
      db.cashCuts,
      async () => {
        const movimiento = await db.movimientos.get(id)

        if (
          !movimiento ||
          movimiento.estadoExportacion !== 'pendiente' ||
          movimiento.actualizadoEn !== expectedActualizadoEn
        ) {
          throw new MovimientoEliminacionDesactualizadaError(id)
        }

        const cortesRelacionados = await db.cashCuts
          .where('movementId')
          .equals(id)
          .toArray()
        const source = movimiento.source

        if (source?.type !== 'cash-cuts') {
          if (cortesRelacionados.length > 0) {
            throw new MovimientoCashCutsInconsistenteError(id)
          }

          await db.movimientos.delete(id)
          return
        }

        const sourceIds = source.cashCutIds
        const sourceIdSet = new Set(sourceIds)

        if (
          sourceIds.length === 0 ||
          sourceIdSet.size !== sourceIds.length
        ) {
          throw new MovimientoCashCutsInconsistenteError(id)
        }

        const cortesSource = await db.cashCuts.bulkGet(sourceIds)

        if (
          cortesSource.some((cashCut) => !cashCut) ||
          cortesRelacionados.length !== sourceIds.length ||
          cortesRelacionados.some(
            (cashCut) =>
              !sourceIdSet.has(cashCut.id) ||
              cashCut.status !== 'included' ||
              cashCut.movementId !== id,
          ) ||
          cortesSource.some(
            (cashCut) =>
              !cashCut ||
              cashCut.status !== 'included' ||
              cashCut.movementId !== id,
          )
        ) {
          throw new MovimientoCashCutsInconsistenteError(id)
        }

        const cortesPendientes = cortesRelacionados.map((cashCut) => {
          const cashCutPendiente = {
            ...cashCut,
            status: 'pending' as const,
            updatedAt: siguienteTimestamp(cashCut.updatedAt),
          }

          delete cashCutPendiente.movementId

          return cashCutPendiente
        })

        await db.cashCuts.bulkPut(cortesPendientes)
        await db.movimientos.delete(id)
      },
    )
  },
}
