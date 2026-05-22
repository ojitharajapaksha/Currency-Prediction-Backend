import { sendWelcomeEmail, sendForecastEmails, sendGoodbyeEmail } from './emailService.js';
import axios from 'axios';

// Mock axios.post to return simulated prediction data for the daily forecast email
const originalPost = axios.post;
axios.post = async (url: string, ...args: any[]): Promise<any> => {
  if (url.includes('/api/rates/predict-tomorrow')) {
    console.log('✉️ Mocking ML prediction fetch for forecast email...');
    return {
      data: {
        prediction: 302.45,
        current_rate: 301.12,
        confidence: 94.8
      }
    };
  }
  return originalPost(url, ...args);
};

const run = async () => {
  const targetEmail = 'ojitharajapaksha@gmail.com';
  console.log(`✉️ Preparing to send 3 types of test emails to: ${targetEmail}`);
  console.log('--------------------------------------------------');

  // 1. Send Welcome Email
  console.log('1. Dispatching Welcome Email...');
  const welcomeSuccess = await sendWelcomeEmail(targetEmail);
  console.log(`Result: ${welcomeSuccess ? '✓ SUCCESS' : '✗ FAILED'}`);
  console.log('--------------------------------------------------');

  // 2. Send Daily Forecast Email
  console.log('2. Dispatching Daily Forecast Email...');
  const forecastSuccess = await sendForecastEmails(targetEmail);
  console.log(`Result: ${forecastSuccess ? '✓ SUCCESS' : '✗ FAILED'}`);
  console.log('--------------------------------------------------');

  // 3. Send Goodbye Email
  console.log('3. Dispatching Goodbye Email...');
  const goodbyeSuccess = await sendGoodbyeEmail(targetEmail);
  console.log(`Result: ${goodbyeSuccess ? '✓ SUCCESS' : '✗ FAILED'}`);
  console.log('--------------------------------------------------');

  const allSuccess = welcomeSuccess && forecastSuccess && goodbyeSuccess;
  if (allSuccess) {
    console.log('🎉 All 3 test emails sent successfully!');
    process.exit(0);
  } else {
    console.error('✗ Some emails failed to send. Check the logs above.');
    process.exit(1);
  }
};

run().catch((err) => {
  console.error('Error running test email dispatcher:', err);
  process.exit(1);
});
