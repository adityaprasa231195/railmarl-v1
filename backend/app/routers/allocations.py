import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.allocation import Allocation
from ..models.platform import Platform
from ..models.train import Train
from ..models.occupancy_history import OccupancyHistory
from ..ml.occupancy_model import occupancy_predictor
from ..schemas.allocation import (
    AllocationOut,
    AllocationCreateRequest,
    RecommendationRequest,
    RecommendationResponse,
)
from ..services.allocation_engine import (
    get_recommendations_for_train,
    check_platform_conflict,
    evaluate_platform,
)

router = APIRouter(prefix="/allocations", tags=["Allocations"])

@router.get("", response_model=List[AllocationOut])
def list_allocations(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (PENDING, RESERVED, ACTIVE, COMPLETED, CANCELLED)"),
    train_id: Optional[str] = Query(None, alias="train_id", description="Filter by train ID"),
    platform_id: Optional[int] = Query(None, alias="platform_id", description="Filter by platform ID"),
    db: Session = Depends(get_db)
):
    """Retrieves platform allocation records with optional filtering."""
    query = db.query(Allocation)

    if status_filter and status_filter.strip().lower() != "all":
        # Case-insensitive comparison to support both upper and legacy demo status
        query = query.filter(Allocation.status.ilike(status_filter.strip()))

    if train_id:
        query = query.filter(Allocation.train_id == train_id)

    if platform_id:
        query = query.filter(Allocation.platform_id == platform_id)

    allocations = query.order_by(Allocation.created_at.desc()).all()
    return [AllocationOut.from_orm_model(a) for a in allocations]

@router.post("/recommend", response_model=RecommendationResponse)
def recommend_platform(payload: RecommendationRequest, db: Session = Depends(get_db)):
    """
    Generates rule-based platform recommendation for a train.
    Evaluates physical rake capacity, route affinity, buffer clearance, and schedule conflicts.
    This is deterministic rule-based automation (not machine learning).
    """
    train = db.query(Train).filter(Train.id == payload.trainId).first()
    if not train:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train with ID '{payload.trainId}' not found"
        )

    buffer_mins = payload.bufferMinutes if payload.bufferMinutes is not None else 15
    try:
        rec_data = get_recommendations_for_train(db, str(train.id), buffer_minutes=buffer_mins)
        # Generate advisory ML occupancy duration prediction (remains purely advisory)
        ml_pred_data = {
            "train_number": str(train.number),
            "train_category": str(train.category),
            "scheduled_arrival": str(train.arrival_time),
            "scheduled_departure": str(train.departure_time),
            "coaches": int(train.coaches),
            "platform_id": rec_data["recommended"]["platformId"] if rec_data.get("recommended") else 1,
            "day_of_week": datetime.now(timezone.utc).weekday(),
        }
        pred_res = occupancy_predictor.predict_occupancy(ml_pred_data)

        # Stage 8: Check for future reservation conflicts using estimated clearance time
        clearance_warning: Optional[str] = None
        if pred_res.get("isModelReady") and rec_data.get("recommended"):
            target_plat_id = rec_data["recommended"]["platformId"]
            other_allocs = db.query(Allocation).filter(
                Allocation.platform_id == target_plat_id,
                Allocation.train_id != str(train.id),
                Allocation.status.in_(["RESERVED", "ACTIVE", "PENDING", "reserved", "active", "pending"])
            ).all()

            arr_mins = occupancy_predictor._parse_time_minutes(str(train.arrival_time))
            dep_mins = occupancy_predictor._parse_time_minutes(str(train.departure_time))
            if dep_mins < arr_mins:
                dep_mins += 1440
            pred_dur = float(pred_res.get("predictedDurationMinutes", 0))
            est_clear_mins = arr_mins + round(pred_dur)

            for other_a in other_allocs:
                other_t = other_a.train
                if not other_t:
                    continue
                o_arr_mins = occupancy_predictor._parse_time_minutes(str(other_t.arrival_time))
                rel_o_arr = o_arr_mins
                if rel_o_arr < arr_mins:
                    rel_o_arr += 1440

                if arr_mins < rel_o_arr < (est_clear_mins + buffer_mins):
                    encroach = (est_clear_mins + buffer_mins) - rel_o_arr
                    clearance_warning = (
                        f"Advisory Conflict Alert: Estimated clearance at {pred_res.get('estimatedClearanceTimeFormatted', pred_res.get('estimatedClearanceTime'))} "
                        f"leaves less than {buffer_mins}m buffer before subsequent Train {other_t.number} "
                        f"({occupancy_predictor.format_time_12h(str(other_t.arrival_time))}) on Platform {target_plat_id} "
                        f"(overlap window ~{encroach}m)."
                    )
                    break

            if not clearance_warning and float(pred_res.get("varianceFromScheduleMinutes", 0)) > 5.0:
                clearance_warning = (
                    f"Advisory Notice: Predicted dwell exceeds schedule by +{pred_res['varianceFromScheduleMinutes']} mins. "
                    f"Monitor Platform {target_plat_id} clearance prior to next scheduled movement."
                )

        rec_data["mlPrediction"] = {
            "isModelReady": pred_res.get("isModelReady", False),
            "predictedDurationMinutes": pred_res.get("predictedDurationMinutes"),
            "scheduledDwellMinutes": pred_res.get("scheduledDwellMinutes"),
            "varianceMinutes": pred_res.get("varianceFromScheduleMinutes"),
            "estimatedClearanceTime": pred_res.get("estimatedClearanceTime"),
            "estimatedClearanceTimeFormatted": pred_res.get("estimatedClearanceTimeFormatted"),
            "scheduledArrivalFormatted": pred_res.get("scheduledArrivalFormatted"),
            "scheduledDepartureFormatted": pred_res.get("scheduledDepartureFormatted"),
            "confidence": pred_res.get("confidence"),
            "advisoryNote": pred_res.get("advisoryNote"),
            "clearanceConflictWarning": clearance_warning,
            "algorithm": pred_res.get("algorithm"),
            "status": pred_res.get("status", "UNTRAINED"),
            "display": pred_res.get("display"),
        }
        return RecommendationResponse(**rec_data)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate platform recommendation: {str(e)}"
        )

