import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

TIME_REGEX = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")

VALID_CATEGORIES = {"EXPRESS", "PASSENGER", "SUPERFAST", "FREIGHT", "OTHER", "MAIL"}
VALID_STATUSES = {"SCHEDULED", "APPROACHING", "ARRIVED", "DEPARTED", "CANCELLED", "ON_TIME", "DELAYED"}
VALID_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}
VALID_DATA_SOURCES = {"EXTERNAL_API", "MANUAL_ENTRY", "DEMONSTRATION_DATA"}

def normalize_category(v: str) -> str:
    clean = v.strip().upper()
    if clean not in VALID_CATEGORIES:
        raise ValueError(f"Invalid category '{v}'. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}")
    return clean

def normalize_status(v: str) -> str:
    clean = v.strip().upper().replace("-", "_")
    if clean not in VALID_STATUSES:
        raise ValueError(f"Invalid status '{v}'. Must be one of: {', '.join(sorted(VALID_STATUSES))}")
    return clean

def normalize_priority(v: str) -> str:
    clean = v.strip().upper()
    if clean not in VALID_PRIORITIES:
        return "MEDIUM"
    return clean

def normalize_data_source(v: str) -> str:
    clean = v.strip().upper()
    if clean not in VALID_DATA_SOURCES:
        return "MANUAL_ENTRY"
    return clean

def validate_hhmm(v: str, field_name: str) -> str:
    trimmed = v.strip()
    if not TIME_REGEX.match(trimmed):
        raise ValueError(f"{field_name} must be in 24-hour HH:MM format (e.g. '14:30', '09:15'). Received '{v}'")
    return trimmed

class TrainBase(BaseModel):
    number: str = Field(..., min_length=1, max_length=20, description="Train service number")
    name: str = Field(..., min_length=1, max_length=100, description="Train service name")
    category: str = Field(default="EXPRESS", description="EXPRESS, PASSENGER, SUPERFAST, FREIGHT, OTHER")
    origin: str = Field(..., min_length=1, max_length=100, description="Origin station name")
    destination: str = Field(..., min_length=1, max_length=100, description="Destination station name")
    arrivalTime: str = Field(..., description="Scheduled arrival time in HH:MM (24-hour format)")
    departureTime: str = Field(..., description="Scheduled departure time in HH:MM (24-hour format)")
    isOvernight: bool = Field(default=False, description="Set to true if departure occurs on the following calendar day")
    platform: Optional[int] = Field(default=None, description="Assigned platform track ID")
    status: str = Field(default="SCHEDULED", description="SCHEDULED, APPROACHING, ARRIVED, DEPARTED, CANCELLED")
    delay: Optional[int] = Field(default=0, ge=0, description="Schedule delay offset in minutes")
    coaches: int = Field(default=18, gt=0, le=60, description="Rake coach count")
    priority: str = Field(default="MEDIUM", description="Dispatch priority: HIGH, MEDIUM, LOW")
    description: Optional[str] = Field(default=None, max_length=500, description="Operational notes or rake characteristics")

    # Data Source & Sync Tracking (Stage 7)
    dataSource: str = Field(default="DEMONSTRATION_DATA", description="EXTERNAL_API, MANUAL_ENTRY, DEMONSTRATION_DATA")
    lastSyncedAt: Optional[str] = Field(default=None, description="ISO timestamp of last external API synchronization")
    externalReference: Optional[str] = Field(default=None, description="External provider reference ID or note")

    @field_validator("category", mode="before")
    @classmethod
    def check_category(cls, v: str) -> str:
        return normalize_category(v)

    @field_validator("status", mode="before")
    @classmethod
    def check_status(cls, v: str) -> str:
        return normalize_status(v)

    @field_validator("priority", mode="before")
    @classmethod
    def check_priority(cls, v: str) -> str:
        return normalize_priority(v)

    @field_validator("dataSource", mode="before")
    @classmethod
    def check_data_source(cls, v: Optional[str]) -> str:
        if not v:
            return "DEMONSTRATION_DATA"
        return normalize_data_source(v)

    @field_validator("arrivalTime")
    @classmethod
    def check_arrival(cls, v: str) -> str:
        return validate_hhmm(v, "Arrival time")

    @field_validator("departureTime")
    @classmethod
    def check_departure(cls, v: str) -> str:
        return validate_hhmm(v, "Departure time")

    @model_validator(mode="after")
    def validate_schedule_times(self) -> "TrainBase":
        # Unless overnight schedule is explicitly configured, departure must not precede arrival
        if not self.isOvernight and self.departureTime < self.arrivalTime:
            raise ValueError(
                f"Scheduled departure ({self.departureTime}) cannot be earlier than arrival ({self.arrivalTime}) "
                f"on the same calendar day. If this is an overnight dwell, enable the 'isOvernight' option."
            )
        return self

