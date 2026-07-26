import {
  obtenerIdentidadTienda,
  type CashCut,
  type CashCutStatus,
} from '../models/CashCut'
import { CATEGORIA_CORTE_CAJA } from '../models/Categoria'
import type { Movimiento } from '../models/Movimiento'
import {
  calcularTotalEfectivo,
  convertirPesosACentavos,
  desglosesEfectivoIguales,
  restarDesglosesEfectivo,
  sumarDesglosesEfectivo,
} from '../domain/efectivo'
import { siguienteTimestamp } from '../domain/timestamp'
import { db } from './db'

export type CambiosCashCut = Partial<
  Omit<
    CashCut,
    'id' | 'status' | 'movementId' | 'createdAt' | 'updatedAt'
  >
> &
  Pick<CashCut, 'updatedAt'>

export type CashCutSnapshot = Pick<CashCut, 'id' | 'updatedAt'>

export class CashCutNoEncontradoError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`No existe el corte con id "${id}"`)
    this.name = 'CashCutNoEncontradoError'
    this.id = id
  }
}

export class CashCutNoPendienteError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`El corte con id "${id}" ya no está pendiente`)
    this.name = 'CashCutNoPendienteError'
    this.id = id
  }
}

export class CashCutDesactualizadoError extends Error {
  readonly id: string

  constructor(id: string) {
    super(`El corte con id "${id}" cambió desde que fue consultado`)
    this.name = 'CashCutDesactualizadoError'
    this.id = id
  }
}

export class CashCutsDuplicadosError extends Error {
  constructor() {
    super('No se puede incluir el mismo corte más de una vez')
    this.name = 'CashCutsDuplicadosError'
  }
}

export class CashCutsTiendasDistintasError extends Error {
  constructor() {
    super('No se pueden consolidar cortes de tiendas distintas')
    this.name = 'CashCutsTiendasDistintasError'
  }
}

export class CashCutsMovimientoInconsistenteError extends Error {
  constructor() {
    super('El movimiento no coincide con los cortes seleccionados')
    this.name = 'CashCutsMovimientoInconsistenteError'
  }
}

export interface CashCutsRepository {
  guardar(cashCut: CashCut): Promise<string>
  obtenerPorId(id: string): Promise<CashCut | undefined>
  obtenerPorEstado(status: CashCutStatus): Promise<CashCut[]>
  obtenerTodos(): Promise<CashCut[]>
  actualizarPendiente(
    id: string,
    cambios: CambiosCashCut,
    expectedUpdatedAt: string,
  ): Promise<void>
  eliminarPendiente(
    id: string,
    expectedUpdatedAt: string,
  ): Promise<void>
  consolidar(
    movimiento: Movimiento,
    cortesEsperados: readonly CashCutSnapshot[],
  ): Promise<void>
}

function validarCortesParaConsolidacion(
  movimiento: Movimiento,
  cortes: readonly CashCut[],
  cortesEsperados: readonly CashCutSnapshot[],
): void {
  const source = movimiento.source
  const idsEsperados = cortesEsperados.map(({ id }) => id)
  const idsSource =
    source?.type === 'cash-cuts' ? source.cashCutIds : []

  if (
    movimiento.tipo !== 'entrada' ||
    movimiento.categoria !== CATEGORIA_CORTE_CAJA ||
    movimiento.formaPago !== 'efectivo' ||
    movimiento.estadoExportacion !== 'pendiente' ||
    source?.type !== 'cash-cuts' ||
    idsSource.length !== idsEsperados.length ||
    new Set(idsSource).size !== idsSource.length ||
    idsSource.some((id) => !idsEsperados.includes(id))
  ) {
    throw new CashCutsMovimientoInconsistenteError()
  }

  try {
    for (const cashCut of cortes) {
      const withdrawnBreakdown = restarDesglosesEfectivo(
        cashCut.countedBreakdown,
        cashCut.fundBreakdown,
      )

      if (
        !desglosesEfectivoIguales(
          withdrawnBreakdown,
          cashCut.withdrawnBreakdown,
        ) ||
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
          )
      ) {
        throw new CashCutsMovimientoInconsistenteError()
      }
    }

    const breakdown = sumarDesglosesEfectivo(
      cortes.map(({ withdrawnBreakdown }) => withdrawnBreakdown),
    )
    const amountInCents = cortes.reduce(
      (total, { withdrawnAmount }) =>
        total + convertirPesosACentavos(withdrawnAmount),
      0,
    )

    if (
      !Number.isSafeInteger(amountInCents) ||
      amountInCents <= 0 ||
      convertirPesosACentavos(movimiento.monto) !==
        amountInCents ||
      !desglosesEfectivoIguales(movimiento.billetes, breakdown) ||
      convertirPesosACentavos(
        calcularTotalEfectivo(movimiento.billetes),
      ) !== amountInCents
    ) {
      throw new CashCutsMovimientoInconsistenteError()
    }
  } catch (cause: unknown) {
    if (cause instanceof CashCutsMovimientoInconsistenteError) {
      throw cause
    }

    throw new CashCutsMovimientoInconsistenteError()
  }
}

