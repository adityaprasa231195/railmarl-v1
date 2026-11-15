"""
RAILMARL Rule-Based Platform Recommendation Engine.
This is a deterministic, rule-based decision system (not machine learning).
It analyzes scheduled dwell intervals, applies configurable clearance buffers,
verifies physical train rake / platform length constraints, evaluates route &
track-type affinities, and detects schedule conflicts.
"""
from typing import List, Tuple, Optional, Dict, Any
from sqlalchemy.orm import Session
from ..models.platform import Platform
from ..models.train import Train
from ..models.allocation import Allocation

def parse_time_to_minutes(time_str: str) -> int:
    """Parses HH:MM time string to minutes from start of day (0..1439)."""
    parts = time_str.strip().split(":")
    return int(parts[0]) * 60 + int(parts[1])

def minutes_to_time_str(minutes: int) -> str:
    """Formats minutes into HH:MM string (wrapping 24h if needed)."""
    norm = minutes % 1440
    h = norm // 60
    m = norm % 60
    return f"{h:02d}:{m:02d}"

def calculate_intervals(
    arrival_time: str,
    departure_time: str,
    is_overnight: bool = False,
    buffer_minutes: int = 15
) -> Dict[str, Any]:
    """Calculates train dwell window and clearance buffer window in minute offsets."""
    arr_mins = parse_time_to_minutes(arrival_time)
    dep_mins = parse_time_to_minutes(departure_time)

    # If overnight or departure < arrival, offset departure by 24 hours (1440 mins)
    if is_overnight or dep_mins < arr_mins:
        dep_mins += 1440

    buf_start = arr_mins - buffer_minutes
    buf_end = dep_mins + buffer_minutes

    return {
        "arr_mins": arr_mins,
        "dep_mins": dep_mins,
        "buf_start": buf_start,
        "buf_end": buf_end,
        "dwell_window": f"{arrival_time} - {departure_time}",
        "clearance_window": f"{minutes_to_time_str(buf_start)} - {minutes_to_time_str(buf_end)}",
        "buffer_minutes": buffer_minutes
    }

def intervals_overlap(start_a: int, end_a: int, start_b: int, end_b: int) -> bool:
    """Checks whether two intervals [start_a, end_a] and [start_b, end_b] overlap."""
    for offset in [0, 1440, -1440]:
        s_b = start_b + offset
        e_b = end_b + offset
        if max(start_a, s_b) < min(end_a, e_b):
            return True
    return False

