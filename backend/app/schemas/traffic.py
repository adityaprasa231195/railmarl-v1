from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field

class TrafficSummaryItem(BaseModel):
    incomingTrains: int
    departingTrains: int
    delayedTrains: int
    pendingPlatformRequests: int
    platformOccupancyPercent: float
    activeConflictsCount: int
    stationCongestionLevel: str  # "LOW", "MODERATE", "HIGH"
    activeProvider: str
    isOffline: bool
    lastSyncTimestamp: Optional[str] = None
    dataFreshnessNotice: str

    model_config = ConfigDict(populate_by_name=True)

class TrafficLiveTrain(BaseModel):
    id: Optional[str] = None
    trainNumber: str
    trainName: str
    category: str
    origin: str
    destination: str
    scheduledTime: str
    expectedTime: str
    delayMinutes: int = 0
    status: str = "SCHEDULED"
    platformId: Optional[int] = None
    platformName: Optional[str] = None
    coaches: int = 18
    currentStation: Optional[str] = None
    dataSource: str = "DEMONSTRATION_DATA"
    lastUpdated: str
    isDelayed: bool = False

    model_config = ConfigDict(populate_by_name=True)

class TrafficQueueItem(BaseModel):
    queuePosition: int
    trainId: str
    trainNumber: str
    trainName: str
    category: str
    origin: str
    destination: str
    scheduledArrival: str
    expectedArrival: str
    delayMinutes: int
    coaches: int
    priorityLevel: str  # "URGENT", "HIGH", "MEDIUM", "LOW"
    priorityScore: int  # 0 to 100
    priorityReason: str
    recommendedPlatform: Optional[int] = None
    status: str

    model_config = ConfigDict(populate_by_name=True)

class TrafficConflictItem(BaseModel):
    conflictId: str
    platformId: int
    platformName: str
    trainA: Dict[str, Any]
    trainB: Dict[str, Any]
    severity: str  # "HIGH" or "MEDIUM"
    overlapMinutes: int
    description: str
    suggestedAction: str

    model_config = ConfigDict(populate_by_name=True)

class HourlyTrafficDensity(BaseModel):
    hour: str
    arrivals: int
    departures: int
    totalMovements: int
    isPeak: bool

    model_config = ConfigDict(populate_by_name=True)

class BusyPeriod(BaseModel):
    timeWindow: str
    label: str
    trainCount: int
    description: str

    model_config = ConfigDict(populate_by_name=True)

class TrafficOverviewResponse(BaseModel):
    summary: TrafficSummaryItem
    busyPeriods: List[BusyPeriod]
    hourlyDensity: List[HourlyTrafficDensity]
    congestionNotice: str
    lastUpdated: str

    model_config = ConfigDict(populate_by_name=True)

class TrafficArrivalsResponse(BaseModel):
    total: int
    delayedCount: int
    onTimeCount: int
    arrivals: List[TrafficLiveTrain]
    lastUpdated: str

    model_config = ConfigDict(populate_by_name=True)

class TrafficDeparturesResponse(BaseModel):
    total: int
    delayedCount: int
    departures: List[TrafficLiveTrain]
    lastUpdated: str

    model_config = ConfigDict(populate_by_name=True)

class TrafficQueueResponse(BaseModel):
    totalInQueue: int
    urgentCount: int
    queue: List[TrafficQueueItem]
    lastUpdated: str

    model_config = ConfigDict(populate_by_name=True)

class TrafficConflictsResponse(BaseModel):
    totalConflicts: int
    highSeverityCount: int
    conflicts: List[TrafficConflictItem]
    lastUpdated: str

    model_config = ConfigDict(populate_by_name=True)

class TrafficSyncResponse(BaseModel):
    success: bool
    provider: str
    isOffline: bool
    syncedTrainsCount: int
    message: str
    timestamp: str

    model_config = ConfigDict(populate_by_name=True)
