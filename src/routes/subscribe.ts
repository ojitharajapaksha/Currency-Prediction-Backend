import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import Subscriber from '../models/Subscriber.js'
import { sendWelcomeEmail } from '../emailService.js'

const router = Router()

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
})

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = subscribeSchema.parse(req.body)

    let subscriber = await Subscriber.findOne({ email })
    if (subscriber) {
      if (!subscriber.active) {
        subscriber.active = true
        await subscriber.save()
        // Send welcome back email silently in background
        sendWelcomeEmail(email).catch(console.error)
        return res.json({ success: true, message: 'Subscription reactivated successfully!' })
      }
      return res.status(400).json({ error: 'Email is already subscribed' })
    }

    subscriber = new Subscriber({ email })
    await subscriber.save()

    // Send welcome email silently in background
    sendWelcomeEmail(email).catch(console.error)

    res.status(201).json({ success: true, message: 'Successfully subscribed to daily forecasts!' })
  } catch (error) {
    next(error)
  }
})

router.get('/unsubscribe', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.query.email as string
    if (!email) {
      return res.status(400).send('Missing email parameter.')
    }

    const subscriber = await Subscriber.findOne({ email })
    if (!subscriber) {
      return res.status(404).send('Subscriber not found.')
    }

    if (subscriber.active) {
      subscriber.active = false
      await subscriber.save()
      
      // Send goodbye email silently in background
      import('../emailService.js').then(module => module.sendGoodbyeEmail(email)).catch(console.error)
    }

    res.send(`
      <div style="font-family: sans-serif; text-align: center; margin-top: 50px;">
        <h2>You have been unsubscribed</h2>
        <p>You will no longer receive daily forecasts at <strong>${email}</strong>.</p>
        <p>You can close this tab.</p>
      </div>
    `)
  } catch (error) {
    next(error)
  }
})

export default router
