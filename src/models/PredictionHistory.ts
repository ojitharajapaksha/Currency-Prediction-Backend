import mongoose, { Schema, Document } from 'mongoose'

export interface IPredictionHistory extends Document {
  prediction_date: Date
  target_date: Date
  predicted_rate: number
  actual_rate?: number
  confidence: number
  error?: number
  error_percentage?: number
  is_anomaly?: boolean
  warning?: string
  created_at: Date
  updated_at: Date
}

const PredictionHistorySchema: Schema = new Schema(
  {
    prediction_date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    target_date: {
      type: Date,
      required: true,
      index: true,
    },
    predicted_rate: {
      type: Number,
      required: true,
    },
    actual_rate: {
      type: Number,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    error: {
      type: Number,
    },
    error_percentage: {
      type: Number,
    },
    is_anomaly: {
      type: Boolean,
      default: false,
    },
    warning: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

// Index for query optimization
PredictionHistorySchema.index({ target_date: 1 })

export default mongoose.model<IPredictionHistory>('PredictionHistory', PredictionHistorySchema)
