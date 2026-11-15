from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field

class ModelStatusResponse(BaseModel):
    status: str
    modelVersion: str
    totalTrainingRecords: int
    syntheticRecords: int
    realRecords: int
    lastTrainedAt: Optional[str] = None
    minSamplesRequired: int
    algorithm: str = "Decision Tree Regression (Scikit-Learn DecisionTreeRegressor)"
    isReady: bool
    dataNotice: str = "Training records include synthetic demonstration samples for Itarsi Junction testing."

    model_config = ConfigDict(populate_by_name=True)

class ActualVsPredictedItem(BaseModel):
    trainNumber: str
    trainCategory: str
    scheduledDwell: int
    actual: float
    predicted: float
    variance: float
    accuracyPct: int

class FeatureImportanceItem(BaseModel):
    feature: str
    importance: float

class ModelMetricsResponse(BaseModel):
    status: str
    isReady: bool
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2Score: Optional[float] = None
    sampleCount: int = 0
    testSamples: int = 0
    actualVsPredicted: List[ActualVsPredictedItem] = []
    featureImportances: List[FeatureImportanceItem] = []
    lastTrainedAt: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class PredictRequest(BaseModel):
    trainId: Optional[str] = None
    trainNumber: Optional[str] = "TRAIN-DEMO"
    trainCategory: Optional[str] = "EXPRESS"
    scheduledArrival: str = "14:30"
    scheduledDeparture: str = "14:45"
    coaches: Optional[int] = 18
    platformId: Optional[int] = 1
    dayOfWeek: Optional[int] = None

    model_config = ConfigDict(populate_by_name=True)

class PredictResponse(BaseModel):
    trainNumber: str
    trainCategory: str
    scheduledArrival: Optional[str] = None
    scheduledDeparture: Optional[str] = None
    scheduledArrivalFormatted: Optional[str] = None
    scheduledDepartureFormatted: Optional[str] = None
    scheduledDwellMinutes: int
    predictedDurationMinutes: float
    varianceFromScheduleMinutes: float
    estimatedClearanceTime: str
    estimatedClearanceTimeFormatted: Optional[str] = None
    confidence: int
    isModelReady: bool
    algorithm: Optional[str] = None
    advisoryNote: str
    status: str
    display: Optional[Dict[str, str]] = None

    model_config = ConfigDict(populate_by_name=True)

class PredictionHistoryItem(BaseModel):
    id: str
    trainNumber: str
    trainCategory: str
    scheduledDwellMinutes: int
    predictedDurationMinutes: float
    estimatedClearanceTime: str
    estimatedClearanceTimeFormatted: Optional[str] = None
    actualDurationMinutes: Optional[float] = None
    modelVersion: str
    createdAt: str

    model_config = ConfigDict(populate_by_name=True)

class TrainModelResponse(BaseModel):
    success: bool
    status: str
    message: str
    sampleCount: int
    algorithm: Optional[str] = None
    mae: Optional[float] = None
    rmse: Optional[float] = None
    r2Score: Optional[float] = None

    model_config = ConfigDict(populate_by_name=True)
