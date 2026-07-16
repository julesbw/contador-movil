import { describe, expect, it } from 'vitest'
import { BridgeClientError } from '../api/bridgeErrors'
import { BridgeUrlValidationError } from '../api/bridgeUrl'
import {
  getBridgeErrorCode,
  getBridgeErrorMessage,
} from './bridgeErrorMessages'
import { BridgeProfileValidationError } from './bridgeProfileService'

describe('bridgeErrorMessages', () => {
  it('mapea códigos conocidos sin mostrar mensajes remotos', () => {
    const error = new BridgeClientError('REVOKED_TOKEN', 401)

    expect(getBridgeErrorCode(error)).toBe('REVOKED_TOKEN')
    expect(getBridgeErrorMessage(error)).toBe(
      'El token de lectura fue revocado.',
    )
  })

  it('muestra validaciones locales seguras de perfil y URL', () => {
    expect(
      getBridgeErrorMessage(
        new BridgeProfileValidationError('Escribe un nombre local.'),
      ),
    ).toBe('Escribe un nombre local.')
    expect(
      getBridgeErrorMessage(new BridgeUrlValidationError('HTTPS_REQUIRED')),
    ).toBe('La URL privada debe usar HTTPS.')
  })

  it('no filtra el mensaje de un error desconocido', () => {
    expect(
      getBridgeErrorMessage(new Error('token o URL sensible')),
    ).toBe('No fue posible completar la operación. Intenta nuevamente.')
  })
})
