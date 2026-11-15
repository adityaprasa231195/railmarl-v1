// ============================================================
// RAILMARL — Mock Data for UI Demonstration
// All data below is illustrative and does not represent
// actual Itarsi Junction schedules, trains, or operations.
// ============================================================

export interface Platform {
  id: number
  name: string
  type: 'Main' | 'Through' | 'Bay' | 'Goods' | string
  status: 'available' | 'occupied' | 'reserved' | 'out_of_service' | 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'OUT_OF_SERVICE' | string
  length: number // in meters
  max_coaches?: number
  description?: string
  assignedTrain?: string
  trainName?: string
  arrivalTime?: string
  departureTime?: string
  features: string[]
  createdDate?: string
  updatedDate?: string
}

export interface Train {
  id: string
  name: string
  number: string
  category: 'Superfast' | 'Express' | 'Mail' | 'Passenger' | 'Freight' | 'SUPERFAST' | 'EXPRESS' | 'PASSENGER' | 'FREIGHT' | 'OTHER' | string
  origin: string
  destination: string
  arrivalTime: string
  departureTime: string
  isOvernight?: boolean
  platform?: number
  platformName?: string
  platformType?: string
  status: 'on-time' | 'delayed' | 'arrived' | 'departed' | 'approaching' | 'SCHEDULED' | 'APPROACHING' | 'ARRIVED' | 'DEPARTED' | 'CANCELLED' | string
  delay?: number // in minutes
  coaches: number
  priority: 'high' | 'medium' | 'low' | 'HIGH' | 'MEDIUM' | 'LOW' | string
  description?: string
  dataSource?: 'EXTERNAL_API' | 'MANUAL_ENTRY' | 'DEMONSTRATION_DATA' | string
  lastSyncedAt?: string
  externalReference?: string
  createdDate?: string
  updatedDate?: string
}

export interface AllocationRequest {
  id: string
  trainId: string
  trainName: string
  trainNumber: string
  requestedAt: string
  arrivalTime: string
  departureTime: string
  coaches: number
  category: string
  priority: 'high' | 'medium' | 'low'
  suggestedPlatforms: SuggestedPlatform[]
  status: 'pending' | 'approved' | 'rejected'
}

export interface SuggestedPlatform {
  platformId: number
  platformName: string
  score: number
  reasons: string[]
  conflicts: string[]
}

export interface ActivityLog {
  id: string
  type: 'arrival' | 'departure' | 'allocation' | 'delay' | 'alert'
  message: string
  timestamp: string
  trainId?: string
}

// -- Platforms --
export const platforms: Platform[] = [
  {
    id: 1, name: 'Platform 1', type: 'Main', status: 'occupied', length: 600,
    assignedTrain: '12627', trainName: 'Karnataka Express',
    arrivalTime: '14:30', departureTime: '14:45',
    features: ['Covered', 'Display Board', 'Waiting Room'],
  },
  {
    id: 2, name: 'Platform 2', type: 'Main', status: 'reserved', length: 550,
    assignedTrain: '12186', trainName: 'Rewanchal Express',
    arrivalTime: '15:10', departureTime: '15:25',
    features: ['Covered', 'Display Board'],
  },
  {
    id: 3, name: 'Platform 3', type: 'Through', status: 'available', length: 500,
    features: ['Covered', 'Display Board', 'Food Stall'],
  },
  {
    id: 4, name: 'Platform 4', type: 'Through', status: 'occupied', length: 480,
    assignedTrain: '11072', trainName: 'Kamayani Express',
    arrivalTime: '13:55', departureTime: '14:20',
    features: ['Covered'],
  },
  {
    id: 5, name: 'Platform 5', type: 'Through', status: 'available', length: 520,
    features: ['Covered', 'Display Board'],
  },
  {
    id: 6, name: 'Platform 6', type: 'Bay', status: 'reserved', length: 350,
    assignedTrain: '51828', trainName: 'Itarsi Passenger',
    arrivalTime: '15:45', departureTime: '16:30',
    features: ['Open'],
  },
  {
    id: 7, name: 'Platform 7', type: 'Bay', status: 'available', length: 300,
    features: ['Open'],
  },
  {
    id: 8, name: 'Platform 8', type: 'Goods', status: 'occupied', length: 700,
    assignedTrain: 'GOODS-4421', trainName: 'Freight Rake',
    arrivalTime: '12:00', departureTime: '16:00',
    features: ['Loading Crane', 'Weighbridge'],
  },
]

