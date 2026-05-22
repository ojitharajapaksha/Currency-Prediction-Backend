import express, { Router, Request, Response } from 'express'
import { z } from 'zod'
import Forecast from '../models/Forecast.js'
import Rate from '../models/Rate.js'
import { toTrend } from '../lib/feature-engineering.js'
import { generateMlForecast } from '../lib/ml-client.js'

const router: Router = express.Router()

const ForecastRequestSchema = z.object({
  days: z.number().int().min(1).max(30).default(7),
})

/**
 * POST /api/forecast
 * Generate forecasts for specified number of days
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { days } = ForecastRequestSchema.parse(req.body)

    const rateHistory = await Rate.find()
      .sort({ date: 1 })
      .limit(120)
      .exec()

    const currentRate = (await Rate.findOne({ source: 'real-time' })
      .sort({ date: -1 })
      .exec()) || rateHistory[rateHistory.length - 1]

    if (!currentRate) {
      return res.status(404).json({ error: 'No current rate available' })
    }

    const workingHistory = rateHistory.map((rate) => rate.rate)
    if (workingHistory[workingHistory.length - 1] !== currentRate.rate) {
      workingHistory.push(currentRate.rate)
    }

    // Call Python ML service to do recursive forecasting
    const mlResponse = await generateMlForecast(days, workingHistory)

    // Clear old forecasts to avoid duplicates
    await Forecast.deleteMany({})

    const forecastsToInsert = mlResponse.forecasts.map((f: any) => ({
      date: new Date(f.date),
      prediction: parseFloat(f.prediction.toFixed(2)),
      confidence: parseFloat(f.confidence.toFixed(2)),
      days_ahead: f.days_ahead,
      rmse: f.rmse,
      mae: f.mae,
      model_version: 'ml-service',
    }))

    // Save forecasts
    await Forecast.insertMany(forecastsToInsert)

    res.json({
      generated_at: new Date(),
      count: forecastsToInsert.length,
      days: days,
      forecasts: forecastsToInsert.map((f: any) => ({
        date: f.date,
        prediction: f.prediction,
        confidence: f.confidence,
        days_ahead: f.days_ahead,
        trend: toTrend(f.prediction, currentRate.rate),
      })),
    })
  } catch (error) {
    console.error('Forecast generation error:', error)
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request', details: error.errors })
    }
    res.status(500).json({ error: 'Failed to generate forecast' })
  }
})

/**
 * GET /api/forecast/:days
 * Get forecast for specific number of days
 */
router.get('/:days', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.params.days, 10)

    if (isNaN(days) || days < 1 || days > 30) {
      return res.status(400).json({ error: 'Days must be between 1 and 30' })
    }

    const rateHistory = await Rate.find().sort({ date: -1 }).limit(1).exec()
    const currentRate = rateHistory[0]

    if (!currentRate) {
      return res.status(404).json({ error: 'No current rate available' })
    }

    const forecasts = await Forecast.find({
      days_ahead: { $lte: days },
    })
      .sort({ date: 1 })
      .limit(days)
      .exec()

    res.json({
      days: days,
      count: forecasts.length,
      forecasts: forecasts.map((f, index) => {
        const previousPrediction = index === 0 ? currentRate.rate : forecasts[index - 1].prediction

        return {
          date: f.date,
          prediction: f.prediction,
          confidence: f.confidence,
          days_ahead: f.days_ahead,
          trend: toTrend(f.prediction, previousPrediction),
        }
      }),
    })
  } catch (error) {
    console.error('Forecast error:', error)
    res.status(500).json({ error: 'Failed to fetch forecast' })
  }
})

export default router
