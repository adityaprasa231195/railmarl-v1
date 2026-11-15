from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, field_validator

VALID_STATUSES = {"AVAILABLE", "OCCUPIED", "RESERVED", "OUT_OF_SERVICE"}

def normalize_status(val: str) -> str:
    if not val:
        return "AVAILABLE"
    clean = val.strip().upper().replace("-", "_")
    if clean not in VALID_STATUSES:
        raise ValueError(
            f"Invalid status '{val}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}"
        )
    return clean

class PlatformBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="Platform identifier name")
    status: str = Field(default="AVAILABLE", description="AVAILABLE, OCCUPIED, RESERVED, OUT_OF_SERVICE")
    description: Optional[str] = Field(None, max_length=500, description="Platform operational description")
    type: str = Field(default="Through", description="Main, Through, Bay, Goods")
    length: int = Field(default=500, gt=0, description="Platform length in meters")
    max_coaches: int = Field(default=20, gt=0, description="Maximum coach capacity")
    features: List[str] = Field(default_factory=list, description="Amenities and equipment list")
    assignedTrain: Optional[str] = None
    trainName: Optional[str] = None
    arrivalTime: Optional[str] = None
    departureTime: Optional[str] = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: str) -> str:
        return normalize_status(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Platform name cannot be empty or blank")
        return trimmed

class PlatformCreate(PlatformBase):
    id: int = Field(..., gt=0, description="Unique positive integer platform number")

class PlatformUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    status: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    type: Optional[str] = None
    length: Optional[int] = Field(None, gt=0)
    max_coaches: Optional[int] = Field(None, gt=0)
    features: Optional[List[str]] = None
    assignedTrain: Optional[str] = None
    trainName: Optional[str] = None
    arrivalTime: Optional[str] = None
    departureTime: Optional[str] = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return normalize_status(v)

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        trimmed = v.strip()
        if not trimmed:
            raise ValueError("Platform name cannot be empty")
        return trimmed

class PlatformOut(PlatformBase):
    id: int
    createdDate: Optional[str] = None
    updatedDate: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_model(cls, p):
        features_list = [f.strip() for f in (p.features or "").split(",") if f.strip()]
        return cls(
            id=p.id,
            name=p.name,
            status=p.status.upper() if p.status else "AVAILABLE",
            description=p.description,
            type=p.track_type,
            length=p.length,
            max_coaches=p.max_coaches,
            features=features_list,
            assignedTrain=p.assigned_train_number,
            trainName=p.assigned_train_name,
            arrivalTime=p.arrival_time,
            departureTime=p.departure_time,
            createdDate=p.created_at.isoformat() if hasattr(p, "created_at") and p.created_at else None,
            updatedDate=p.updated_at.isoformat() if hasattr(p, "updated_at") and p.updated_at else None,
        )
