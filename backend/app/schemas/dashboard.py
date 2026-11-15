from pydantic import BaseModel

class DashboardSummary(BaseModel):
    totalPlatforms: int
    availablePlatforms: int
    occupiedPlatforms: int
    reservedPlatforms: int
    incomingTrains: int
    departingTrains: int
    delayedTrains: int
    stationName: str
    timestamp: str