def check_platform_conflict(
    db: Session,
    platform_id: int,
    target_train_id: str,
    arrival_time: str,
    departure_time: str,
    is_overnight: bool = False,
    buffer_minutes: int = 15,
    exclude_allocation_id: Optional[str] = None
) -> List[str]:
    """
    Checks for schedule conflicts on the given platform.
    Considers existing active/reserved allocations and assigned trains.
    Returns list of conflict warning messages.
    """
    conflicts: List[str] = []
    target_info = calculate_intervals(arrival_time, departure_time, is_overnight, buffer_minutes)

    # 1. Check existing active or reserved allocations on this platform
    alloc_query = db.query(Allocation).filter(
        Allocation.platform_id == platform_id,
        Allocation.status.in_(["RESERVED", "ACTIVE", "reserved", "active"]),
    )
    if exclude_allocation_id:
        alloc_query = alloc_query.filter(Allocation.id != exclude_allocation_id)

    allocations = alloc_query.all()
    for alloc in allocations:
        if alloc.train_id == target_train_id:
            continue
        other_train = alloc.train
        if not other_train:
            continue
        other_info = calculate_intervals(
            other_train.arrival_time,
            other_train.departure_time,
            other_train.is_overnight,
            buffer_minutes
        )
        if intervals_overlap(target_info["arr_mins"], target_info["dep_mins"], other_info["buf_start"], other_info["buf_end"]) or \
           intervals_overlap(target_info["buf_start"], target_info["buf_end"], other_info["arr_mins"], other_info["dep_mins"]):
            conflicts.append(
                f"Allocation {alloc.id} ({alloc.status.upper()}): Train {other_train.number} ({other_train.name}) "
                f"dwells {other_train.arrival_time} - {other_train.departure_time} (needs {buffer_minutes}m buffer)"
            )

    # 2. Check trains assigned to platform in trains table
    assigned_trains = db.query(Train).filter(
        Train.platform_id == platform_id,
        Train.id != target_train_id,
        Train.status.in_(["SCHEDULED", "APPROACHING", "ARRIVED", "on-time", "delayed", "scheduled", "approaching", "arrived"])
    ).all()
    for tr in assigned_trains:
        if any(tr.number in c for c in conflicts):
            continue
        tr_info = calculate_intervals(tr.arrival_time, tr.departure_time, tr.is_overnight, buffer_minutes)
        if intervals_overlap(target_info["arr_mins"], target_info["dep_mins"], tr_info["buf_start"], tr_info["buf_end"]) or \
           intervals_overlap(target_info["buf_start"], target_info["buf_end"], tr_info["arr_mins"], tr_info["dep_mins"]):
            conflicts.append(
                f"Assigned train {tr.number} ({tr.name}) scheduled {tr.arrival_time} - {tr.departure_time} "
                f"conflicts with required {buffer_minutes}m buffer"
            )

    # 3. Check platform record current berthing details
    platform = db.query(Platform).filter(Platform.id == platform_id).first()
    if platform and platform.assigned_train_number and platform.arrival_time and platform.departure_time:
        if not any(platform.assigned_train_number in c for c in conflicts):
            if not target_train_id or platform.assigned_train_number != target_train_id:
                try:
                    p_info = calculate_intervals(platform.arrival_time, platform.departure_time, False, buffer_minutes)
                    if intervals_overlap(target_info["arr_mins"], target_info["dep_mins"], p_info["buf_start"], p_info["buf_end"]):
                        conflicts.append(
                            f"Occupied track: Train {platform.assigned_train_number} ({platform.assigned_train_name or 'Active'}) "
                            f"occupies platform {platform.arrival_time} - {platform.departure_time}"
                        )
                except Exception:
                    pass

    return conflicts

