from datetime import datetime, timezone
from typing import Any
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from ..database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Allocation(Base):
    __tablename__ = "allocations"

    id: Any = Column(String(50), primary_key=True, index=True)
    train_id: Any = Column(String(50), ForeignKey("trains.id"), nullable=False)
    platform_id: Any = Column(Integer, ForeignKey("platforms.id"), nullable=False)
    status: Any = Column(String(20), nullable=False, default="RESERVED")  # PENDING, RESERVED, ACTIVE, COMPLETED, CANCELLED
    score: Any = Column(Integer, nullable=False, default=85)
    reasons: Any = Column(Text, nullable=True)  # Comma-separated or JSON text
    conflicts: Any = Column(Text, nullable=True)  # Comma-separated or JSON text
    occupancy_start: Any = Column(String(10), nullable=True)  # e.g. "16:00"
    occupancy_end: Any = Column(String(10), nullable=True)    # e.g. "16:15"
    notes: Any = Column(Text, nullable=True)
    created_at: Any = Column(DateTime, nullable=False, default=utc_now)
    updated_at: Any = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    train: Any = relationship("Train", back_populates="allocations")
    platform: Any = relationship("Platform", back_populates="allocations")
