import mongoose, { Document, Schema } from 'mongoose'

export interface ISubscriber extends Document {
  email: string
  active: boolean
  createdAt: Date
}

const SubscriberSchema: Schema = new Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
})

export default mongoose.model<ISubscriber>('Subscriber', SubscriberSchema)