def evaluate_platform(
    platform: Platform,
    train: Train,
    conflicts: List[str],
    buffer_minutes: int = 15
) -> Dict[str, Any]:
    """
    Evaluates fitness score and explanatory rationale for assigning a platform to a train.
    """
    reasons: List[str] = []
    hard_conflicts = list(conflicts)
    score = 90

    # 1. Out of service check
    is_out_of_service = platform.status.upper() in ["OUT_OF_SERVICE", "OUT-OF-SERVICE"]
    if is_out_of_service:
        return {
            "platformId": platform.id,
            "platformName": platform.name,
            "trackType": platform.track_type,
            "length": platform.length,
            "maxCoaches": platform.max_coaches,
            "score": 0,
            "reasons": [],
            "conflicts": ["Platform is currently OUT OF SERVICE for maintenance"],
            "isAvailable": False
        }

    # 2. Physical coach capacity & length
    coaches = train.coaches or 18
    max_coaches = platform.max_coaches or 20
    rake_length_est = coaches * 24  # standard coach length ~24m
    platform_length = platform.length or 500

    if coaches > max_coaches or rake_length_est > platform_length:
        score -= 45
        hard_conflicts.append(
            f"Train length ({coaches} coaches, ~{rake_length_est}m) exceeds platform limit ({max_coaches} coaches, {platform_length}m)"
        )
    else:
        margin = platform_length - rake_length_est
        reasons.append(
            f"{platform_length}m length comfortably berths {coaches} coaches with {margin}m safety margin"
        )
        if platform_length >= 550 and coaches >= 20:
            score += 5

    # 3. Track type routing compatibility
    category = (train.category or "EXPRESS").upper()
    track_type = (platform.track_type or "Through").title()

    if category == "FREIGHT":
        if track_type == "Goods":
            score += 10
            reasons.append("Dedicated goods loop track with heavy-haul siding and crane access")
        elif track_type == "Bay":
            score -= 50
            hard_conflicts.append("Bay platform cannot accommodate freight rakes")
        else:
            score -= 10
            reasons.append("Secondary through line routing for freight bypass")
    elif category in ["SUPERFAST", "MAIL"]:
        if track_type == "Main":
            score += 8
            reasons.append(f"Main line priority corridor optimal for {category.title()} route")
        elif track_type == "Through":
            score += 3
            reasons.append("Electrified through track suitable for long-distance rake")
        elif track_type == "Bay":
            score -= 35
            hard_conflicts.append("Terminal bay platform is unsuitable for mainline superfast operations")
    elif category == "PASSENGER":
        if track_type == "Bay":
            score += 8
            reasons.append("Terminal bay platform ideal for local passenger origin/turnaround")
        else:
            score += 2
            reasons.append("Operational platform suitable for passenger halt")
    else:
        reasons.append(f"Platform track type ({track_type}) verified for {category} service")

    # 4. Operational state
    curr_status = platform.status.upper()
    if curr_status == "AVAILABLE" and len(hard_conflicts) == 0:
        score += 5
        reasons.append("Platform is currently AVAILABLE with clear approach block")
    elif curr_status in ["RESERVED", "OCCUPIED"] and len(hard_conflicts) == 0:
        reasons.append("Line will clear with adequate clearance buffer prior to arrival")

    # 5. Amenities
    features = [f.strip() for f in (platform.features or "").split(",") if f.strip()]
    if any(feat in ["Covered", "Display Board", "Escalator"] for feat in features):
        reasons.append("Equipped with passenger shelter and coach guidance displays")

    is_available = len(hard_conflicts) == 0
    if not is_available:
        score = max(5, 35 - len(hard_conflicts) * 10)
    else:
        score = max(50, min(99, score))

    return {
        "platformId": platform.id,
        "platformName": platform.name,
        "trackType": platform.track_type,
        "length": platform.length,
        "maxCoaches": platform.max_coaches,
        "score": score,
        "reasons": reasons,
        "conflicts": hard_conflicts,
        "isAvailable": is_available
    }

def get_recommendations_for_train(
    db: Session,
    train_id: str,
    buffer_minutes: int = 15
) -> Dict[str, Any]:
    """
    Executes rule-based platform evaluation for the specified train.
    Returns ranked recommendation and alternatives.
    """
    train = db.query(Train).filter(Train.id == train_id).first()
    if not train:
        raise ValueError(f"Train with ID '{train_id}' not found")

    timing = calculate_intervals(train.arrival_time, train.departure_time, train.is_overnight, buffer_minutes)
    platforms = db.query(Platform).order_by(Platform.id.asc()).all()

    evaluated: List[Dict[str, Any]] = []
    for p in platforms:
        conflicts = check_platform_conflict(
            db=db,
            platform_id=p.id,
            target_train_id=train.id,
            arrival_time=train.arrival_time,
            departure_time=train.departure_time,
            is_overnight=train.is_overnight,
            buffer_minutes=buffer_minutes
        )
        eval_result = evaluate_platform(p, train, conflicts, buffer_minutes)
        evaluated.append(eval_result)

    # Sort: available first, then highest score, then platform id
    evaluated.sort(key=lambda x: (1 if x["isAvailable"] else 0, x["score"]), reverse=True)

    recommended = None
    alternatives = []

    if evaluated and evaluated[0]["isAvailable"]:
        recommended = evaluated[0]
        alternatives = evaluated[1:]
    else:
        alternatives = evaluated

    return {
        "trainId": train.id,
        "trainNumber": train.number,
        "trainName": train.name,
        "category": train.category,
        "coaches": train.coaches,
        "arrivalTime": train.arrival_time,
        "departureTime": train.departure_time,
        "isOvernight": train.is_overnight,
        "occupancyWindow": timing["dwell_window"],
        "clearanceWindow": timing["clearance_window"],
        "bufferMinutes": buffer_minutes,
        "recommended": recommended,
        "alternatives": alternatives
    }
