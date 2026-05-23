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

export function getInflationRate(date: Date): number {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // JS months are 0-indexed

  if (year === 2021) {
    const inflationMap = [3.0, 3.3, 4.1, 3.9, 6.1, 5.2, 5.7, 6.0, 5.8, 7.6, 11.1, 12.1]
    return inflationMap[month - 1] || 6.0
  } else if (year === 2022) {
    const inflationMap = [14.2, 15.1, 18.7, 29.8, 39.1, 54.6, 60.8, 64.3, 69.8, 66.0, 61.0, 57.2]
    return inflationMap[month - 1] || 46.0
  } else if (year === 2023) {
    const inflationMap = [54.2, 50.6, 50.3, 35.3, 25.2, 12.0, 6.3, 4.0, 1.3, 1.5, 3.4, 4.0]
    return inflationMap[month - 1] || 20.0
  } else if (year === 2024) {
    const inflationMap = [6.4, 5.9, 0.9, 1.5, 0.9, 1.7, 2.4, 0.5, 1.1, 0.8, 1.2, 1.8]
    return inflationMap[month - 1] || 3.0
  } else if (year === 2025) {
    const inflationMap = [2.1, 2.5, 2.8, 3.0, 3.2, 3.5, 3.4, 3.3, 3.1, 3.2, 3.3, 3.4]
    return inflationMap[month - 1] || 3.2
  } else { // 2026 or later
    return 3.5
  }
}

export function buildFeatureVector(values: number[], targetDate: Date = new Date()): number[] {
  const history = values.filter((value) => Number.isFinite(value))
  if (history.length === 0) {
    return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, targetDate.getMonth() + 1, targetDate.getFullYear()]
  }

  const lag_1 = history.length >= 1 ? history[history.length - 1] : history[0]
  const lag_2 = history.length >= 2 ? history[history.length - 2] : lag_1
  const lag_3 = history.length >= 3 ? history[history.length - 3] : lag_1
  const lag_7 = history.length >= 7 ? history[history.length - 7] : lag_1
  const lag_14 = history.length >= 14 ? history[history.length - 14] : lag_1
  const lag_30 = history.length >= 30 ? history[history.length - 30] : lag_1

  const recent7 = history.slice(-7)
  const ma_7 = mean(recent7)

  const recent30 = history.slice(-30)
  const ma_30 = mean(recent30)

  const recent7_vol = history.slice(-7)
  const volatility = recent7_vol.length > 0 ? Math.max(...recent7_vol) - Math.min(...recent7_vol) : 0

  const recent14_vol = history.slice(-14)
  const volatility_14 = standardDeviation(recent14_vol)

  const recent30_vol = history.slice(-30)
  const volatility_30 = standardDeviation(recent30_vol)

  const inflation = getInflationRate(targetDate)

  // Map JS getDay() [0=Sun, 1=Mon...] to Python weekday() [0=Mon, 1=Tue... 6=Sun]
  const jsDay = targetDate.getDay()
  const pyDay = jsDay === 0 ? 6 : jsDay - 1

  return [
    lag_1,
    lag_2,
    lag_3,
    lag_7,
    lag_14,
    lag_30,
    ma_7,
    ma_30,
    volatility,
    volatility_14,
    volatility_30,
    inflation,
    pyDay,
    targetDate.getMonth() + 1,
    targetDate.getFullYear()
  ]
}

export function toTrend(current: number, previous: number): 'up' | 'down' {
  return current >= previous ? 'up' : 'down'
}
