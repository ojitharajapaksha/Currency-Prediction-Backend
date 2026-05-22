# LKRVision AI - Backend

Node.js + Express + MongoDB backend for the LKRVision AI currency forecasting application.

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB 5.0+
- npm or pnpm

### Installation

```bash
cd backend
pnpm install
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
MONGODB_URI=mongodb://localhost:27017/lkrvision
PORT=5000
NODE_ENV=development
ML_SERVICE_URL=http://localhost:5001
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

### Running the Server

**Development:**
```bash
pnpm run dev
```

**Production:**
```bash
pnpm run build
pnpm run start
```

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Rates
- `GET /api/rates/current` - Get current USD/LKR rate
- `GET /api/rates/historical?days=30` - Get historical rates
- `POST /api/rates/predict-tomorrow` - Get tomorrow's prediction

### Forecast
- `POST /api/forecast` - Generate forecast
  ```json
  {
    "days": 7
  }
  ```
- `GET /api/forecast/:days` - Get forecast for specific days

### Analytics
- `GET /api/analytics/metrics` - Model performance metrics
- `GET /api/analytics/feature-importance` - SHAP feature importance
- `GET /api/analytics/shap-summary?days=7` - SHAP values for interpretability
- `GET /api/analytics/model-performance` - Detailed performance analysis

## Database Schema

### Rates
```typescript
{
  date: Date,           // Unique date index
  rate: Number,         // Exchange rate (USD/LKR)
  predicted_rate?: Number,
  actual_rate?: Number,
  confidence?: Number,  // 0-100
  source: String,       // 'historical' or 'real-time'
  created_at: Date,
  updated_at: Date
}
```

### Forecasts
```typescript
{
  date: Date,
  prediction: Number,
  confidence: Number,   // 0-100
  days_ahead: Number,   // 1-30
  rmse: Number,
  mae: Number,
  model_version: String,
  created_at: Date,
  updated_at: Date
}
```

## ML Service Integration

The backend communicates with a Python ML service for XGBoost predictions and SHAP explanations. Configure the ML service URL in `.env`:

```env
ML_SERVICE_URL=http://localhost:5001
```

## Deployment

### Vercel/Render
1. Push code to GitHub
2. Connect repository to Vercel or Render
3. Set environment variables
4. Deploy

Environment variables needed:
- `MONGODB_URI` - MongoDB connection string
- `NODE_ENV` - Set to `production`
- `ALLOWED_ORIGINS` - Frontend URL

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "details": {} // Optional validation details
}
```

## Type Safety

Uses TypeScript and Zod for runtime validation:

```typescript
const ForecastRequestSchema = z.object({
  days: z.number().int().min(1).max(30).default(7),
})
```

## Performance Optimization

- MongoDB indexes on frequently queried fields
- Efficient query patterns with projection
- CORS configuration for frontend integration
- JSON request/response handling

## Development

### Adding New Routes

1. Create new route file in `src/routes/`
2. Import in `src/server.ts`
3. Add middleware and error handling

### Database Operations

Use Mongoose models:

```typescript
import Rate from '../models/Rate.js'

const rate = await Rate.findOne({ date: new Date() })
```

## Testing

TODO: Add test suite

## Contributing

1. Follow existing code patterns
2. Add TypeScript types
3. Validate inputs with Zod
4. Document new endpoints
