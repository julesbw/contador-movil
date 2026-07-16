import {
  type BridgeSourceResponse,
} from '../api/bridgeContracts'
import {
  bridgeClient,
  type BridgeClient,
} from '../api/bridgeClient'
import { normalizeBridgeBaseUrl } from '../api/bridgeUrl'
import {
  bridgeProfilesRepo,
  BridgeProfileNoEncontradoError,
  type BridgeProfilesRepository,
} from '../db/bridgeProfilesRepo'
import { configRepo, type ConfigRepository } from '../db/configRepo'
import type { BridgeProfile } from '../models/BridgeProfile'

const MAX_PROFILE_NAME_LENGTH = 80

export type BridgeProfileInput = {
  name: string
  baseUrl: string
  token: string
}

export type BridgeIdentityVerification =
  | {
      status: 'requires-confirmation'
      profile: BridgeProfile
      source: BridgeSourceResponse
    }
  | {
      status: 'verified'
      profile: BridgeProfile
      source: BridgeSourceResponse
    }
  | {
      status: 'mismatch'
      profile: BridgeProfile
      source: BridgeSourceResponse
    }

type Clock = () => Date
type IdGenerator = () => string

export class BridgeProfileValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BridgeProfileValidationError'
  }
}

export class BridgeProfileService {
  private readonly profiles: BridgeProfilesRepository
  private readonly config: ConfigRepository
  private readonly client: Pick<BridgeClient, 'obtenerSource'>
  private readonly now: Clock
  private readonly generateId: IdGenerator

  constructor(
    profiles: BridgeProfilesRepository = bridgeProfilesRepo,
    config: ConfigRepository = configRepo,
    client: Pick<BridgeClient, 'obtenerSource'> = bridgeClient,
    now: Clock = () => new Date(),
    generateId: IdGenerator = () => crypto.randomUUID(),
  ) {
    this.profiles = profiles
    this.config = config
    this.client = client
    this.now = now
    this.generateId = generateId
  }

  listar(): Promise<BridgeProfile[]> {
    return this.profiles.listar()
  }

  obtener(id: string): Promise<BridgeProfile | undefined> {
    return this.profiles.obtener(id)
  }

  async obtenerActivo(): Promise<BridgeProfile | undefined> {
    const activeId = await this.config.obtener('active_bridge_profile_id')

    if (!activeId) {
      return undefined
    }

    const profile = await this.profiles.obtener(activeId)

    if (!profile) {
      await this.config.eliminar('active_bridge_profile_id')
    }

    return profile
  }

  async crear(input: BridgeProfileInput): Promise<BridgeProfile> {
    const timestamp = this.now().toISOString()
    const profile: BridgeProfile = {
      id: this.generateId(),
      name: validateProfileName(input.name),
      baseUrl: normalizeBridgeBaseUrl(input.baseUrl),
      token: validateToken(input.token),
      createdAt: timestamp,
      updatedAt: timestamp,
    }

    await this.profiles.crear(profile)
    return profile
  }

  async actualizar(
    id: string,
    input: BridgeProfileInput,
  ): Promise<BridgeProfile> {
    const current = await this.requireProfile(id)
    const updatedAt = nextTimestamp(current.updatedAt, this.now())
    const updated: BridgeProfile = {
      ...current,
      name: validateProfileName(input.name),
      baseUrl: normalizeBridgeBaseUrl(input.baseUrl),
      token: validateToken(input.token),
      updatedAt,
    }

    await this.profiles.actualizar(id, {
      name: updated.name,
      baseUrl: updated.baseUrl,
      token: updated.token,
      updatedAt,
    })

    return updated
  }

  async eliminar(id: string): Promise<void> {
    await this.profiles.eliminarConDatos(id)
  }

  async seleccionarActivo(id: string | undefined): Promise<void> {
    if (id === undefined) {
      await this.config.eliminar('active_bridge_profile_id')
      return
    }

    if (!(await this.profiles.existe(id))) {
      throw new BridgeProfileNoEncontradoError(id)
    }

    await this.config.guardar('active_bridge_profile_id', id)
  }

  async verificar(
    id: string,
    signal?: AbortSignal,
  ): Promise<BridgeIdentityVerification> {
    const profile = await this.requireProfile(id)
    const source = await this.client.obtenerSource(
      profile.baseUrl,
      profile.token,
      { signal },
    )

    if (profile.sourceId === undefined) {
      return { status: 'requires-confirmation', profile, source }
    }

    if (profile.sourceId !== source.source_id) {
      return { status: 'mismatch', profile, source }
    }

    const verifiedProfile = await this.profiles.confirmarIdentidad(
      profile.id,
      profile.updatedAt,
      {
        sourceId: source.source_id,
        sourceName: source.source_name,
      },
      nextTimestamp(profile.updatedAt, this.now()),
      false,
    )

    return { status: 'verified', profile: verifiedProfile, source }
  }

  async confirmarPrimeraIdentidad(
    id: string,
    expectedUpdatedAt: string,
    source: BridgeSourceResponse,
  ): Promise<BridgeProfile> {
    const profile = await this.requireProfile(id)

    if (profile.sourceId !== undefined) {
      throw new BridgeProfileValidationError(
        'El perfil ya tiene una identidad vinculada.',
      )
    }

    return this.profiles.confirmarIdentidad(
      id,
      expectedUpdatedAt,
      {
        sourceId: source.source_id,
        sourceName: source.source_name,
      },
      nextTimestamp(profile.updatedAt, this.now()),
      false,
    )
  }

  async revincular(
    id: string,
    expectedUpdatedAt: string,
    source: BridgeSourceResponse,
  ): Promise<BridgeProfile> {
    const profile = await this.requireProfile(id)

    return this.profiles.confirmarIdentidad(
      id,
      expectedUpdatedAt,
      {
        sourceId: source.source_id,
        sourceName: source.source_name,
      },
      nextTimestamp(profile.updatedAt, this.now()),
      true,
    )
  }

  private async requireProfile(id: string): Promise<BridgeProfile> {
    const profile = await this.profiles.obtener(id)

    if (!profile) {
      throw new BridgeProfileNoEncontradoError(id)
    }

    return profile
  }
}

function validateProfileName(value: string): string {
  const name = value.trim()

  if (name.length === 0) {
    throw new BridgeProfileValidationError('Escribe un nombre local.')
  }

  if (name.length > MAX_PROFILE_NAME_LENGTH) {
    throw new BridgeProfileValidationError(
      `El nombre local no puede exceder ${MAX_PROFILE_NAME_LENGTH} caracteres.`,
    )
  }

  return name
}

function validateToken(value: string): string {
  const token = value.trim()

  if (token.length === 0) {
    throw new BridgeProfileValidationError('Escribe el token de lectura.')
  }

  return token
}

function nextTimestamp(previous: string, now: Date): string {
  const candidate = now.toISOString()

  if (candidate !== previous) {
    return candidate
  }

  return new Date(Date.parse(previous) + 1).toISOString()
}

export const bridgeProfileService = new BridgeProfileService()
