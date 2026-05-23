import axios from 'axios'

const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:5001'

export interface MlPredictionResponse {
  prediction: number
  confidence: number
  features_used?: number
  timestamp?: string
  is_anomaly?: boolean
  warning?: string
}

export async function predictWithMl(features: number[]): Promise<MlPredictionResponse> {
  const response = await axios.post<MlPredictionResponse>(`${mlServiceUrl}/api/predict`, {
    features,
  })

  return {
    prediction: Number(response.data.prediction),
    confidence: Number(response.data.confidence),
    features_used: response.data.features_used,
    timestamp: response.data.timestamp,
    is_anomaly: response.data.is_anomaly,
    warning: response.data.warning,
  }
}

export async function getMlFeatureImportance(): Promise<any> {
  const response = await axios.get(`${mlServiceUrl}/api/feature-importance`)
  return response.data
}

export async function getMlShapValues(features: number[] | number[][]): Promise<any> {
  const response = await axios.post(`${mlServiceUrl}/api/shap-values`, {
    features,
  })

  return response.data
}

export async function generateMlForecast(days: number, history: number[]): Promise<any> {
  const response = await axios.post(`${mlServiceUrl}/api/forecast`, {
    days,
    history,
  })

  return response.data
}
