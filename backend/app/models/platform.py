from datetime import datetime, timezone
from typing import Any
from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.orm import relationship
from ..database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Platform(Base):
    __tablename__ = "platforms"

    id: Any = Column(Integer, primary_key=True, index=True)
    name: Any = Column(String(50), nullable=False)
    status: Any = Column(String(30), nullable=False, default="AVAILABLE")  # AVAILABLE, OCCUPIED, RESERVED, OUT_OF_SERVICE
    description: Any = Column(Text, nullable=True)
    track_type: Any = Column(String(30), nullable=False, default="Through")  # Main, Through, Bay, Goods
    length: Any = Column(Integer, nullable=False, default=500)  # Length in meters
    max_coaches: Any = Column(Integer, nullable=False, default=20)
    features: Any = Column(String(255), nullable=False, default="Covered")  # Comma-separated tags
    
    # Optional active train assignment information
    assigned_train_number: Any = Column(String(20), nullable=True)
    assigned_train_name: Any = Column(String(100), nullable=True)
    arrival_time: Any = Column(String(10), nullable=True)
    departure_time: Any = Column(String(10), nullable=True)

    created_at: Any = Column(DateTime, nullable=False, default=utc_now)
    updated_at: Any = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)

    # Relationships
    trains: Any = relationship("Train", back_populates="platform", foreign_keys="Train.platform_id")
    allocations: Any = relationship("Allocation", back_populates="platform")
