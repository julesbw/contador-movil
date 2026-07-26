import { convertirPesosACentavos } from '../services/efectivo'

export function parseCashCounterInput(
  raw: string,
  allowsDecimal: boolean,
  maximum?: number,
  unitValue = 1,
): number | undefined {
  const validPattern = allowsDecimal
    ? /^\d*(?:[.,]\d{0,2})?$/
    : /^\d*$/

  if (!validPattern.test(raw)) {
    return undefined
  }

  if (raw === '') {
    return 0
  }

  const nextValue = Number(raw.replace(',', '.'))

  if (
    !Number.isFinite(nextValue) ||
    (!allowsDecimal && !Number.isSafeInteger(nextValue)) ||
    (!allowsDecimal &&
      !Number.isSafeInteger(nextValue * unitValue * 100)) ||
    (maximum !== undefined && nextValue > maximum)
  ) {
    return undefined
  }

  if (allowsDecimal) {
    try {
      convertirPesosACentavos(nextValue)
    } catch {
      return undefined
    }
  }

  return nextValue
}
