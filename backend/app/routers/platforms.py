from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from ..database import get_db
from ..models.platform import Platform
from ..models.allocation import Allocation
from ..models.train import Train
from ..schemas.platform import PlatformOut, PlatformCreate, PlatformUpdate

router = APIRouter(prefix="/platforms", tags=["Platforms"])

@router.get("", response_model=List[PlatformOut])
def list_platforms(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (AVAILABLE, OCCUPIED, RESERVED, OUT_OF_SERVICE)"),
    search: Optional[str] = Query(None, description="Search platform name, number, or assigned train"),
    db: Session = Depends(get_db)
):
    """Retrieves all platform records with optional status and text search filtering."""
    query = db.query(Platform)

    if status_filter and status_filter.lower() != "all":
        clean_status = status_filter.strip().upper().replace("-", "_")
        query = query.filter(func.upper(Platform.status) == clean_status)

    if search and search.strip():
        term = f"%{search.strip()}%"
        # Check if search is numeric to search platform ID directly
        if search.strip().isdigit():
            query = query.filter(
                or_(
                    Platform.id == int(search.strip()),
                    Platform.name.ilike(term),
                    Platform.assigned_train_number.ilike(term),
                    Platform.assigned_train_name.ilike(term),
                )
            )
        else:
            query = query.filter(
                or_(
                    Platform.name.ilike(term),
                    Platform.assigned_train_number.ilike(term),
                    Platform.assigned_train_name.ilike(term),
                    Platform.track_type.ilike(term),
                )
            )

    platforms = query.order_by(Platform.id.asc()).all()
    return [PlatformOut.from_orm_model(p) for p in platforms]

@router.get("/{platform_id}", response_model=PlatformOut)
def get_platform(platform_id: int, db: Session = Depends(get_db)):
    """Retrieves single platform record by its numeric ID."""
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if not platform:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Platform with ID {platform_id} not found"
        )
    return PlatformOut.from_orm_model(platform)

@router.post("", response_model=PlatformOut, status_code=status.HTTP_201_CREATED)
def create_platform(payload: PlatformCreate, db: Session = Depends(get_db)):
    """Creates a new platform. Rejects duplicate platform IDs."""
    existing = db.query(Platform).filter(Platform.id == payload.id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Platform with ID {payload.id} already exists."
        )

    # Check for duplicate name
    duplicate_name = db.query(Platform).filter(func.lower(Platform.name) == payload.name.lower()).first()
    if duplicate_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Platform name '{payload.name}' is already in use by Platform {duplicate_name.id}."
        )

    features_str = ", ".join(payload.features) if payload.features else "Covered"

    new_platform = Platform(
        id=payload.id,
        name=payload.name,
        status=payload.status,
        description=payload.description,
        track_type=payload.type,
        length=payload.length,
        max_coaches=payload.max_coaches,
        features=features_str,
        assigned_train_number=payload.assignedTrain,
        assigned_train_name=payload.trainName,
        arrival_time=payload.arrivalTime,
        departure_time=payload.departureTime,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.add(new_platform)
    db.commit()
    db.refresh(new_platform)
    return PlatformOut.from_orm_model(new_platform)

@router.put("/{platform_id}", response_model=PlatformOut)
def update_platform(platform_id: int, payload: PlatformUpdate, db: Session = Depends(get_db)):
    """Updates an existing platform's details."""
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if not platform:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Platform with ID {platform_id} not found"
        )

    # If updating name, check for duplicate name
    if payload.name is not None and payload.name.lower() != platform.name.lower():
        duplicate_name = db.query(Platform).filter(
            func.lower(Platform.name) == payload.name.lower(),
            Platform.id != platform_id
        ).first()
        if duplicate_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Platform name '{payload.name}' is already in use by Platform {duplicate_name.id}."
            )
        platform.name = payload.name

    if payload.status is not None:
        platform.status = payload.status

    if payload.description is not None:
        platform.description = payload.description

    if payload.type is not None:
        platform.track_type = payload.type

    if payload.length is not None:
        platform.length = payload.length

    if payload.max_coaches is not None:
        platform.max_coaches = payload.max_coaches

    if payload.features is not None:
        platform.features = ", ".join(payload.features)

    if payload.assignedTrain is not None:
        platform.assigned_train_number = payload.assignedTrain if payload.assignedTrain else None

    if payload.trainName is not None:
        platform.assigned_train_name = payload.trainName if payload.trainName else None

    if payload.arrivalTime is not None:
        platform.arrival_time = payload.arrivalTime if payload.arrivalTime else None

    if payload.departureTime is not None:
        platform.departure_time = payload.departureTime if payload.departureTime else None

    platform.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(platform)
    return PlatformOut.from_orm_model(platform)

@router.delete("/{platform_id}", status_code=status.HTTP_200_OK)
def delete_platform(platform_id: int, db: Session = Depends(get_db)):
    """Deletes a platform only when safe (no active allocations or assigned trains)."""
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if not platform:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Platform with ID {platform_id} not found"
        )

    # 1. Prevent deletion when dependent allocations exist
    allocation_count = db.query(Allocation).filter(Allocation.platform_id == platform_id).count()
    if allocation_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete Platform {platform_id}: It has {allocation_count} dependent allocation record(s). Clear dependent allocations first."
        )

    # 2. Prevent deletion when a train is berthed or assigned to the platform
    train_count = db.query(Train).filter(Train.platform_id == platform_id).count()
    if train_count > 0 or platform.assigned_train_number:
        train_ref = platform.assigned_train_name or platform.assigned_train_number or f"{train_count} train(s)"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete Platform {platform_id}: Train '{train_ref}' is currently assigned or berthed on this track."
        )

    db.delete(platform)
    db.commit()
    return {
        "success": True,
        "message": f"Platform {platform_id} ({platform.name}) was deleted successfully.",
        "id": platform_id
    }