@router.get("/{allocation_id}", response_model=AllocationOut)
def get_allocation(allocation_id: str, db: Session = Depends(get_db)):
    """Retrieves a single platform allocation record by its ID."""
    allocation = db.query(Allocation).filter(Allocation.id == allocation_id).first()
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Allocation with ID '{allocation_id}' not found"
        )
    return AllocationOut.from_orm_model(allocation)

@router.post("", response_model=AllocationOut, status_code=status.HTTP_201_CREATED)
def create_allocation(payload: AllocationCreateRequest, db: Session = Depends(get_db)):
    """
    Creates and confirms a platform allocation inside a database transaction.
    Rechecks schedule conflicts to prevent double-booking.
    Synchronizes train and platform statuses.
    """
    # 1. Validate train exists
    train = db.query(Train).filter(Train.id == payload.trainId).first()
    if not train:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Train with ID '{payload.trainId}' not found"
        )

    # 2. Validate platform exists
    platform = db.query(Platform).filter(Platform.id == payload.platformId).first()
    if not platform:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Platform with ID {payload.platformId} not found"
        )

    # 3. Check platform is operational
    if platform.status.upper() in ["OUT_OF_SERVICE", "OUT-OF-SERVICE"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot allocate Platform {platform.id}: Platform is OUT OF SERVICE."
        )

    # 4. Check if train already has a confirmed/active allocation
    existing_confirmed = db.query(Allocation).filter(
        Allocation.train_id == train.id,
        Allocation.status.in_(["RESERVED", "ACTIVE", "reserved", "active"])
    ).first()
    if existing_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Train {train.number} ({train.name}) already has active allocation '{existing_confirmed.id}' on Platform {existing_confirmed.platform_id}."
        )

    buffer_mins = payload.bufferMinutes or 15

    # 5. Check platform conflicts inside transaction
    conflicts = check_platform_conflict(
        db=db,
        platform_id=int(platform.id),
        target_train_id=str(train.id),
        arrival_time=str(train.arrival_time),
        departure_time=str(train.departure_time),
        is_overnight=bool(train.is_overnight),
        buffer_minutes=buffer_mins
    )

    if conflicts:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Schedule conflict on Platform {platform.id}: {'; '.join(conflicts)}"
        )

    # 6. Evaluate platform for scoring and explanation
    eval_result = evaluate_platform(platform, train, conflicts, buffer_minutes=buffer_mins)
    if not eval_result["isAvailable"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Platform {platform.id} is not suitable: {'; '.join(eval_result['conflicts'])}"
        )

    alloc_status = (payload.status or "RESERVED").upper()

    # If there is an existing PENDING allocation for this train, confirm/promote it
    existing_pending = db.query(Allocation).filter(
        Allocation.train_id == train.id,
        Allocation.status.in_(["PENDING", "pending"])
    ).first()

    if existing_pending:
        allocation = existing_pending
        allocation.platform_id = platform.id
        allocation.status = alloc_status
        allocation.score = eval_result["score"]
        allocation.reasons = ", ".join(eval_result["reasons"])
        allocation.conflicts = ""
        allocation.occupancy_start = train.arrival_time
        allocation.occupancy_end = train.departure_time
        if payload.notes:
            allocation.notes = payload.notes
        allocation.updated_at = datetime.now(timezone.utc)
    else:
        alloc_id = f"alloc-{uuid.uuid4().hex[:8]}"
        allocation = Allocation(
            id=alloc_id,
            train_id=train.id,
            platform_id=platform.id,
            status=alloc_status,
            score=eval_result["score"],
            reasons=", ".join(eval_result["reasons"]),
            conflicts="",
            occupancy_start=train.arrival_time,
            occupancy_end=train.departure_time,
            notes=payload.notes,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(allocation)

    # 7. Synchronize Train
    train.platform_id = platform.id
    if train.status.upper() == "SCHEDULED" and alloc_status == "ACTIVE":
        train.status = "ARRIVED"
    train.updated_at = datetime.now(timezone.utc)

    # 8. Synchronize Platform
    platform.status = "OCCUPIED" if train.status.upper() == "ARRIVED" else "RESERVED"
    platform.assigned_train_number = train.number
    platform.assigned_train_name = train.name
    platform.arrival_time = train.arrival_time
    platform.departure_time = train.departure_time
    platform.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(allocation)
    return AllocationOut.from_orm_model(allocation)

@router.post("/{allocation_id}/cancel", response_model=AllocationOut)
def cancel_allocation(allocation_id: str, db: Session = Depends(get_db)):
    """
    Cancels an active or pending platform allocation.
    Releases the platform to AVAILABLE if no other active assignments exist.
    Unassigns the train.
    """
    allocation = db.query(Allocation).filter(Allocation.id == allocation_id).first()
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Allocation with ID '{allocation_id}' not found"
        )

    if allocation.status.upper() in ["CANCELLED", "COMPLETED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allocation '{allocation_id}' is already {allocation.status.upper()}."
        )

    allocation.status = "CANCELLED"
    allocation.updated_at = datetime.now(timezone.utc)

    # Unassign train
    train = allocation.train
    if train and train.platform_id == allocation.platform_id:
        train.platform_id = None
        train.updated_at = datetime.now(timezone.utc)

    # Reset platform if no other active allocations
    platform = allocation.platform
    if platform:
        other_active = db.query(Allocation).filter(
            Allocation.platform_id == platform.id,
            Allocation.id != allocation.id,
            Allocation.status.in_(["PENDING", "RESERVED", "ACTIVE", "pending", "reserved", "active"])
        ).first()

        if not other_active:
            platform.status = "AVAILABLE"
            platform.assigned_train_number = None
            platform.assigned_train_name = None
            platform.arrival_time = None
            platform.departure_time = None
            platform.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(allocation)
    return AllocationOut.from_orm_model(allocation)

