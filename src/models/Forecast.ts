import mongoose, { Schema, Document } from 'mongoose'

export interface IForecast extends Document {
  date: Date
  prediction: number
  confidence: number
  days_ahead: number
  rmse: number
  mae: number
  model_version: string
  created_at: Date
  updated_at: Date
}

const ForecastSchema: Schema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      index: true,
    },
    prediction: {
      type: Number,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    days_ahead: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
    },
    rmse: {
      type: Number,
    },
    mae: {
      type: Number,
    },
    model_version: {
      type: String,
      default: '1.0.0',
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// Index for efficient querying
ForecastSchema.index({ date: 1, days_ahead: 1 })

export default mongoose.model<IForecast>('Forecast', ForecastSchema)
