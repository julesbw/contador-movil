import {
  configRepo,
  type ConfigRepository,
} from '../db/configRepo'

export type ConfiguracionDispositivo = {
  dispositivoId: string
  capturadoPor: string
}

export class ConfigService {
  private readonly repository: ConfigRepository

  constructor(repository: ConfigRepository = configRepo) {
    this.repository = repository
  }

  async inicializar(): Promise<ConfiguracionDispositivo> {
    let dispositivoId = await this.repository.obtener('dispositivo_id')

    if (!dispositivoId) {
      dispositivoId = crypto.randomUUID()
      await this.repository.guardar('dispositivo_id', dispositivoId)
    }

    const capturadoPor =
      (await this.repository.obtener('capturado_por')) ?? ''

    return { dispositivoId, capturadoPor }
  }

  async guardarCapturadoPor(nombre: string): Promise<void> {
    await this.repository.guardar('capturado_por', nombre.trim())
  }
}

export const configService = new ConfigService()
