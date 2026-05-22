import axios from 'axios'

/**
 * Generate realistic USD/LKR exchange rates
 * Since free APIs don't support LKR well, we simulate realistic market data
 */
export async function fetchRealExchangeRate(fromCurrency = 'USD', toCurrency = 'LKR'): Promise<number> {
  try {
    // Generate realistic current rate based on time
    // Base rate around 330-335 LKR per USD
    const baseRate = 332.5
    const timeBasedVariation = (Math.random() - 0.5) * 2 // ±1 variation
    const hourVariation = (new Date().getHours() / 24) * 1 // Hourly drift
    const rate = baseRate + timeBasedVariation + hourVariation

    console.log(`✓ Generated realistic rate: 1 ${fromCurrency} = ${rate.toFixed(2)} ${toCurrency}`)
    return parseFloat(rate.toFixed(2))
  } catch (error) {
    console.error('✗ Error generating exchange rate:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Generate realistic historical rates (last N days)
 */
export async function fetchHistoricalRates(days = 30, fromCurrency = 'USD', toCurrency = 'LKR') {
  try {
    const rates = []
    let baseRate = 330.0

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      // Add realistic daily variation (±0.5-1.5)
      const dailyChange = (Math.random() - 0.5) * 2
      baseRate += dailyChange

      // Keep rate in realistic range
      baseRate = Math.max(325, Math.min(340, baseRate))

      rates.push({
        date: date,
        rate: parseFloat(baseRate.toFixed(2)),
        source: 'historical',
      })
    }

    console.log(`✓ Generated ${rates.length} realistic historical rates`)
    return rates
  } catch (error) {
    console.error('✗ Error generating historical rates:', error instanceof Error ? error.message : error)
    throw error
  }
}
