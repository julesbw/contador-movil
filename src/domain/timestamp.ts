export function siguienteTimestamp(
  previous: string,
  now = Date.now(),
): string {
  const previousMilliseconds = Date.parse(previous)
  const nextMilliseconds = Number.isFinite(previousMilliseconds)
    ? Math.max(now, previousMilliseconds + 1)
    : now

  return new Date(nextMilliseconds).toISOString()
}
