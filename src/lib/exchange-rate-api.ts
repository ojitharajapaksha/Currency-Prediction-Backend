import axios from 'axios'

/**
 * Fetch REAL current USD/LKR exchange rate from open.er-api.com
 * Completely free, no API key required.
 * Docs: https://www.exchangerate-api.com/docs/free
 */
export async function fetchRealExchangeRate(fromCurrency = 'USD', toCurrency = 'LKR'): Promise<number> {
  try {
    const response = await axios.get(`https://open.er-api.com/v6/latest/${fromCurrency}`, {
      timeout: 8000,
    })

    const rate = response.data?.rates?.[toCurrency]
    if (!rate || typeof rate !== 'number') {
      throw new Error(`${toCurrency} rate not found in API response`)
    }

    console.log(`✓ Real-time rate fetched: 1 ${fromCurrency} = ${rate.toFixed(2)} ${toCurrency}`)
    return parseFloat(rate.toFixed(2))
  } catch (error) {
    // Fallback: use a realistic simulated rate so the app doesn't crash
    console.warn(`⚠️  Could not fetch real exchange rate (${error instanceof Error ? error.message : error}). Using fallback.`)
    const baseRate = 332.5
    const variation = (Math.random() - 0.5) * 2
    return parseFloat((baseRate + variation).toFixed(2))
  }
}

/**
 * Fetch REAL historical USD/LKR rates from the ML service, which reads
 * directly from the actual USD_LKR_DataSet.xlsx Excel file.
 * Falls back to simulated data if the ML service is unreachable.
 */
export async function fetchHistoricalRates(days = 90, fromCurrency = 'USD', toCurrency = 'LKR') {
  try {
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001'

    console.log(`⚙️  Fetching real historical rates from ML service Excel dataset...`)

    const response = await axios.get(`${ML_SERVICE_URL}/api/historical-data`, {
      params: { range: 'ALL' },
      timeout: 30000,
    })

    const allData: Array<{ date: string; open: number; high: number; low: number; close: number }> = response.data

    if (!Array.isArray(allData) || allData.length === 0) {
      throw new Error('Empty historical data returned from ML service')
    }

    // Take the most recent `days` records
    const recent = allData.slice(-days)

    const rates = recent.map((r) => ({
      date: new Date(r.date),
      rate: parseFloat(r.close.toFixed(2)),
      source: 'excel-real-data',
    }))

    console.log(`✓ Loaded ${rates.length} REAL historical rates from Excel dataset (${rates[0]?.date.toISOString().slice(0, 10)} → ${rates[rates.length - 1]?.date.toISOString().slice(0, 10)})`)
    return rates
  } catch (error) {
    console.warn(`⚠️  Could not fetch real historical rates from ML service: ${error instanceof Error ? error.message : error}`)
    console.warn(`⚠️  Falling back to simulated historical data.`)

    // Fallback: generate realistic simulated data
    const rates = []
    let baseRate = 330.0

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const dailyChange = (Math.random() - 0.5) * 2
      baseRate += dailyChange
      baseRate = Math.max(325, Math.min(340, baseRate))

      rates.push({
        date,
        rate: parseFloat(baseRate.toFixed(2)),
        source: 'simulated-fallback',
      })
    }

    console.log(`✓ Generated ${rates.length} simulated fallback rates`)
    return rates
  }
}
