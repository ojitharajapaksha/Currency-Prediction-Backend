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

/**
 * Send the daily USD/LKR AI Forecast email to active subscribers
 */
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

    // 2. Fetch the latest prediction via the ML service
    let predictionData = { prediction: 0, current_rate: 0, confidence: 0 }
    try {
      const port = process.env.PORT || 5000
      const response = await axios.post(`http://localhost:${port}/api/rates/predict-tomorrow`)
      predictionData = response.data
    } catch (err) {
      console.error('Could not fetch prediction for email. Ensure backend is running.', err)
      return
    }

    // 3. Construct HTML email metrics and visual styles
    const diff = predictionData.prediction - predictionData.current_rate
    const trend = diff >= 0 ? '▲ Up' : '▼ Down'
    const color = diff >= 0 ? '#ef4444' : '#10b981' // Indigo-Red for up (LKR weaker), Emerald Green for down (LKR stronger)

    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

    // 4. Send emails
    for (const email of recipients) {
      const unsubscribeUrl = `${backendUrl}/api/subscribe/unsubscribe?email=${encodeURIComponent(email)}`
      
      const htmlContent = `
      <div style="background-color: #f8fafc; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0;">
        <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Brand Header -->
          <div style="background-image: linear-gradient(135deg, #0b0f19 0%, #1e1b4b 100%); padding: 36px 24px; text-align: center;">
            <div style="display: inline-block; padding: 6px 14px; border: 1.5px solid #6366f1; border-radius: 6px; margin-bottom: 14px;">
              <span style="color: #6366f1; font-weight: 700; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-family: -apple-system, sans-serif;">LKRVision AI</span>
            </div>
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Daily Market Forecast</h1>
            <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">Your AI-Powered USD/LKR Exchange Rate Update</p>
          </div>

          <!-- Content Body -->
          <div style="padding: 32px 24px;">
            <p style="font-size: 15px; color: #475569; margin: 0 0 24px 0; text-align: center; line-height: 1.6;">
              Here is tomorrow's automated **USD to LKR** prediction computed by our machine learning models:
            </p>

            <!-- Prediction Cards Grid (Flexbox/Table for high client support) -->
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
              <tr>
                <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center;">
                  <p style="margin: 0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Current Rate</p>
                  <h2 style="margin: 8px 0 0 0; color: #0f172a; font-size: 22px; font-weight: 700;">Rs. ${predictionData.current_rate.toFixed(2)}</h2>
                </td>
                <td width="4%"></td>
                <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center;">
                  <p style="margin: 0; color: #64748b; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Tomorrow's AI Prediction</p>
                  <h2 style="margin: 8px 0 0 0; color: ${color}; font-size: 22px; font-weight: 700;">Rs. ${predictionData.prediction.toFixed(2)} <span style="font-size: 15px; font-weight: 600;">${trend}</span></h2>
                </td>
              </tr>
            </table>

            <!-- Confidence Progress Bar -->
            <div style="background-color: #e0e7ff; border-radius: 12px; padding: 16px 20px; margin-bottom: 32px; border-left: 4px solid #6366f1;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="font-size: 12px; color: #4338ca; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Model Confidence Level</span>
                  </td>
                  <td align="right">
                    <span style="font-size: 16px; color: #4338ca; font-weight: 800;">${predictionData.confidence.toFixed(1)}%</span>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding-top: 10px;">
                    <div style="background-color: rgba(99, 102, 241, 0.2); height: 6px; border-radius: 3px; overflow: hidden; width: 100%;">
                      <div style="background-color: #6366f1; height: 100%; width: ${predictionData.confidence}%; border-radius: 3px;"></div>
                    </div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- Action Button -->
            <div style="text-align: center; margin-bottom: 28px;">
              <a href="${frontendUrl}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2), 0 2px 4px -2px rgba(99, 102, 241, 0.2);">
                View Full AI Analytics Dashboard
              </a>
            </div>

            <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 28px 0;" />

            <!-- Footer Info -->
            <div style="text-align: center;">
              <p style="font-size: 12px; color: #94a3b8; margin: 0 0 10px 0; line-height: 1.6;">
                This prediction is computed automatically by LKRVision's optimized XGBoost AI model using historical trends and real-time market data indicators.
              </p>
              <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.6;">
                You received this because you subscribed to LKRVision Daily Forecasts.<br />
                <a href="${unsubscribeUrl}" style="color: #6366f1; text-decoration: underline; font-weight: 500;">Unsubscribe Instantly</a>
              </p>
            </div>
          </div>
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

/**
 * Send the welcome email to new subscribers
 */
export const sendWelcomeEmail = async (email: string) => {
  try {
    const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    const unsubscribeUrl = `${backendUrl}/api/subscribe/unsubscribe?email=${encodeURIComponent(email)}`

    const htmlContent = `
    <div style="background-color: #f8fafc; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
        
        <!-- Brand Header -->
        <div style="background-image: linear-gradient(135deg, #0b0f19 0%, #1e1b4b 100%); padding: 40px 24px; text-align: center;">
          <div style="display: inline-block; padding: 6px 14px; border: 1.5px solid #6366f1; border-radius: 6px; margin-bottom: 14px;">
            <span style="color: #6366f1; font-weight: 700; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-family: -apple-system, sans-serif;">LKRVision AI</span>
          </div>
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Welcome to LKRVision</h1>
          <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">Your AI-Powered Currency Forecasting Journey Begins</p>
        </div>

        <!-- Content Body -->
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 16px; color: #0f172a; margin: 0 0 16px 0; font-weight: 700;">Hi there,</h2>
          <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
            Thank you for subscribing to the **LKRVision Daily AI Forecasts**! You are now part of an advanced framework designed to provide maximum clarity on the Sri Lankan Rupee (LKR) exchange rate movements.
          </p>

          <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
            Starting tomorrow, you will receive automated daily updates straight to your inbox featuring:
          </p>

          <!-- Perks Checklist (Clean circle bullet divs instead of emojis) -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 30px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td valign="top" style="padding-top: 6px; padding-bottom: 16px; width: 24px;">
                  <div style="width: 8px; height: 8px; background-color: #6366f1; border-radius: 50%;"></div>
                </td>
                <td style="font-size: 14px; color: #475569; padding-bottom: 16px; line-height: 1.6;">
                  <strong style="color: #0f172a; font-weight: 600;">Daily Predictions</strong> — Calculated at exactly 8:00 AM Sri Lankan time using our optimized XGBoost algorithms.
                </td>
              </tr>
              <tr>
                <td valign="top" style="padding-top: 6px; padding-bottom: 16px; width: 24px;">
                  <div style="width: 8px; height: 8px; background-color: #6366f1; border-radius: 50%;"></div>
                </td>
                <td style="font-size: 14px; color: #475569; padding-bottom: 16px; line-height: 1.6;">
                  <strong style="color: #0f172a; font-weight: 600;">Confidence Metrics</strong> — Error margins updated dynamically using recent real-world performance tracking.
                </td>
              </tr>
              <tr>
                <td valign="top" style="padding-top: 6px; width: 24px;">
                  <div style="width: 8px; height: 8px; background-color: #6366f1; border-radius: 50%;"></div>
                </td>
                <td style="font-size: 14px; color: #475569; line-height: 1.6;">
                  <strong style="color: #0f172a; font-weight: 600;">AI Driver Insights</strong> — Based on SHAP mathematical calculations, letting you see exactly what is moving the market.
                </td>
              </tr>
            </table>
          </div>

          <!-- Action Button -->
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${frontendUrl}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2), 0 2px 4px -2px rgba(99, 102, 241, 0.2);">
              Go to LKRVision Dashboard
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 28px 0;" />

          <!-- Footer Info -->
          <div style="text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.6;">
              If you ever wish to cancel your subscription, you can do so at any time using the one-click unsubscribe links at the bottom of our emails.<br />
              <a href="${unsubscribeUrl}" style="color: #6366f1; text-decoration: underline; font-weight: 500;">Unsubscribe instantly</a>
            </p>
          </div>
        </div>
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

