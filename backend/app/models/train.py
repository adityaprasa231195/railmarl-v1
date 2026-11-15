from datetime import datetime, timezone
from typing import Any
from sqlalchemy import Column, String, Integer, Boolean, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from ..database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Train(Base):
    __tablename__ = "trains"

    id: Any = Column(String(50), primary_key=True, index=True)
    number: Any = Column(String(20), nullable=False, unique=True, index=True)
    name: Any = Column(String(100), nullable=False)
    category: Any = Column(String(30), nullable=False, default="EXPRESS")  # EXPRESS, PASSENGER, SUPERFAST, FREIGHT, OTHER
    origin: Any = Column(String(100), nullable=False)
    destination: Any = Column(String(100), nullable=False)
    arrival_time: Any = Column(String(10), nullable=False)
    departure_time: Any = Column(String(10), nullable=False)
    is_overnight: Any = Column(Boolean, nullable=False, default=False)
    platform_id: Any = Column(Integer, ForeignKey("platforms.id"), nullable=True)
    status: Any = Column(String(30), nullable=False, default="SCHEDULED")  # SCHEDULED, APPROACHING, ARRIVED, DEPARTED, CANCELLED
    delay: Any = Column(Integer, nullable=False, default=0)  # in minutes
    coaches: Any = Column(Integer, nullable=False, default=18)
    priority: Any = Column(String(20), nullable=False, default="MEDIUM")  # HIGH, MEDIUM, LOW
    description: Any = Column(Text, nullable=True)

    # Data Source & External Synchronization (Stage 7)
    data_source: Any = Column(String(30), nullable=False, default="DEMONSTRATION_DATA")  # EXTERNAL_API, MANUAL_ENTRY, DEMONSTRATION_DATA
    last_synced_at: Any = Column(DateTime, nullable=True)
    external_reference: Any = Column(String(100), nullable=True)

    created_at: Any = Column(DateTime, nullable=False, default=utc_now)
    updated_at: Any = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    platform: Any = relationship("Platform", back_populates="trains", foreign_keys=[platform_id])
    allocations: Any = relationship("Allocation", back_populates="train")
