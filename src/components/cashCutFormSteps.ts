export type CashCutFormStep = 1 | 2 | 3

export function nextCashCutFormStep(
  step: CashCutFormStep,
): CashCutFormStep {
  return step === 1 ? 2 : 3
}

export function previousCashCutFormStep(
  step: CashCutFormStep,
): CashCutFormStep {
  return step === 3 ? 2 : 1
}

