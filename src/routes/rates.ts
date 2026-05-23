import express, { Router, Request, Response } from 'express'
import { z } from 'zod'
import Rate from '../models/Rate.js'
import PredictionHistory from '../models/PredictionHistory.js'
import { buildFeatureVector, toTrend } from '../lib/feature-engineering.js'
import { predictWithMl } from '../lib/ml-client.js'
import { fetchRealExchangeRate, fetchHistoricalRates } from '../lib/exchange-rate-api.js'
import axios from 'axios'

const router: Router = express.Router()

/**
 * GET /api/rates/current
 * Get current USD/LKR exchange rate
 */
router.get('/current', async (req: Request, res: Response) => {
  try {
    const rate = await Rate.findOne({ source: { $in: ['real-time', 'frankfurter-api'] } })
      .sort({ date: -1 })
      .exec()

    const fallbackRate = rate || (await Rate.findOne().sort({ date: -1 }).exec())

    if (!fallbackRate) {
      return res.status(404).json({
        error: 'No current rate available',
      })
    }

    res.json({
      date: fallbackRate.date,
      rate: fallbackRate.rate,
      source: fallbackRate.source,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch current rate' })
  }
})

/**
 * GET /api/rates/historical
 * Get historical exchange rates
 */
router.get('/historical', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query

    const daysInt = parseInt(days as string, 10) || 30
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - daysInt)

    const rates = await Rate.find({
      date: { $gte: startDate },
      source: { $in: ['historical', 'excel-real-data', 'simulated-fallback', 'real-time', 'frankfurter-api'] },
    })
      .sort({ date: 1 })
      .exec()

    res.json({
      days: daysInt,
      count: rates.length,
      data: rates.map((r) => ({
        date: r.date,
        rate: r.rate,
      })),
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch historical rates' })
  }
})

/**
 * POST /api/rates/predict-tomorrow
 * Get tomorrow's prediction
 */
router.post('/predict-tomorrow', async (req: Request, res: Response) => {
  try {
    const recentRates = await Rate.find()
      .sort({ date: 1 })
      .limit(60)
      .exec()

    const currentRate = recentRates[recentRates.length - 1]

    if (!currentRate) {
      return res.status(404).json({ error: 'No current rate available' })
    }

    const featureVector = buildFeatureVector(recentRates.map((rate) => rate.rate))

    let prediction = currentRate.rate
    let confidence = 80
    let modelSource = 'fallback'
    let isAnomaly = false
    let warning: string | undefined = undefined

    try {
      const mlResponse = await predictWithMl(featureVector)
      prediction = mlResponse.prediction
      confidence = mlResponse.confidence
      isAnomaly = !!mlResponse.is_anomaly
      warning = mlResponse.warning
      modelSource = 'ml-service'
    } catch (mlError) {
      console.warn('ML Service prediction failed, executing fallback rolling logic:', mlError)
      const recentWindow = recentRates.slice(-7).map((rate) => rate.rate)
      const averageChange = recentWindow.length > 1
        ? recentWindow.slice(1).reduce((sum, value, index) => sum + (value - recentWindow[index]), 0) /
          (recentWindow.length - 1)
        : 0
      prediction = currentRate.rate + averageChange
      confidence = 72
    }

    const tomorrowDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000)
    tomorrowDate.setHours(0, 0, 0, 0)

    // Save prediction history record
    await PredictionHistory.findOneAndUpdate(
      { target_date: tomorrowDate },
      {
        prediction_date: new Date(),
        predicted_rate: parseFloat(prediction.toFixed(2)),
        confidence: parseFloat(Math.min(95, confidence).toFixed(2)),
        is_anomaly: isAnomaly,
        warning: warning,
      },
      { upsert: true, new: true }
    )

    res.json({
      current_rate: currentRate.rate,
      prediction: parseFloat(prediction.toFixed(2)),
      confidence: parseFloat(Math.min(95, confidence).toFixed(2)),
      date: tomorrowDate,
      model_source: modelSource,
      features_used: featureVector.length,
      is_anomaly: isAnomaly,
      warning: warning,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate prediction' })
  }
})

/**
 * GET /api/rates/fetch-live
 * Fetch and save real-time exchange rate from Frankfurter API
 */
router.get('/fetch-live', async (req: Request, res: Response) => {
  try {
    const realRate = await fetchRealExchangeRate('USD', 'LKR')

    // Save to database
    const newRate = new Rate({
      date: new Date(),
      rate: realRate,
      source: 'frankfurter-api',
    })

    await newRate.save()

    // Update prediction history for today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const matchedPrediction = await PredictionHistory.findOne({ target_date: today })
    if (matchedPrediction) {
      const error = Math.abs(matchedPrediction.predicted_rate - realRate)
      const error_percentage = (error / realRate) * 100
      
      matchedPrediction.actual_rate = realRate
      matchedPrediction.error = parseFloat(error.toFixed(4))
      matchedPrediction.error_percentage = parseFloat(error_percentage.toFixed(4))
      await matchedPrediction.save()
      console.log(`✓ Prediction history updated for date ${today.toLocaleDateString()}`)
    }

    res.json({
      rate: realRate,
      date: new Date(),
      source: 'frankfurter-api',
      message: 'Real-time rate fetched and saved to database',
    })
  } catch (error) {
    console.error('Error fetching live rate:', error)
    res.status(500).json({
      error: 'Failed to fetch real-time exchange rate',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * PUT /api/rates/refresh-historical
 * Fetch and refresh historical rates from Frankfurter API
 */
router.put('/refresh-historical', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.body

    const historicalRates = await fetchHistoricalRates(days, 'USD', 'LKR')

    // Remove existing historical rates for this period
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    await Rate.deleteMany({
      date: { $gte: startDate },
      source: { $in: ['historical', 'simulated-realistic-data', 'frankfurter-api', 'excel-real-data', 'simulated-fallback'] },
    })

    // Insert new rates
    await Rate.insertMany(historicalRates)

    // Update prediction history actuals
    for (const r of historicalRates) {
      const date = new Date(r.date)
      date.setHours(0, 0, 0, 0)
      
      const matchedPrediction = await PredictionHistory.findOne({ target_date: date })
      if (matchedPrediction) {
        const error = Math.abs(matchedPrediction.predicted_rate - r.rate)
        const error_percentage = (error / r.rate) * 100
        
        matchedPrediction.actual_rate = r.rate
        matchedPrediction.error = parseFloat(error.toFixed(4))
        matchedPrediction.error_percentage = parseFloat(error_percentage.toFixed(4))
        await matchedPrediction.save()
      }
    }

    res.json({
      message: `Successfully refreshed ${historicalRates.length} historical rates`,
      count: historicalRates.length,
      days: days,
      source: 'historical',
      dateRange: {
        start: historicalRates[0]?.date,
        end: historicalRates[historicalRates.length - 1]?.date,
      },
    })
  } catch (error) {
    console.error('Error refreshing historical rates:', error)
    res.status(500).json({
      error: 'Failed to refresh historical rates',
      details: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

/**
 * GET /api/rates/historical-data
 * Proxy to ML service for pandas-processed Excel historical data
 */
router.get('/historical-data', async (req: Request, res: Response) => {
  try {
    const { range = 'ALL' } = req.query
    const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5001'
    
    const mlResponse = await axios.get(`${ML_SERVICE_URL}/api/historical-data`, {
      params: { range }
    })
    
    res.json(mlResponse.data)
  } catch (error: any) {
    console.error('Error fetching historical data from ML service:', error.message)
    res.status(500).json({ error: 'Failed to fetch historical data', details: error.message })
  }
})

export default router
