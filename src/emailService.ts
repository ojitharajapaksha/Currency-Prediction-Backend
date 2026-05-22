import nodemailer from 'nodemailer'
import Subscriber from './models/Subscriber.js'
import dotenv from 'dotenv'
import axios from 'axios'

dotenv.config()

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export const sendForecastEmails = async (testEmail?: string) => {
  try {
    // 1. Get recipients
    let recipients: string[] = []
    if (testEmail) {
      recipients = [testEmail]
    } else {
      const activeSubscribers = await Subscriber.find({ active: true })
      if (activeSubscribers.length === 0) return
      recipients = activeSubscribers.map(sub => sub.email)
    }

    // 2. Fetch the latest prediction via the ML service running locally
    // Since we are in the Express backend, we can just hit our own API or ML service
    // Let's hit the Express endpoint to get the unified prediction object
    let predictionData = { prediction: 0, current_rate: 0, confidence: 0 }
    try {
      const port = process.env.PORT || 5000
      const response = await axios.post(`http://localhost:${port}/api/rates/predict-tomorrow`)
      predictionData = response.data
    } catch (err) {
      console.error('Could not fetch prediction for email. Ensure backend is running.', err)
      return
    }

    // 3. Construct HTML email
    const diff = predictionData.prediction - predictionData.current_rate
    const trend = diff >= 0 ? '↗ Up' : '↘ Down'
    const color = diff >= 0 ? '#ef4444' : '#22c55e' // Red for up (LKR weaker), Green for down

    // 4. Send emails
    for (const email of recipients) {
      const unsubscribeUrl = `http://localhost:${process.env.PORT || 5000}/api/subscribe/unsubscribe?email=${encodeURIComponent(email)}`
      
      const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">LKRVision Daily Forecast</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #334155;">Here is your AI-powered USD/LKR exchange rate forecast for tomorrow:</p>
          
          <div style="display: flex; justify-content: space-between; margin-top: 30px; margin-bottom: 30px; gap: 20px;">
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; text-align: center; border: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">Current Rate</p>
              <h2 style="margin: 10px 0 0 0; color: #0f172a; font-size: 24px;">Rs. ${predictionData.current_rate.toFixed(2)}</h2>
            </div>
            <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; flex: 1; text-align: center; border: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #64748b; font-size: 14px;">Tomorrow's AI Prediction</p>
              <h2 style="margin: 10px 0 0 0; color: ${color}; font-size: 24px;">Rs. ${predictionData.prediction.toFixed(2)} ${trend}</h2>
            </div>
          </div>
          
          <p style="font-size: 14px; color: #64748b; text-align: center;">
            Model Confidence: <strong>${predictionData.confidence.toFixed(1)}%</strong>
          </p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            You are receiving this because you subscribed to LKRVision Daily Forecasts.<br>
            <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Click here to instantly unsubscribe</a>.
          </p>
        </div>
      </div>
      `

      await transporter.sendMail({
        from: '"LKRVision AI" <' + process.env.SMTP_USER + '>',
        to: email,
        subject: `USD/LKR AI Forecast: Rs. ${predictionData.prediction.toFixed(2)} (${trend})`,
        html: htmlContent,
      })
      console.log(`📧 Successfully sent email to: ${email}`)
    }
    
    return true
  } catch (error) {
    console.error('📧 Failed to send forecast email:', error)
    return false
  }
}

export const sendWelcomeEmail = async (email: string) => {
  try {
    const unsubscribeUrl = `http://localhost:${process.env.PORT || 5000}/api/subscribe/unsubscribe?email=${encodeURIComponent(email)}`

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">Welcome to LKRVision! 🎉</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #334155;">Hi there,</p>
          <p style="font-size: 16px; color: #334155; line-height: 1.5;">
            Thank you for subscribing to the <strong>LKRVision Daily AI Forecast</strong>! 
          </p>
          <p style="font-size: 16px; color: #334155; line-height: 1.5;">
            You will now receive automated daily updates straight to your inbox featuring the latest USD/LKR exchange rate, tomorrow's AI prediction, and exclusive market insights powered by our XGBoost Machine Learning model.
          </p>
          
          <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 30px; text-align: center; border: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #64748b; font-size: 14px;">Your first daily forecast will arrive soon!</p>
          </div>
          
          <p style="font-size: 16px; color: #334155; margin-top: 30px;">
            Best regards,<br>
            <strong>The LKRVision AI Team</strong>
          </p>
          
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
          
          <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
            <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">Click here to instantly unsubscribe</a>.
          </p>
        </div>
      </div>
    `

    await transporter.sendMail({
      from: '"LKRVision AI" <' + process.env.SMTP_USER + '>',
      to: email,
      subject: `Welcome to LKRVision Daily Forecasts! 🎉`,
      html: htmlContent,
    })
    
    console.log(`📧 Successfully sent welcome email to: ${email}`)
    return true
  } catch (error) {
    console.error('📧 Failed to send welcome email:', error)
    return false
  }
}

export const sendGoodbyeEmail = async (email: string) => {
  try {
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0;">You have been unsubscribed</h1>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; color: #334155;">Hi there,</p>
          <p style="font-size: 16px; color: #334155; line-height: 1.5;">
            We're writing to confirm that you have been successfully unsubscribed from the LKRVision Daily AI Forecasts.
          </p>
          <p style="font-size: 16px; color: #334155; line-height: 1.5;">
            <strong>Thank you for being with us!</strong> We appreciate the time you spent testing our Machine Learning predictions.
          </p>
          
          <p style="font-size: 16px; color: #334155; margin-top: 30px;">
            If you ever wish to resubscribe, you can easily do so on the LKRVision dashboard.<br><br>
            Best regards,<br>
            <strong>The LKRVision AI Team</strong>
          </p>
        </div>
      </div>
    `

    await transporter.sendMail({
      from: '"LKRVision AI" <' + process.env.SMTP_USER + '>',
      to: email,
      subject: `Unsubscribed from LKRVision Forecasts`,
      html: htmlContent,
    })
    
    console.log(`📧 Successfully sent goodbye email to: ${email}`)
    return true
  } catch (error) {
    console.error('📧 Failed to send goodbye email:', error)
    return false
  }
}