// -- Trains --
export const trains: Train[] = [
  {
    id: 't1', name: 'Karnataka Express', number: '12627',
    category: 'Superfast', origin: 'New Delhi', destination: 'Bengaluru',
    arrivalTime: '14:30', departureTime: '14:45', platform: 1,
    status: 'arrived', coaches: 24, priority: 'high',
  },
  {
    id: 't2', name: 'Rewanchal Express', number: '12186',
    category: 'Express', origin: 'Rewa', destination: 'Mumbai CSMT',
    arrivalTime: '15:10', departureTime: '15:25', platform: 2,
    status: 'approaching', coaches: 18, priority: 'medium',
  },
  {
    id: 't3', name: 'Kamayani Express', number: '11072',
    category: 'Express', origin: 'Varanasi', destination: 'Mumbai LTT',
    arrivalTime: '13:55', departureTime: '14:20', platform: 4,
    status: 'arrived', delay: 12, coaches: 20, priority: 'medium',
  },
  {
    id: 't4', name: 'Narmada Express', number: '18234',
    category: 'Express', origin: 'Indore', destination: 'Bilaspur',
    arrivalTime: '16:00', departureTime: '16:15',
    status: 'on-time', coaches: 16, priority: 'medium',
  },
  {
    id: 't5', name: 'Itarsi Passenger', number: '51828',
    category: 'Passenger', origin: 'Itarsi', destination: 'Bhopal',
    arrivalTime: '15:45', departureTime: '16:30', platform: 6,
    status: 'on-time', coaches: 8, priority: 'low',
  },
  {
    id: 't6', name: 'Punjab Mail', number: '12138',
    category: 'Mail', origin: 'Firozpur', destination: 'Mumbai CSMT',
    arrivalTime: '17:20', departureTime: '17:35',
    status: 'delayed', delay: 45, coaches: 22, priority: 'high',
  },
  {
    id: 't7', name: 'Gondwana Express', number: '12412',
    category: 'Superfast', origin: 'Nagpur', destination: 'Hazrat Nizamuddin',
    arrivalTime: '18:05', departureTime: '18:15',
    status: 'on-time', coaches: 20, priority: 'high',
  },
  {
    id: 't8', name: 'Freight Rake', number: 'GOODS-4421',
    category: 'Freight', origin: 'Katni', destination: 'Mumbai',
    arrivalTime: '12:00', departureTime: '16:00', platform: 8,
    status: 'arrived', coaches: 42, priority: 'low',
  },
]

// -- Allocation Requests --
export const allocationRequests: AllocationRequest[] = [
  {
    id: 'ar1', trainId: 't4', trainName: 'Narmada Express', trainNumber: '18234',
    requestedAt: '15:40', arrivalTime: '16:00', departureTime: '16:15',
    coaches: 16, category: 'Express', priority: 'medium',
    suggestedPlatforms: [
      { platformId: 3, platformName: 'Platform 3', score: 92, reasons: ['Available now', '500m — fits 16 coaches', 'No upcoming conflicts'], conflicts: [] },
      { platformId: 5, platformName: 'Platform 5', score: 87, reasons: ['Available now', '520m — fits 16 coaches'], conflicts: ['Gondwana Express arriving 18:05'] },
    ],
    status: 'pending',
  },
  {
    id: 'ar2', trainId: 't6', trainName: 'Punjab Mail', trainNumber: '12138',
    requestedAt: '15:50', arrivalTime: '17:20', departureTime: '17:35',
    coaches: 22, category: 'Mail', priority: 'high',
    suggestedPlatforms: [
      { platformId: 1, platformName: 'Platform 1', score: 88, reasons: ['600m — fits 22 coaches', 'Will be free by 14:45', 'Main platform for Mail trains'], conflicts: [] },
      { platformId: 5, platformName: 'Platform 5', score: 72, reasons: ['Available now'], conflicts: ['520m — tight for 22 coaches'] },
    ],
    status: 'pending',
  },
  {
    id: 'ar3', trainId: 't7', trainName: 'Gondwana Express', trainNumber: '12412',
    requestedAt: '16:00', arrivalTime: '18:05', departureTime: '18:15',
    coaches: 20, category: 'Superfast', priority: 'high',
    suggestedPlatforms: [
      { platformId: 2, platformName: 'Platform 2', score: 95, reasons: ['550m — fits 20 coaches', 'Will be free by 15:25', 'Main platform for Superfast'], conflicts: [] },
      { platformId: 3, platformName: 'Platform 3', score: 78, reasons: ['500m — fits 20 coaches', 'Currently available'], conflicts: ['May conflict if Narmada Express allocated here'] },
    ],
    status: 'pending',
  },
]

