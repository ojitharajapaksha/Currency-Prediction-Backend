import mongoose, { Schema, Document } from 'mongoose'

export interface IRate extends Document {
  date: Date
  rate: number
  predicted_rate?: number
  actual_rate?: number
  confidence?: number
  source: string
  created_at: Date
  updated_at: Date
}

const RateSchema: Schema = new Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },
    rate: {
      type: Number,
      required: true,
    },
    predicted_rate: {
      type: Number,
    },
    actual_rate: {
      type: Number,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
    },
    source: {
      type: String,
      default: 'historical',
      enum: ['historical', 'real-time', 'frankfurter-api', 'simulated-realistic-data'],
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  }
)

export default mongoose.model<IRate>('Rate', RateSchema)
