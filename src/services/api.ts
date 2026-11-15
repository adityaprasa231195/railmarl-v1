// RAILMARL Frontend API Client
// Connects React to the FastAPI backend at http://localhost:8000/api

import type { Platform, Train } from '../data/mockData'

const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:8000/api'
const API_BASE = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl.replace(/\/$/, '')}/api`

export interface DashboardSummary {
  totalPlatforms: number
  availablePlatforms: number
  occupiedPlatforms: number
  reservedPlatforms: number
  incomingTrains: number
  departingTrains: number
  delayedTrains: number
  stationName: string
  timestamp: string
}

export interface BackendHealth {
  status: string
  service: string
  version: string
  station: string
  database: string
  timestamp: string
}

export interface SuggestedPlatform {
  platformId: number
  platformName: string
  trackType: string
  length: number
  maxCoaches: number
  score: number
  reasons: string[]
  conflicts: string[]
  isAvailable: boolean
}

export interface MLOccupancyAdvisory {
  isModelReady: boolean
  predictedDurationMinutes?: number
  scheduledDwellMinutes?: number
  varianceMinutes?: number
  estimatedClearanceTime?: string
  estimatedClearanceTimeFormatted?: string
  scheduledArrivalFormatted?: string
  scheduledDepartureFormatted?: string
  confidence?: number
  advisoryNote?: string
  clearanceConflictWarning?: string
  status: string
  algorithm?: string
  display?: Record<string, string>
}

export interface RecommendationResponse {
  trainId: string
  trainNumber: string
  trainName: string
  category: string
  coaches: number
  arrivalTime: string
  departureTime: string
  isOvernight: boolean
  occupancyWindow: string
  clearanceWindow: string
  bufferMinutes: number
  recommended: SuggestedPlatform | null
  alternatives: SuggestedPlatform[]
  mlPrediction?: MLOccupancyAdvisory
}

export interface AllocationRecord {
  id: string
  trainId: string
  platformId: number
  status: string
  score: number
  reasons: string[]
  conflicts: string[]
  createdAt: string
  updatedAt?: string
  occupancyStart?: string
  occupancyEnd?: string
  notes?: string
  trainName?: string
  trainNumber?: string
  trainCategory?: string
  trainStatus?: string
  platformName?: string
  platformType?: string
}

export interface AllocationCreatePayload {
  trainId: string
  platformId: number
  status?: string
  notes?: string
  bufferMinutes?: number
}

export interface MLStatusResponse {
  status: 'TRAINED' | 'UNTRAINED' | 'INSUFFICIENT_DATA' | 'TRAINING' | string
  modelVersion: string
  totalTrainingRecords: number
  syntheticRecords: number
  realRecords: number
  lastTrainedAt?: string | null
  minSamplesRequired: number
  algorithm: string
  isReady: boolean
  dataNotice: string
}

export interface ActualVsPredictedItem {
  trainNumber: string
  trainCategory: string
  scheduledDwell: number
  actual: number
  predicted: number
  variance: number
  accuracyPct: number
}

export interface FeatureImportanceItem {
  feature: string
  importance: number
}

export interface MLMetricsResponse {
  status: string
  isReady: boolean
  mae?: number | null
  rmse?: number | null
  r2Score?: number | null
  sampleCount: number
  testSamples: number
  actualVsPredicted: ActualVsPredictedItem[]
  featureImportances: FeatureImportanceItem[]
  lastTrainedAt?: string | null
  notes?: string | null
}

export interface PredictRequest {
  trainId?: string
  trainNumber?: string
  trainCategory?: string
  scheduledArrival: string
  scheduledDeparture: string
  coaches?: number
  platformId?: number
  dayOfWeek?: number
}

export interface PredictResponse {
  trainNumber: string
  trainCategory: string
  scheduledArrival?: string
  scheduledDeparture?: string
  scheduledArrivalFormatted?: string
  scheduledDepartureFormatted?: string
  scheduledDwellMinutes: number
  predictedDurationMinutes: number
  varianceFromScheduleMinutes: number
  estimatedClearanceTime: string
  estimatedClearanceTimeFormatted?: string
  confidence: number
  isModelReady: boolean
  algorithm?: string
  advisoryNote: string
  status: string
  display?: Record<string, string>
}

export interface PredictionHistoryItem {
  id: string
  trainNumber: string
  trainCategory: string
  scheduledDwellMinutes: number
  predictedDurationMinutes: number
  estimatedClearanceTime: string
  estimatedClearanceTimeFormatted?: string
  actualDurationMinutes?: number | null
  modelVersion: string
  createdAt: string
}

export interface TrainModelResponse {
  success: boolean
  status: string
  message: string
  sampleCount: number
  algorithm?: string
  mae?: number | null
  rmse?: number | null
  r2Score?: number | null
}

export interface PlatformCreatePayload {
  id: number
  name: string
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE' | string
  description?: string
  type: string
  length: number
  max_coaches?: number
  features: string[]
}

export interface PlatformUpdatePayload {
  name?: string
  status?: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE' | string
  description?: string
  type?: string
  length?: number
  max_coaches?: number
  features?: string[]
}

export interface TrainCreatePayload {
  id?: string
  number: string
  name: string
  category: string
  origin: string
  destination: string
  arrivalTime: string
  departureTime: string
  isOvernight?: boolean
  platform?: number | null
  status?: string
  delay?: number
  coaches?: number
  priority?: string
  description?: string
  dataSource?: string
  externalReference?: string
}

export interface TrainUpdatePayload {
  number?: string
  name?: string
  category?: string
  origin?: string
  destination?: string
  arrivalTime?: string
  departureTime?: string
  isOvernight?: boolean
  platform?: number | null
  status?: string
  delay?: number
  coaches?: number
  priority?: string
  description?: string
  dataSource?: string
  externalReference?: string
}

export interface ExternalTrainSchedule {
  trainNumber: string
  trainName: string
  category: string
  origin: string
  destination: string
  arrivalTime: string
  departureTime: string
  isOvernight: boolean
  dwellMinutes: number
  coaches: number
  stationCode: string
  stationName: string
  runsOnDays: string[]
  provider: string
  dataSource: string
  lastUpdated: string
  liveStatus?: {
    delayMinutes: number
    currentStation: string
    statusSummary: string
  }
  alreadyExistsInLocalDb?: boolean
  localTrainId?: string | null
  localDataSource?: string | null
}

export interface RailwayAPIStatusResponse {
  provider: string
  isConfigured: boolean
  isConnected: boolean
  isOfflineFallback: boolean
  stationCode: string
  stationName: string
  cacheEntries: number
  lastSyncTimestamp?: string | null
  message: string
  rateLimitRemaining?: number | null
}

export interface TrainSearchResponse {
  query: string
  provider: string
  isOfflineFallback: boolean
  totalResults: number
  stationCode: string
  results: ExternalTrainSchedule[]
}

export interface TrainImportResultItem {
  trainNumber: string
  trainName: string
  status: 'IMPORTED' | 'UPDATED' | 'SKIPPED_EXISTING' | 'PRESERVED_MANUAL' | 'FAILED' | string
  message: string
  trainId?: string | null
}

export interface TrainImportResponse {
  totalRequested: number
  importedCount: number
  updatedCount: number
  skippedCount: number
  failedCount: number
  results: TrainImportResultItem[]
  timestamp: string
}

export interface LiveRunningStatusResponse {
  trainNumber: string
  trainName: string
  currentStation: string
  delayMinutes: number
  statusSummary: string
  expectedArrivalAtTarget?: string
  lastUpdated: string
  provider: string
  isOfflineMock?: boolean
}

// ==========================================
// STAGE 9: TRAFFIC MANAGEMENT TYPES
// ==========================================

export interface TrafficSummaryItem {
  incomingTrains: number
  departingTrains: number
  delayedTrains: number
  pendingPlatformRequests: number
  platformOccupancyPercent: number
  activeConflictsCount: number
  stationCongestionLevel: 'LOW' | 'MODERATE' | 'HIGH' | string
  activeProvider: string
  isOffline: boolean
  lastSyncTimestamp?: string | null
  dataFreshnessNotice: string
}

export interface TrafficLiveTrain {
  id?: string
  trainNumber: string
  trainName: string
  category: string
  origin: string
  destination: string
  scheduledTime: string
  expectedTime: string
  delayMinutes: number
  status: string
  platformId?: number | null
  platformName?: string | null
  coaches: number
  currentStation?: string | null
  dataSource: string
  lastUpdated: string
  isDelayed: boolean
}

export interface TrafficQueueItem {
  queuePosition: number
  trainId: string
  trainNumber: string
  trainName: string
  category: string
  origin: string
  destination: string
  scheduledArrival: string
  expectedArrival: string
  delayMinutes: number
  coaches: number
  priorityLevel: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | string
  priorityScore: number
  priorityReason: string
  recommendedPlatform?: number | null
  status: string
}

export interface TrafficConflictItem {
  conflictId: string
  platformId: number
  platformName: string
  trainA: { number: string; name: string; window: string }
  trainB: { number: string; name: string; window: string }
  severity: 'HIGH' | 'MEDIUM' | string
  overlapMinutes: number
  description: string
  suggestedAction: string
}

export interface HourlyTrafficDensity {
  hour: string
  arrivals: number
  departures: number
  totalMovements: number
  isPeak: boolean
}

export interface BusyPeriod {
  timeWindow: string
  label: string
  trainCount: number
  description: string
}

export interface TrafficOverviewResponse {
  summary: TrafficSummaryItem
  busyPeriods: BusyPeriod[]
  hourlyDensity: HourlyTrafficDensity[]
  congestionNotice: string
  lastUpdated: string
}

export interface TrafficArrivalsResponse {
  total: number
  delayedCount: number
  onTimeCount: number
  arrivals: TrafficLiveTrain[]
  lastUpdated: string
}

export interface TrafficDeparturesResponse {
  total: number
  delayedCount: number
  departures: TrafficLiveTrain[]
  lastUpdated: string
}

export interface TrafficQueueResponse {
  totalInQueue: number
  urgentCount: number
  queue: TrafficQueueItem[]
  lastUpdated: string
}

export interface TrafficConflictsResponse {
  totalConflicts: number
  highSeverityCount: number
  conflicts: TrafficConflictItem[]
  lastUpdated: string
}

export interface TrafficSyncResponse {
  success: boolean
  provider: string
  isOffline: boolean
  syncedTrainsCount: number
  message: string
  timestamp: string
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`
    try {
      const errorJson = await response.json()
      if (errorJson.detail) {
        errorMsg = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail)
      } else if (errorJson.message) {
        errorMsg = errorJson.message
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg)
  }

  return response.json() as Promise<T>
}

