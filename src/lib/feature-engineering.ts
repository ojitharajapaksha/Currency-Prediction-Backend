export function mean(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function standardDeviation(values: number[]): number {
  if (values.length <= 1) {
    return 0
  }

  const average = mean(values)
  const variance = mean(values.map((value) => (value - average) ** 2))
  return Math.sqrt(variance)
}

export function calculateEma(values: number[], period: number): number {
  if (values.length === 0) {
    return 0
  }

  const smoothing = 2 / (period + 1)
  let ema = values[0]

  for (let index = 1; index < values.length; index += 1) {
    ema = values[index] * smoothing + ema * (1 - smoothing)
  }

  return ema
}

export function calculateRsi(values: number[], period = 14): number {
  if (values.length <= 1) {
    return 50
  }

  const recent = values.slice(-Math.max(period + 1, 2))
  let gains = 0
  let losses = 0

  for (let index = 1; index < recent.length; index += 1) {
    const difference = recent[index] - recent[index - 1]
    if (difference >= 0) {
      gains += difference
    } else {
      losses += Math.abs(difference)
    }
  }

  if (gains === 0 && losses === 0) {
    return 50
  }

  const averageGain = gains / period
  const averageLoss = losses / period || 1
  const relativeStrength = averageGain / averageLoss

  return 100 - 100 / (1 + relativeStrength)
}

export function calculateMacd(values: number[]): number {
  if (values.length === 0) {
    return 0
  }

  const ema12 = calculateEma(values.slice(-26), 12)
  const ema26 = calculateEma(values.slice(-26), 26)
  return ema12 - ema26
}

export function buildFeatureVector(values: number[], targetDate: Date = new Date()): number[] {
  const history = values.filter((value) => Number.isFinite(value))
  if (history.length === 0) {
    return [0, 0, 0, 0, 0, 0, targetDate.getDay(), targetDate.getMonth() + 1, targetDate.getFullYear()]
  }

  const lag_1 = history.length >= 1 ? history[history.length - 1] : history[0]
  const lag_2 = history.length >= 2 ? history[history.length - 2] : lag_1
  const lag_7 = history.length >= 7 ? history[history.length - 7] : lag_1

  const recent7 = history.slice(-7)
  const ma_7 = mean(recent7)

  const recent30 = history.slice(-30)
  const ma_30 = mean(recent30)

  const returns = history.slice(1).map((value, index) => {
    const previous = history[index] || 1
    return (value - previous) / previous
  })

  const volatility = standardDeviation(returns.slice(-14)) * 100

  return [
    lag_1,
    lag_2,
    lag_7,
    ma_7,
    ma_30,
    volatility,
    targetDate.getDay(),
    targetDate.getMonth() + 1,
    targetDate.getFullYear()
  ]
}

export function toTrend(current: number, previous: number): 'up' | 'down' {
  return current >= previous ? 'up' : 'down'
}