@router.post("/{allocation_id}/release", response_model=AllocationOut)
def release_allocation(allocation_id: str, db: Session = Depends(get_db)):
    """
    Releases a platform allocation upon train departure.
    Marks allocation COMPLETED, sets train status to DEPARTED, and resets platform to AVAILABLE.
    """
    allocation = db.query(Allocation).filter(Allocation.id == allocation_id).first()
    if not allocation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Allocation with ID '{allocation_id}' not found"
        )

    if allocation.status.upper() == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot release allocation '{allocation_id}': It is already CANCELLED."
        )

    if allocation.status.upper() == "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Allocation '{allocation_id}' is already COMPLETED."
        )

    allocation.status = "COMPLETED"
    allocation.updated_at = datetime.now(timezone.utc)

    # Update train
    train = allocation.train
    if train:
        train.status = "DEPARTED"
        train.platform_id = None
        train.updated_at = datetime.now(timezone.utc)

    # Reset platform to AVAILABLE
    platform = allocation.platform
    if platform:
        platform.status = "AVAILABLE"
        platform.assigned_train_number = None
        platform.assigned_train_name = None
        platform.arrival_time = None
        platform.departure_time = None
        platform.updated_at = datetime.now(timezone.utc)

    # Record actual platform occupancy history in database
    try:
        arr_ts = allocation.created_at or datetime.now(timezone.utc)
        clr_ts = datetime.now(timezone.utc)
        actual_dur = round(max(2.0, (clr_ts - arr_ts).total_seconds() / 60.0), 1)

        hist_entry = OccupancyHistory(
            id=f"hist-live-{uuid.uuid4().hex[:8]}",
            train_id=allocation.train_id,
            platform_id=allocation.platform_id,
            train_number=train.number if train else "UNKNOWN",
            train_name=train.name if train else "Unknown Train",
            train_category=train.category if train else "EXPRESS",
            scheduled_arrival=train.arrival_time if train else "12:00",
            scheduled_departure=train.departure_time if train else "12:15",
            scheduled_dwell_minutes=15,
            coaches=train.coaches if train else 18,
            day_of_week=clr_ts.weekday(),
            arrival_timestamp=arr_ts,
            clearance_timestamp=clr_ts,
            actual_occupancy_duration=actual_dur,
            is_synthetic=False,
            notes="Live operational clearance event recorded upon platform release",
            created_at=clr_ts,
        )
        db.add(hist_entry)
    except Exception:
        pass

    db.commit()
    db.refresh(allocation)
    return AllocationOut.from_orm_model(allocation)
