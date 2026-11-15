from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class ExternalHaltDetail(BaseModel):
    stationCode: str
    stationName: str
    arrivalTime: str
    departureTime: str
    haltMinutes: int
    day: int
    distanceKm: Optional[int] = None

class ExternalTrainSchedule(BaseModel):
    trainNumber: str = Field(..., description="5-digit train number")
    trainName: str = Field(..., description="Official train name")
    category: str = Field(default="EXPRESS", description="SUPERFAST, EXPRESS, PASSENGER, etc.")
    origin: str = Field(..., description="Origin station name or code")
    destination: str = Field(..., description="Destination station name or code")
    arrivalTime: str = Field(..., description="Scheduled arrival time at Itarsi Jn (HH:MM)")
    departureTime: str = Field(..., description="Scheduled departure time at Itarsi Jn (HH:MM)")
    isOvernight: bool = Field(default=False, description="Whether departure crosses midnight")
    dwellMinutes: int = Field(default=15, description="Platform dwell duration in minutes")
    coaches: int = Field(default=20, description="Rake coach count")
    stationCode: str = Field(default="ET", description="Halt station code (default ET)")
    stationName: str = Field(default="Itarsi Junction", description="Station name")
    runsOnDays: List[str] = Field(default_factory=lambda: ["All Days"])
    provider: str = Field(default="rapidapi_irctc")
    dataSource: str = Field(default="EXTERNAL_API")
    lastUpdated: str = Field(..., description="Provider retrieval timestamp")
    liveStatus: Optional[Dict[str, Any]] = None
    alreadyExistsInLocalDb: bool = Field(default=False)
    localTrainId: Optional[str] = None
    localDataSource: Optional[str] = None

class RailwayAPIStatusResponse(BaseModel):
    provider: str
    isConfigured: bool
    isConnected: bool
    isOfflineFallback: bool
    stationCode: str
    stationName: str
    cacheEntries: int
    lastSyncTimestamp: Optional[str] = None
    message: str
    rateLimitRemaining: Optional[int] = None

class TrainSearchResponse(BaseModel):
    query: str
    provider: str
    isOfflineFallback: bool
    totalResults: int
    stationCode: str
    results: List[ExternalTrainSchedule]

class TrainImportRequest(BaseModel):
    trains: List[ExternalTrainSchedule]
    overwriteExisting: bool = Field(default=False, description="Whether to overwrite existing local train records")

class TrainImportResultItem(BaseModel):
    trainNumber: str
    trainName: str
    status: str  # "IMPORTED", "UPDATED", "SKIPPED_EXISTING", "PRESERVED_MANUAL", "FAILED"
    message: str
    trainId: Optional[str] = None

class TrainImportResponse(BaseModel):
    totalRequested: int
    importedCount: int
    updatedCount: int
    skippedCount: int
    failedCount: int
    results: List[TrainImportResultItem]
    timestamp: str

class LiveRunningStatusResponse(BaseModel):
    trainNumber: str
    trainName: str
    currentStation: str
    delayMinutes: int
    statusSummary: str
    expectedArrivalAtTarget: Optional[str] = None
    lastUpdated: str
    provider: str
    isOfflineMock: bool = False
