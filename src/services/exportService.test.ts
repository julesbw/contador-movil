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
})
