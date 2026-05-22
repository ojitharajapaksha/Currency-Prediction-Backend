import { sendForecastEmails } from './emailService.js'

console.log('Sending test email...')

sendForecastEmails('ojitharajapaksha@gmail.com')
  .then((success) => {
    if (success) {
      console.log('Test email sent successfully!')
    } else {
      console.log('Failed to send test email.')
    }
    process.exit(0)
  })
  .catch((err) => {
    console.error('Error:', err)
    process.exit(1)
  })