/**
 * Send the goodbye email to unsubscribed subscribers
 */
export const sendGoodbyeEmail = async (email: string) => {
  try {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'

    const htmlContent = `
    <div style="background-color: #f8fafc; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; line-height: 1.5; margin: 0;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
        
        <!-- Brand Header -->
        <div style="background-image: linear-gradient(135deg, #0b0f19 0%, #1e1b4b 100%); padding: 40px 24px; text-align: center;">
          <div style="display: inline-block; padding: 6px 14px; border: 1.5px solid #6366f1; border-radius: 6px; margin-bottom: 14px;">
            <span style="color: #6366f1; font-weight: 700; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; font-family: -apple-system, sans-serif;">LKRVision AI</span>
          </div>
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Subscription Cancelled</h1>
          <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 14px;">We're sad to see you go!</p>
        </div>

        <!-- Content Body -->
        <div style="padding: 32px 24px;">
          <h2 style="font-size: 16px; color: #0f172a; margin: 0 0 16px 0; font-weight: 700;">Hi there,</h2>
          <p style="font-size: 15px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
            This email confirms that you have been successfully **unsubscribed** from LKRVision Daily AI Forecasts. Your email address has been immediately removed from our active dispatch queue.
          </p>

          <!-- Reassurance Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin-bottom: 28px; border-left: 4px solid #64748b;">
            <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">
              <strong>No further action is required.</strong> You will no longer receive any automated forecast notifications from us. Thank you for testing out our model and platform!
            </p>
          </div>

          <p style="font-size: 15px; color: #475569; margin: 0 0 24px 0; line-height: 1.6;">
            If this was an accident, or if you decide to come back in the future, you can easily resubscribe at any time with a single click:
          </p>

          <!-- Action Button -->
          <div style="text-align: center; margin-bottom: 20px;">
            <a href="${frontendUrl}" style="background-color: #6366f1; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.2), 0 2px 4px -2px rgba(99, 102, 241, 0.2);">
              Resubscribe instantly to LKRVision
            </a>
          </div>

          <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 28px 0;" />

          <!-- Footer Info -->
          <div style="text-align: center;">
            <p style="font-size: 12px; color: #94a3b8; margin: 0; line-height: 1.6;">
              Best wishes,<br />
              <strong>The LKRVision AI Team</strong>
            </p>
          </div>
        </div>
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