export const api = {
  getHealth: () => request<BackendHealth>('/health'),

  getDashboardSummary: () => request<DashboardSummary>('/dashboard/summary'),

  getPlatforms: (status?: string, search?: string) => {
    const params = new URLSearchParams()
    if (status && status.toLowerCase() !== 'all') {
      params.set('status', status)
    }
    if (search && search.trim()) {
      params.set('search', search.trim())
    }
    const query = params.toString() ? `?${params.toString()}` : ''
    return request<Platform[]>(`/platforms${query}`)
  },

  getPlatformById: (id: number) => request<Platform>(`/platforms/${id}`),

  createPlatform: (data: PlatformCreatePayload) =>
    request<Platform>('/platforms', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updatePlatform: (id: number, data: PlatformUpdatePayload) =>
    request<Platform>(`/platforms/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deletePlatform: (id: number) =>
    request<{ success: boolean; message: string; id: number }>(`/platforms/${id}`, {
      method: 'DELETE',
    }),

  getTrains: (params?: { category?: string; status?: string; search?: string }) => {
    const searchParams = new URLSearchParams()
    if (params?.category && params.category !== 'all') {
      searchParams.set('category', params.category)
    }
    if (params?.status && params.status !== 'all') {
      searchParams.set('status', params.status)
    }
    if (params?.search && params.search.trim()) {
      searchParams.set('search', params.search.trim())
    }
    const query = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return request<Train[]>(`/trains${query}`)
  },

  getTrainById: (id: string) => request<Train>(`/trains/${encodeURIComponent(id)}`),

  createTrain: (data: TrainCreatePayload) =>
    request<Train>('/trains', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTrain: (id: string, data: TrainUpdatePayload) =>
    request<Train>(`/trains/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTrain: (id: string) =>
    request<{ success: boolean; message: string; id: string }>(`/trains/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getAllocations: (status?: string) => {
    const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
    return request<AllocationRecord[]>(`/allocations${query}`)
  },

  getAllocationById: (id: string) => request<AllocationRecord>(`/allocations/${encodeURIComponent(id)}`),

  recommendPlatform: (trainId: string, bufferMinutes: number = 15) =>
    request<RecommendationResponse>('/allocations/recommend', {
      method: 'POST',
      body: JSON.stringify({ trainId, bufferMinutes }),
    }),

  createAllocation: (data: AllocationCreatePayload) =>
    request<AllocationRecord>('/allocations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelAllocation: (id: string) =>
    request<AllocationRecord>(`/allocations/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    }),

  releaseAllocation: (id: string) =>
    request<AllocationRecord>(`/allocations/${encodeURIComponent(id)}/release`, {
      method: 'POST',
    }),

  // ==========================================
  // STAGE 6: MACHINE LEARNING & PREDICTION API
  // ==========================================

  getMLStatus: () => request<MLStatusResponse>('/ml/status'),

  getMLMetrics: () => request<MLMetricsResponse>('/ml/metrics'),

  trainMLModel: (algorithm: string = 'DecisionTree') =>
    request<TrainModelResponse>(`/ml/train?algorithm=${encodeURIComponent(algorithm)}`, {
      method: 'POST',
    }),

  predictOccupancy: (data: PredictRequest) =>
    request<PredictResponse>('/ml/predict', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMLPredictionHistory: (limit: number = 25) =>
    request<PredictionHistoryItem[]>(`/ml/history?limit=${limit}`),

  seedMLSynthetic: (count: number = 70) =>
    request<{ success: boolean; message: string }>(`/ml/seed-synthetic?count=${count}`, {
      method: 'POST',
    }),

  // External Railway API Endpoints (Stage 7)
  getRailwayAPIStatus: () => request<RailwayAPIStatusResponse>('/railway-api/status'),

  testRailwayAPIConnection: () =>
    request<{ isConnected: boolean; isOfflineFallback: boolean; provider: string; message: string; rateLimitRemaining?: number }>(
      '/railway-api/test-connection',
      { method: 'POST' }
    ),

  searchRailwayTrains: (query: string, stationCode: string = 'ET') =>
    request<TrainSearchResponse>(`/railway-api/search?query=${encodeURIComponent(query)}&station_code=${stationCode}`),

  getLiveTrainStatus: (trainNumber: string, stationCode: string = 'ET') =>
    request<LiveRunningStatusResponse>(`/railway-api/live-status?train_number=${encodeURIComponent(trainNumber)}&station_code=${stationCode}`),

  importRailwayTrains: (trains: ExternalTrainSchedule[], overwriteExisting: boolean = false) =>
    request<TrainImportResponse>('/railway-api/import', {
      method: 'POST',
      body: JSON.stringify({ trains, overwriteExisting }),
    }),

  clearRailwayAPICache: () =>
    request<{ success: boolean; clearedEntries: number; message: string }>('/railway-api/cache', {
      method: 'DELETE',
    }),

  // ==========================================
  // STAGE 9: TRAFFIC MANAGEMENT API
  // ==========================================

  getTrafficOverview: () => request<TrafficOverviewResponse>('/traffic/overview'),
  getTrafficArrivals: () => request<TrafficArrivalsResponse>('/traffic/arrivals'),
  getTrafficDepartures: () => request<TrafficDeparturesResponse>('/traffic/departures'),
  getTrafficQueue: () => request<TrafficQueueResponse>('/traffic/queue'),
  getTrafficConflicts: () => request<TrafficConflictsResponse>('/traffic/conflicts'),
  syncTrafficTelemetry: () =>
    request<TrafficSyncResponse>('/traffic/sync', {
      method: 'POST',
    }),
}
