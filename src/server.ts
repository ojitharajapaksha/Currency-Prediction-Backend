import express, { Express, Request, Response, NextFunction } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { z } from 'zod'

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
import { sendForecastEmails } from './emailService.js'

const startEmailCronJob = () => {
  // In a real production app, use node-cron: cron.schedule('0 8 * * *', ...)
  // Here we simulate the cron job with setInterval (runs every 24h)
  const ONE_DAY_MS = 24 * 60 * 60 * 1000
  setInterval(async () => {
    console.log(`\n📧 [EMAIL SERVICE] Triggered daily forecast email dispatch...`)
    await sendForecastEmails()
    console.log(`📧 [EMAIL SERVICE] Daily dispatch process finished.\n`)
  }, ONE_DAY_MS)
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
