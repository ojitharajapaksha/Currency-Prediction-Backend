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
    const todayRate = {
      date: new Date(),
      rate: currentRate,
      source: 'frankfurter-api',
    }

    // Insert all rates
    const allRates = [...historicalRates, todayRate]
    await Rate.insertMany(allRates)
    console.log(`✓ Seeded ${allRates.length} real exchange rates from Frankfurter API`)

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