class TrainCreate(TrainBase):
    id: Optional[str] = Field(default=None, description="Unique train ID (auto-generated if omitted)")
    dataSource: str = Field(default="MANUAL_ENTRY", description="EXTERNAL_API, MANUAL_ENTRY, DEMONSTRATION_DATA")

class TrainUpdate(BaseModel):
    number: Optional[str] = Field(default=None, min_length=1, max_length=20)
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    category: Optional[str] = None
    origin: Optional[str] = Field(default=None, min_length=1, max_length=100)
    destination: Optional[str] = Field(default=None, min_length=1, max_length=100)
    arrivalTime: Optional[str] = None
    departureTime: Optional[str] = None
    isOvernight: Optional[bool] = None
    platform: Optional[int] = None
    status: Optional[str] = None
    delay: Optional[int] = Field(default=None, ge=0)
    coaches: Optional[int] = Field(default=None, gt=0, le=60)
    priority: Optional[str] = None
    description: Optional[str] = Field(default=None, max_length=500)
    dataSource: Optional[str] = None
    lastSyncedAt: Optional[str] = None
    externalReference: Optional[str] = None

    @field_validator("category", mode="before")
    @classmethod
    def check_category(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return normalize_category(v)

    @field_validator("status", mode="before")
    @classmethod
    def check_status(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return normalize_status(v)

    @field_validator("priority", mode="before")
    @classmethod
    def check_priority(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return normalize_priority(v)

    @field_validator("dataSource", mode="before")
    @classmethod
    def check_data_source(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return normalize_data_source(v)

    @field_validator("arrivalTime")
    @classmethod
    def check_arrival(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return validate_hhmm(v, "Arrival time")

    @field_validator("departureTime")
    @classmethod
    def check_departure(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        return validate_hhmm(v, "Departure time")

class TrainOut(TrainBase):
    id: str
    platformName: Optional[str] = None
    platformType: Optional[str] = None
    createdDate: Optional[str] = None
    updatedDate: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

    @classmethod
    def from_orm_model(cls, t):
        p_name = t.platform.name if t.platform else None
        p_type = t.platform.track_type if t.platform else None
        return cls(
            id=t.id,
            number=t.number,
            name=t.name,
            category=t.category,
            origin=t.origin,
            destination=t.destination,
            arrivalTime=t.arrival_time,
            departureTime=t.departure_time,
            isOvernight=bool(getattr(t, "is_overnight", False)),
            platform=t.platform_id,
            platformName=p_name,
            platformType=p_type,
            status=t.status,
            delay=t.delay,
            coaches=t.coaches,
            priority=t.priority,
            description=t.description,
            dataSource=getattr(t, "data_source", "DEMONSTRATION_DATA") or "DEMONSTRATION_DATA",
            lastSyncedAt=t.last_synced_at.isoformat() if getattr(t, "last_synced_at", None) else None,
            externalReference=getattr(t, "external_reference", None),
            createdDate=t.created_at.isoformat() if hasattr(t, "created_at") and t.created_at else None,
            updatedDate=t.updated_at.isoformat() if hasattr(t, "updated_at") and t.updated_at else None,
        )
