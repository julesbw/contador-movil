import { describe, expect, it } from 'vitest'
import type { ConfigRepository } from '../db/configRepo'
import type { MovimientosRepository } from '../db/movimientosRepo'
import type { ConfigKey } from '../models/ConfigItem'
import type { Movimiento } from '../models/Movimiento'
import { ConfigService } from './configService'
import { ExportService } from './exportService'

function crearMovimiento(): Movimiento {
  return {
    id: crypto.randomUUID(),
    tipo: 'salida',
    fechaMovimiento: '2026-07-08',
    monto: 100,
    concepto: 'Comida',
    categoria: 'Comida',
    formaPago: 'tarjeta',
    billetes: {
      b1000: 0,
      b500: 0,
      b200: 0,
      b100: 0,
      b50: 0,
      b20: 0,
      monedas: 0,
    },
    estadoExportacion: 'pendiente',
    creadoEn: '2026-07-08T10:00:00.000Z',
    actualizadoEn: '2026-07-08T10:00:00.000Z',
  }
}

function crearConfigService(): ConfigService {
  const valores = new Map<ConfigKey, string>([
    ['dispositivo_id', 'dispositivo-1'],
    ['capturado_por', 'Julio'],
  ])
  const repository: ConfigRepository = {
    obtener(key) {
      return Promise.resolve(valores.get(key))
    },
    guardar(key, value) {
      valores.set(key, value)
      return Promise.resolve()
    },
    eliminar(key) {
      valores.delete(key)
      return Promise.resolve()
    },
    obtenerTodo() {
      return Promise.resolve(
        [...valores].map(([key, value]) => ({ key, value })),
      )
    },
  }

  return new ConfigService(repository)
}

function crearRepository(
  movimiento: Movimiento,
): MovimientosRepository {
  return {
    guardar() {
      return Promise.resolve(movimiento.id)
    },
    obtenerPorId() {
      return Promise.resolve(movimiento)
    },
    obtenerPagina() {
      return Promise.resolve([movimiento])
    },
    obtenerPendientes() {
      return Promise.resolve([movimiento])
    },
    obtenerTodos() {
      return Promise.resolve([movimiento])
    },
    marcarExportados() {
      return Promise.resolve()
    },
    actualizar() {
      return Promise.resolve()
    },
    eliminar() {
      return Promise.resolve()
    },
  }
}

function crearRepositoryConRegistros(registros: Movimiento[]): {
  repository: MovimientosRepository
  idsMarcados: string[][]
} {
  const idsMarcados: string[][] = []
  const repository: MovimientosRepository = {
    guardar(movimiento) {
      registros.push(movimiento)
      return Promise.resolve(movimiento.id)
    },
    obtenerPorId(id) {
      return Promise.resolve(registros.find((movimiento) => movimiento.id === id))
    },
    obtenerPagina() {
      return Promise.resolve(registros)
    },
    obtenerPendientes() {
      return Promise.resolve(
        registros.filter(
          ({ estadoExportacion }) => estadoExportacion === 'pendiente',
        ),
      )
    },
    obtenerTodos() {
      return Promise.resolve(registros)
    },
    marcarExportados(ids) {
      idsMarcados.push([...ids])
      return Promise.resolve()
    },
    actualizar() {
      return Promise.resolve()
    },
    eliminar() {
      return Promise.resolve()
    },
  }

  return { repository, idsMarcados }
}

describe('ExportService', () => {
  it('genera el contrato JSON con configuración y nombres snake_case', async () => {
    const movimiento = crearMovimiento()
    const service = new ExportService(
      crearRepository(movimiento),
      crearConfigService(),
    )

    const lote = await service.prepararPendientes()

    expect(lote.archivo).toMatchObject({
      version: '1.0',
      origen: 'contador_mobile_pwa',
      tipo_exportacion: 'movimientos',
      dispositivo_id: 'dispositivo-1',
      capturado_por: 'Julio',
      total_movimientos: 1,
    })
    expect(lote.archivo.movimientos[0]).toMatchObject({
      id: movimiento.id,
      fecha_movimiento: '2026-07-08',
      forma_pago: 'tarjeta',
      creado_en: movimiento.creadoEn,
    })
  })

  it('genera el JSON únicamente con los IDs seleccionados y en orden', async () => {
    const antiguo = {
      ...crearMovimiento(),
      id: 'antiguo',
      fechaMovimiento: '2026-07-08',
    }
    const reciente = {
      ...crearMovimiento(),
      id: 'reciente',
      fechaMovimiento: '2026-07-10',
    }
    const omitido = {
      ...crearMovimiento(),
      id: 'omitido',
      fechaMovimiento: '2026-07-09',
    }
    const { repository } = crearRepositoryConRegistros([
      antiguo,
      reciente,
      omitido,
    ])
    const service = new ExportService(repository, crearConfigService())

    const lote = await service.prepararPendientesSeleccionados([
      antiguo.id,
      reciente.id,
    ])

    expect(lote.movimientoIds).toEqual([reciente.id, antiguo.id])
    expect(lote.archivo.total_movimientos).toBe(2)
    expect(lote.archivo.movimientos.map(({ id }) => id)).toEqual([
      reciente.id,
      antiguo.id,
    ])
  })

  it('rechaza una selección vacía o con IDs que ya no están pendientes', async () => {
    const pendiente = crearMovimiento()
    const { repository } = crearRepositoryConRegistros([pendiente])
    const service = new ExportService(repository, crearConfigService())

    await expect(
      service.prepararPendientesSeleccionados([]),
    ).rejects.toThrow('Selecciona al menos un movimiento')
    await expect(
      service.prepararPendientesSeleccionados([pendiente.id, 'inexistente']),
    ).rejects.toThrow('ya no están pendientes')
  })

  it('confirma únicamente los IDs contenidos en el lote', async () => {
    const primero = { ...crearMovimiento(), id: 'primero' }
    const segundo = { ...crearMovimiento(), id: 'segundo' }
    const { repository, idsMarcados } = crearRepositoryConRegistros([
      primero,
      segundo,
    ])
    const service = new ExportService(repository, crearConfigService())
    const lote = await service.prepararPendientesSeleccionados([primero.id])

    await service.confirmarPendientes(lote)

    expect(idsMarcados).toEqual([[primero.id]])
  })

  it('el respaldo incluye pendientes y exportados sin marcar estados', async () => {
    const pendiente = crearMovimiento()
    const exportado = {
      ...crearMovimiento(),
      id: crypto.randomUUID(),
      estadoExportacion: 'exportado' as const,
    }
    const { repository, idsMarcados } = crearRepositoryConRegistros([
      pendiente,
      exportado,
    ])
    const service = new ExportService(repository, crearConfigService())

    const respaldo = await service.prepararRespaldo()

    expect(respaldo.archivo.total_movimientos).toBe(2)
    expect(respaldo.movimientoIds).toEqual([])
    expect(idsMarcados).toEqual([])
  })
})