async function cargarCortesVigentes(
  cortesEsperados: readonly CashCutSnapshot[],
): Promise<CashCut[]> {
  if (cortesEsperados.length === 0) {
    throw new CashCutsMovimientoInconsistenteError()
  }

  const ids = cortesEsperados.map(({ id }) => id)

  if (new Set(ids).size !== ids.length) {
    throw new CashCutsDuplicadosError()
  }

  const cortes = await db.cashCuts.bulkGet(ids)
  const primerCorteFaltante = cortes.findIndex(
    (cashCut) => cashCut === undefined,
  )

  if (primerCorteFaltante >= 0) {
    throw new CashCutNoEncontradoError(ids[primerCorteFaltante]!)
  }

  const cortesVigentes = cortes as CashCut[]

  for (let index = 0; index < cortesVigentes.length; index += 1) {
    const cashCut = cortesVigentes[index]!
    const esperado = cortesEsperados[index]!

    if (
      cashCut.status !== 'pending' ||
      cashCut.movementId !== undefined
    ) {
      throw new CashCutNoPendienteError(cashCut.id)
    }

    if (cashCut.updatedAt !== esperado.updatedAt) {
      throw new CashCutDesactualizadoError(cashCut.id)
    }
  }

  const tiendas = new Set(cortesVigentes.map(obtenerIdentidadTienda))

  if (tiendas.size > 1) {
    throw new CashCutsTiendasDistintasError()
  }

  return cortesVigentes
}

export const cashCutsRepo: CashCutsRepository = {
  async guardar(cashCut) {
    return db.transaction('rw', db.cashCuts, async () => {
      if (
        cashCut.status !== 'pending' ||
        cashCut.movementId !== undefined
      ) {
        throw new CashCutNoPendienteError(cashCut.id)
      }

      return db.cashCuts.add(cashCut)
    })
  },

  obtenerPorId(id) {
    return db.cashCuts.get(id)
  },

  obtenerPorEstado(status) {
    return db.cashCuts.where('status').equals(status).toArray()
  },

  obtenerTodos() {
    return db.cashCuts.orderBy('date').reverse().toArray()
  },

  async actualizarPendiente(id, cambios, expectedUpdatedAt) {
    await db.transaction('rw', db.cashCuts, async () => {
      const cashCut = await db.cashCuts.get(id)

      if (!cashCut) {
        throw new CashCutNoEncontradoError(id)
      }

      if (
        cashCut.status !== 'pending' ||
        cashCut.movementId !== undefined
      ) {
        throw new CashCutNoPendienteError(id)
      }

      if (cashCut.updatedAt !== expectedUpdatedAt) {
        throw new CashCutDesactualizadoError(id)
      }

      const currentMilliseconds = Date.parse(cashCut.updatedAt)
      const nextMilliseconds = Date.parse(cambios.updatedAt)

      if (
        !Number.isFinite(currentMilliseconds) ||
        !Number.isFinite(nextMilliseconds) ||
        nextMilliseconds <= currentMilliseconds
      ) {
        throw new CashCutDesactualizadoError(id)
      }

      await db.cashCuts.update(id, cambios)
    })
  },

  async eliminarPendiente(id, expectedUpdatedAt) {
    await db.transaction('rw', db.cashCuts, async () => {
      const cashCut = await db.cashCuts.get(id)

      if (!cashCut) {
        throw new CashCutNoEncontradoError(id)
      }

      if (
        cashCut.status !== 'pending' ||
        cashCut.movementId !== undefined
      ) {
        throw new CashCutNoPendienteError(id)
      }

      if (cashCut.updatedAt !== expectedUpdatedAt) {
        throw new CashCutDesactualizadoError(id)
      }

      await db.cashCuts.delete(id)
    })
  },

  async consolidar(movimiento, cortesEsperados) {
    await db.transaction(
      'rw',
      db.movimientos,
      db.cashCuts,
      async () => {
        const cortes = await cargarCortesVigentes(cortesEsperados)

        validarCortesParaConsolidacion(
          movimiento,
          cortes,
          cortesEsperados,
        )

        await db.movimientos.add(movimiento)

        const cortesIncluidos: CashCut[] = cortes.map((cashCut) => ({
          ...cashCut,
          status: 'included',
          movementId: movimiento.id,
          updatedAt: siguienteTimestamp(cashCut.updatedAt),
        }))

        await db.cashCuts.bulkPut(cortesIncluidos)
      },
    )
  },
}
