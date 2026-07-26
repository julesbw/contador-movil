import {
  CashCutDesactualizadoError,
  CashCutNoEncontradoError,
  CashCutNoPendienteError,
  CashCutsDuplicadosError,
  CashCutsMovimientoInconsistenteError,
  CashCutsTiendasDistintasError,
  cashCutsRepo,
  type CambiosCashCut,
  type CashCutsRepository,
} from '../db/cashCutsRepo'
import { siguienteTimestamp } from '../domain/timestamp'
import type { CashCut, CashCutStatus } from '../models/CashCut'
import type { Movimiento } from '../models/Movimiento'
import {
  actualizarCorteCaja,
  CashCutAlreadyIncludedError,
  CashCutsDifferentStoresError,
  CashCutValidationError,
  crearCorteCaja,
  crearMovimientoDesdeCortes,
  type CreateCashCutInput,
  type CreateMovementFromCashCutsInput,
} from './cashCutDomain'

export class CashCutConflictError extends Error {
  constructor() {
    super(
      'Los cortes cambiaron desde que se consultaron. Revisa la lista actualizada.',
    )
    this.name = 'CashCutConflictError'
  }
}

function mapearErrorPersistencia(error: unknown): never {
  if (error instanceof CashCutNoPendienteError) {
    throw new CashCutAlreadyIncludedError(error.id)
  }

  if (error instanceof CashCutsTiendasDistintasError) {
    throw new CashCutsDifferentStoresError()
  }

  if (error instanceof CashCutsDuplicadosError) {
    throw new CashCutValidationError([
      'No se puede incluir el mismo corte más de una vez',
    ])
  }

  if (
    error instanceof CashCutDesactualizadoError ||
    error instanceof CashCutNoEncontradoError ||
    error instanceof CashCutsMovimientoInconsistenteError
  ) {
    throw new CashCutConflictError()
  }

  throw error
}

export class CashCutService {
  private readonly repository: CashCutsRepository

  constructor(
    repository: CashCutsRepository = cashCutsRepo,
  ) {
    this.repository = repository
  }

  obtenerTodos(): Promise<CashCut[]> {
    return this.repository.obtenerTodos()
  }

  obtenerPorEstado(status: CashCutStatus): Promise<CashCut[]> {
    return this.repository.obtenerPorEstado(status)
  }

  obtenerPorId(id: string): Promise<CashCut | undefined> {
    return this.repository.obtenerPorId(id)
  }

  async crear(input: CreateCashCutInput): Promise<CashCut> {
    const now = new Date().toISOString()
    const cashCut = crearCorteCaja(input, {
      id: crypto.randomUUID(),
      now,
    })

    await this.repository.guardar(cashCut)

    return cashCut
  }

  async actualizar(
    id: string,
    input: CreateCashCutInput,
    expectedUpdatedAt: string,
  ): Promise<CashCut> {
    const current = await this.obtenerExistente(id)

    if (current.updatedAt !== expectedUpdatedAt) {
      throw new CashCutConflictError()
    }

    const updated = actualizarCorteCaja(
      current,
      input,
      siguienteTimestamp(current.updatedAt),
    )
    const cambios: CambiosCashCut = {
      date: updated.date,
      concept: updated.concept,
      storeId: updated.storeId,
      storeName: updated.storeName,
      notes: updated.notes,
      countedBreakdown: updated.countedBreakdown,
      countedAmount: updated.countedAmount,
      fundBreakdown: updated.fundBreakdown,
      fundAmount: updated.fundAmount,
      withdrawnBreakdown: updated.withdrawnBreakdown,
      withdrawnAmount: updated.withdrawnAmount,
      updatedAt: updated.updatedAt,
    }

    try {
      await this.repository.actualizarPendiente(
        id,
        cambios,
        expectedUpdatedAt,
      )
    } catch (error: unknown) {
      mapearErrorPersistencia(error)
    }

    return updated
  }

  async eliminar(id: string, expectedUpdatedAt: string): Promise<void> {
    const current = await this.obtenerExistente(id)

    if (current.updatedAt !== expectedUpdatedAt) {
      throw new CashCutConflictError()
    }

    try {
      await this.repository.eliminarPendiente(id, expectedUpdatedAt)
    } catch (error: unknown) {
      mapearErrorPersistencia(error)
    }
  }

  async crearMovimiento(
    cashCutIds: readonly string[],
    input: CreateMovementFromCashCutsInput,
  ): Promise<Movimiento> {
    if (
      cashCutIds.length === 0 ||
      new Set(cashCutIds).size !== cashCutIds.length
    ) {
      throw new CashCutValidationError([
        cashCutIds.length === 0
          ? 'Selecciona al menos un corte de caja'
          : 'No se puede incluir el mismo corte más de una vez',
      ])
    }

    const cashCuts = await Promise.all(
      cashCutIds.map(async (id) => {
        const cashCut = await this.repository.obtenerPorId(id)

        if (!cashCut) {
          throw new CashCutNoEncontradoError(id)
        }

        return cashCut
      }),
    )
    const now = new Date().toISOString()
    const movimiento = crearMovimientoDesdeCortes(
      cashCuts,
      input,
      {
        id: crypto.randomUUID(),
        now,
      },
    )

    try {
      await this.repository.consolidar(
        movimiento,
        cashCuts.map(({ id, updatedAt }) => ({
          id,
          updatedAt,
        })),
      )
    } catch (error: unknown) {
      mapearErrorPersistencia(error)
    }

    return movimiento
  }

  private async obtenerExistente(id: string): Promise<CashCut> {
    const cashCut = await this.repository.obtenerPorId(id)

    if (!cashCut) {
      throw new CashCutNoEncontradoError(id)
    }

    return cashCut
  }
}

export const cashCutService = new CashCutService()
