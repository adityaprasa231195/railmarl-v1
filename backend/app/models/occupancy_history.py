from datetime import datetime, timezone
from typing import Any
from sqlalchemy import Column, String, Integer, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from ..database import Base

def utc_now():
    return datetime.now(timezone.utc)

class OccupancyHistory(Base):
    __tablename__ = "occupancy_history"

    id: Any = Column(String(50), primary_key=True, index=True)
    train_id: Any = Column(String(50), ForeignKey("trains.id", ondelete="SET NULL"), nullable=True)
    platform_id: Any = Column(Integer, ForeignKey("platforms.id", ondelete="SET NULL"), nullable=True)
    train_number: Any = Column(String(20), nullable=False, index=True)
    train_name: Any = Column(String(100), nullable=False)
    train_category: Any = Column(String(30), nullable=False, default="EXPRESS")
    scheduled_arrival: Any = Column(String(10), nullable=False)    # e.g. "14:30"
    scheduled_departure: Any = Column(String(10), nullable=False)  # e.g. "14:45"
    scheduled_dwell_minutes: Any = Column(Integer, nullable=False, default=15)
    coaches: Any = Column(Integer, nullable=False, default=18)
    day_of_week: Any = Column(Integer, nullable=False, default=0)  # 0=Monday, 6=Sunday
    arrival_timestamp: Any = Column(DateTime, nullable=False)
    clearance_timestamp: Any = Column(DateTime, nullable=False)
    actual_occupancy_duration: Any = Column(Float, nullable=False)  # in minutes
    is_synthetic: Any = Column(Boolean, nullable=False, default=True)
    notes: Any = Column(Text, nullable=True)
    created_at: Any = Column(DateTime, nullable=False, default=utc_now)

    # Relationships
    train: Any = relationship("Train", foreign_keys=[train_id])
    platform: Any = relationship("Platform", foreign_keys=[platform_id])

class PredictionLog(Base):
    __tablename__ = "prediction_logs"

    id: Any = Column(String(50), primary_key=True, index=True)
    train_id: Any = Column(String(50), nullable=True)
    platform_id: Any = Column(Integer, nullable=True)
    train_number: Any = Column(String(20), nullable=False)
    train_category: Any = Column(String(30), nullable=False)
    scheduled_dwell_minutes: Any = Column(Integer, nullable=False)
    predicted_duration_minutes: Any = Column(Float, nullable=False)
    estimated_clearance_time: Any = Column(String(10), nullable=False)  # e.g. "16:22"
    actual_duration_minutes: Any = Column(Float, nullable=True)
    model_version: Any = Column(String(30), nullable=False, default="rf-v1.0")
    created_at: Any = Column(DateTime, nullable=False, default=utc_now)
