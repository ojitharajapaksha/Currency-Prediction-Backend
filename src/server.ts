import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { z } from 'zod'
import dns from 'node:dns'

// Force IPv4 connectivity globally for this Node.js process to bypass network routing issues with IPv6 (ENETUNREACH)
if (typeof dns.setDefaultResultOrder === 'function') {
  dns.setDefaultResultOrder('ipv4first')
}

// Routes
import healthRoutes from './routes/health.js'
import rateRoutes from './routes/rates.js'
import forecastRoutes from './routes/forecast.js'
import analyticsRoutes from './routes/analytics.js'
import subscribeRoutes from './routes/subscribe.js'

dotenv.config()

const app: Express = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  credentials: true,
}))
app.use(express.json())

// Request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
  next()
})

// Database connection
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lkrvision'
    await mongoose.connect(mongoUri)
    console.log('✓ Connected to MongoDB')
  } catch (error) {
    console.error('✗ MongoDB connection error:', error)
    setTimeout(connectDB, 5000)
  }
}

// ─── Database Seeding ─────────────────────────────────────────────────────────
import Rate from './models/Rate.js'
import Forecast from './models/Forecast.js'
import { fetchHistoricalRates, fetchRealExchangeRate } from './lib/exchange-rate-api.js'
import { generateMlForecast } from './lib/ml-client.js'

const seedDatabase = async () => {
  try {
    // Check if we already have REAL data (from Excel or live API)
    const realDataCount = await Rate.countDocuments({ source: { $in: ['excel-real-data', 'real-time'] } })
    const simulatedCount = await Rate.countDocuments({ source: { $in: ['historical', 'simulated-fallback'] } })

    if (realDataCount > 0) {
      console.log(`✓ Database already has ${realDataCount} real rate records — skipping seed.`)
      return
    }

    if (simulatedCount > 0) {
      console.log(`⚙️  Found ${simulatedCount} simulated records — replacing with real data...`)
      await Rate.deleteMany({ source: { $in: ['historical', 'simulated-fallback'] } })
      await Forecast.deleteMany({})
    }

    console.log('⚙️  Seeding database with REAL historical rates from Excel dataset...')

    // Seed with real historical data from the ML service Excel file
    const historicalRates = await fetchHistoricalRates(365, 'USD', 'LKR')
    await Rate.insertMany(historicalRates)
    console.log(`✓ Inserted ${historicalRates.length} REAL historical rate records.`)

    // Seed current rate from live API
    const currentRateValue = await fetchRealExchangeRate('USD', 'LKR')
    const currentRate = new Rate({
      date: new Date(),
      rate: currentRateValue,
      source: 'real-time',
    })
    await currentRate.save()
    console.log(`✓ Inserted REAL current rate: ${currentRateValue} LKR`)

    // Auto-generate 7-day forecasts using ML service
    try {
      const history = historicalRates.map((r: any) => r.rate)
      history.push(currentRateValue)
      const mlResponse = await generateMlForecast(7, history)
      const forecastsToInsert = mlResponse.forecasts.map((f: any) => ({
        date: new Date(f.date),
        prediction: parseFloat(f.prediction.toFixed(2)),
        confidence: parseFloat(f.confidence.toFixed(2)),
        days_ahead: f.days_ahead,
        rmse: f.rmse,
        mae: f.mae,
        model_version: 'ml-service',
      }))
      await Forecast.insertMany(forecastsToInsert)
      console.log(`✓ Auto-generated ${forecastsToInsert.length} forecast records from real data.`)
    } catch (mlErr) {
      console.warn('⚠️  ML forecast seeding skipped (ML service may not be ready yet):', mlErr instanceof Error ? mlErr.message : mlErr)
    }

    console.log('✅ Database seeding with REAL data complete!')
  } catch (err) {
    console.error('✗ Database seeding failed:', err)
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err)
  
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      error: 'Validation error',
      details: err.errors,
    })
  }
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  })
})

// Routes
app.use('/api/health', healthRoutes)
app.use('/api/rates', rateRoutes)
app.use('/api/forecast', forecastRoutes)
app.use('/api/analytics', analyticsRoutes)
app.use('/api/subscribe', subscribeRoutes)

// Background Email Job
import cron from 'node-cron'
import { sendForecastEmails } from './emailService.js'

const startEmailCronJob = () => {
  // Schedule forecast emails to go out every single day at exactly 8:00 AM Sri Lankan Time
  cron.schedule('0 8 * * *', async () => {
    console.log(`\n📧 [EMAIL SERVICE] Triggered daily forecast email dispatch at 8:00 AM Asia/Colombo...`)
    await sendForecastEmails()
    console.log(`📧 [EMAIL SERVICE] Daily dispatch process finished.\n`)
  }, {
    timezone: 'Asia/Colombo'
  })

  console.log('📅 [EMAIL SERVICE] Cron job registered for 8:00 AM daily (Asia/Colombo)')
}

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  })
})

// Start server
const startServer = async () => {
  try {
    await connectDB()
    await seedDatabase()
    
    app.listen(PORT, () => {
      console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`  LKRVision AI Backend`)
      console.log(`  Server running on http://localhost:${PORT}`)
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`)
      
      startEmailCronJob()
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

export default app
