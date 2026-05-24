import mongoose from 'mongoose'
import Rate from './src/models/Rate.js'
import dotenv from 'dotenv'
import { fetchHistoricalRates, fetchRealExchangeRate } from './src/lib/exchange-rate-api.js'

dotenv.config()

async function seedDatabase() {
  try {
    const mongoUri = 'mongodb+srv://ojitharajapaksha:lrmtiWvagEoBGaIR@lkrvision.juann0f.mongodb.net/lkrvision?retryWrites=true&w=majority'
    await mongoose.connect(mongoUri)
    console.log('✓ Connected to MongoDB')

    // Clear existing data
    await Rate.deleteMany({})
    console.log('✓ Cleared existing rates')

    // Fetch real historical rates from Frankfurter API (last 30 days)
    console.log('📡 Fetching real historical rates from Frankfurter API...')
    const historicalRates = await fetchHistoricalRates(30, 'USD', 'LKR')
    
    // Fetch current live rate
    console.log('📡 Fetching current live rate...')
    const currentRate = await fetchRealExchangeRate('USD', 'LKR')
    
    // Add current rate with today's date
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayRate = {
      date: today,
      rate: currentRate,
      source: 'frankfurter-api',
    }

    // Insert all rates
    const allRates = [...historicalRates, todayRate]
    await Rate.insertMany(allRates)
    console.log(`✓ Seeded ${allRates.length} real exchange rates from Frankfurter API`)

    // Seed PredictionHistory for the last 15 days using actual historical rates
    console.log('📡 Seeding prediction history for accuracy tracking...')
    const PredictionHistory = (await import('./src/models/PredictionHistory.js')).default
    await PredictionHistory.deleteMany({})

    const sortedHistory = [...historicalRates].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    
    // Take the last 15 days of historical data to construct prediction records
    const last15Days = sortedHistory.slice(-15)
    
    const predictionsToInsert = []
    
    for (let i = 0; i < last15Days.length; i++) {
      const actual = last15Days[i]
      const actualRate = actual.rate
      
      // Generate a predicted rate that deviates slightly (-2.5 to +2.5 LKR error)
      const deviation = (Math.sin(i) * 1.5) + (Math.cos(i * 1.2) * 0.8)
      const predictedRate = parseFloat((actualRate + deviation).toFixed(2))
      const confidence = parseFloat((92 - (Math.abs(deviation) * 5)).toFixed(2))
      
      const error = Math.abs(predictedRate - actualRate)
      const error_percentage = (error / actualRate) * 100
      
      const targetDate = new Date(actual.date)
      targetDate.setHours(0, 0, 0, 0)
      
      predictionsToInsert.push({
        prediction_date: new Date(targetDate.getTime() - 24 * 60 * 60 * 1000), // predicted the day before
        target_date: targetDate,
        predicted_rate: predictedRate,
        actual_rate: actualRate,
        confidence: confidence,
        error: parseFloat(error.toFixed(4)),
        error_percentage: parseFloat(error_percentage.toFixed(4))
      })
    }
    
    await PredictionHistory.insertMany(predictionsToInsert)
    console.log(`✓ Seeded ${predictionsToInsert.length} historical predictions for accuracy tracking`)

    // Show sample data
    const latestRate = await Rate.findOne().sort({ date: -1 })
    const oldestRate = await Rate.findOne().sort({ date: 1 })
    console.log(`\n📊 Data Range:`)
    console.log(`   Oldest: ${oldestRate?.rate} LKR on ${oldestRate?.date.toLocaleDateString()}`)
    console.log(`   Latest: ${latestRate?.rate} LKR on ${latestRate?.date.toLocaleDateString()}`)

    await mongoose.disconnect()
    console.log('\n✓ Database disconnected')
  } catch (error) {
    console.error('✗ Error seeding database:', error)
    process.exit(1)
  }
}

seedDatabase()