// -- Activity Log --
export const activityLog: ActivityLog[] = [
  { id: 'a1', type: 'arrival', message: 'Karnataka Express (12627) arrived on Platform 1', timestamp: '14:30', trainId: 't1' },
  { id: 'a2', type: 'delay', message: 'Kamayani Express (11072) delayed by 12 min', timestamp: '14:10', trainId: 't3' },
  { id: 'a3', type: 'arrival', message: 'Kamayani Express (11072) arrived on Platform 4', timestamp: '14:07', trainId: 't3' },
  { id: 'a4', type: 'allocation', message: 'Platform 6 reserved for Itarsi Passenger (51828)', timestamp: '13:50', trainId: 't5' },
  { id: 'a5', type: 'departure', message: 'Shipra Express (19320) departed from Platform 3', timestamp: '13:45' },
  { id: 'a6', type: 'alert', message: 'Punjab Mail (12138) running 45 min late', timestamp: '13:30', trainId: 't6' },
  { id: 'a7', type: 'allocation', message: 'Platform 2 reserved for Rewanchal Express (12186)', timestamp: '13:15', trainId: 't2' },
  { id: 'a8', type: 'departure', message: 'Kushinagar Express (11016) departed from Platform 5', timestamp: '12:50' },
  { id: 'a9', type: 'arrival', message: 'Freight Rake (GOODS-4421) arrived on Platform 8', timestamp: '12:00', trainId: 't8' },
  { id: 'a10', type: 'allocation', message: 'Platform 8 allocated for Freight Rake loading', timestamp: '11:45', trainId: 't8' },
]

// -- Chart Data (Illustrative) --
export const hourlyOccupancy = [
  { hour: '06:00', occupancy: 25 },
  { hour: '07:00', occupancy: 38 },
  { hour: '08:00', occupancy: 62 },
  { hour: '09:00', occupancy: 75 },
  { hour: '10:00', occupancy: 50 },
  { hour: '11:00', occupancy: 45 },
  { hour: '12:00', occupancy: 55 },
  { hour: '13:00', occupancy: 70 },
  { hour: '14:00', occupancy: 80 },
  { hour: '15:00', occupancy: 65 },
  { hour: '16:00', occupancy: 58 },
  { hour: '17:00', occupancy: 72 },
  { hour: '18:00', occupancy: 85 },
  { hour: '19:00', occupancy: 60 },
  { hour: '20:00', occupancy: 40 },
  { hour: '21:00', occupancy: 30 },
  { hour: '22:00', occupancy: 20 },
]

export const dwellTimeData = [
  { train: 'Karnataka Exp', predicted: 14, actual: 15 },
  { train: 'Rewanchal Exp', predicted: 12, actual: 15 },
  { train: 'Kamayani Exp', predicted: 20, actual: 25 },
  { train: 'Narmada Exp', predicted: 13, actual: 15 },
  { train: 'Itarsi Pass', predicted: 40, actual: 45 },
  { train: 'Punjab Mail', predicted: 12, actual: 15 },
  { train: 'Gondwana Exp', predicted: 8, actual: 10 },
]

export const platformUsageWeekly = [
  { day: 'Mon', pf1: 78, pf2: 65, pf3: 55, pf4: 60, pf5: 45 },
  { day: 'Tue', pf1: 72, pf2: 70, pf3: 60, pf4: 55, pf5: 50 },
  { day: 'Wed', pf1: 80, pf2: 68, pf3: 58, pf4: 62, pf5: 48 },
  { day: 'Thu', pf1: 75, pf2: 72, pf3: 62, pf4: 58, pf5: 52 },
  { day: 'Fri', pf1: 85, pf2: 78, pf3: 70, pf4: 65, pf5: 58 },
  { day: 'Sat', pf1: 90, pf2: 82, pf3: 75, pf4: 70, pf5: 62 },
  { day: 'Sun', pf1: 88, pf2: 80, pf3: 72, pf4: 68, pf5: 55 },
]

export const predictionAccuracy = [
  { month: 'Jun', accuracy: 78 },
  { month: 'Jul', accuracy: 81 },
  { month: 'Aug', accuracy: 79 },
  { month: 'Sep', accuracy: 84 },
  { month: 'Oct', accuracy: 87 },
  { month: 'Nov', accuracy: 89 },
]

export const clearancePredictions = [
  { platform: 'Platform 1', train: 'Karnataka Express', predictedClearance: '14:48', confidence: 92 },
  { platform: 'Platform 4', train: 'Kamayani Express', predictedClearance: '14:25', confidence: 85 },
  { platform: 'Platform 8', train: 'Freight Rake', predictedClearance: '16:15', confidence: 78 },
  { platform: 'Platform 6', train: 'Itarsi Passenger', predictedClearance: '16:35', confidence: 88 },
]
