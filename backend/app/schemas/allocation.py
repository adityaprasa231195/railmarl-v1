from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field

class PlatformSuggestionOut(BaseModel):
    platformId: int = Field(..., alias="platformId")
    platformName: str = Field(..., alias="platformName")
    trackType: str = Field(..., alias="trackType")
    length: int
    maxCoaches: int = Field(..., alias="maxCoaches")
    score: int
    reasons: List[str] = []
    conflicts: List[str] = []
    isAvailable: bool = Field(..., alias="isAvailable")

    model_config = ConfigDict(populate_by_name=True)

class RecommendationRequest(BaseModel):
    trainId: str = Field(..., alias="trainId")
    bufferMinutes: Optional[int] = Field(15, alias="bufferMinutes")

    model_config = ConfigDict(populate_by_name=True)

class MLOccupancyAdvisory(BaseModel):
    isModelReady: bool = False
    predictedDurationMinutes: Optional[float] = None
    scheduledDwellMinutes: Optional[int] = None
    varianceMinutes: Optional[float] = None
    estimatedClearanceTime: Optional[str] = None
    estimatedClearanceTimeFormatted: Optional[str] = None
    scheduledArrivalFormatted: Optional[str] = None
    scheduledDepartureFormatted: Optional[str] = None
    confidence: Optional[int] = None
    advisoryNote: Optional[str] = None
    clearanceConflictWarning: Optional[str] = None
    algorithm: Optional[str] = None
    status: str = "UNTRAINED"
    display: Optional[dict] = None

    model_config = ConfigDict(populate_by_name=True)

class RecommendationResponse(BaseModel):
    trainId: str
    trainNumber: str
    trainName: str
    category: str
    coaches: int
    arrivalTime: str
    departureTime: str
    isOvernight: bool
    occupancyWindow: str
    clearanceWindow: str
    bufferMinutes: int
    recommended: Optional[PlatformSuggestionOut] = None
    alternatives: List[PlatformSuggestionOut] = []
    mlPrediction: Optional[MLOccupancyAdvisory] = None

    model_config = ConfigDict(populate_by_name=True)

class AllocationCreateRequest(BaseModel):
    trainId: str = Field(..., alias="trainId")
    platformId: int = Field(..., alias="platformId")
    status: Optional[str] = "RESERVED"
    notes: Optional[str] = None
    bufferMinutes: Optional[int] = Field(15, alias="bufferMinutes")

    model_config = ConfigDict(populate_by_name=True)

# Alias for backwards compatibility
AllocationCreate = AllocationCreateRequest

class AllocationBase(BaseModel):
    trainId: str
    platformId: int
    status: str = "RESERVED"
    score: int = 85
    reasons: List[str] = []
    conflicts: List[str] = []
    occupancyStart: Optional[str] = None
    occupancyEnd: Optional[str] = None
    notes: Optional[str] = None

class AllocationOut(AllocationBase):
    id: str
    createdAt: str
    updatedAt: Optional[str] = None
    trainName: Optional[str] = None
    trainNumber: Optional[str] = None
    trainCategory: Optional[str] = None
    trainStatus: Optional[str] = None
    platformName: Optional[str] = None
    platformType: Optional[str] = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    @classmethod
    def from_orm_model(cls, a):
        reasons_list = [r.strip() for r in (a.reasons or "").split(",") if r.strip()]
        conflicts_list = [c.strip() for c in (a.conflicts or "").split(",") if c.strip()]
        return cls(
            id=a.id,
            trainId=a.train_id,
            platformId=a.platform_id,
            status=a.status,
            score=a.score,
            reasons=reasons_list,
            conflicts=conflicts_list,
            occupancyStart=a.occupancy_start,
            occupancyEnd=a.occupancy_end,
            notes=a.notes,
            createdAt=a.created_at.isoformat() if a.created_at else "",
            updatedAt=a.updated_at.isoformat() if a.updated_at else "",
            trainName=a.train.name if a.train else None,
            trainNumber=a.train.number if a.train else None,
            trainCategory=a.train.category if a.train else None,
            trainStatus=a.train.status if a.train else None,
            platformName=a.platform.name if a.platform else None,
            platformType=a.platform.track_type if a.platform else None,
        )
