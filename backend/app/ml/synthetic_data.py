"""
Synthetic Historical Platform Occupancy Data Generator.
Notice: All records generated below are labeled synthetic demonstration samples
designed specifically to train and evaluate the Stage 6 Random Forest regression model.
They do not represent real-time railway telemetry, live schedules, or actual platform states.
"""

from datetime import datetime, timedelta
import random
from typing import List, Dict, Any, TypedDict

class TrainPrototype(TypedDict):
    number: str
    name: str
    category: str
    dwell: int
    coaches: int
    pf: int

# Benchmark sample train configurations for synthetic dataset generation
TRAIN_PROTOTYPES: List[TrainPrototype] = [
    {"number": "12627", "name": "Karnataka Express", "category": "SUPERFAST", "dwell": 15, "coaches": 24, "pf": 1},
    {"number": "12186", "name": "Rewanchal Express", "category": "EXPRESS", "dwell": 15, "coaches": 18, "pf": 2},
    {"number": "11072", "name": "Kamayani Express", "category": "EXPRESS", "dwell": 25, "coaches": 20, "pf": 4},
    {"number": "18234", "name": "Narmada Express", "category": "EXPRESS", "dwell": 15, "coaches": 16, "pf": 3},
    {"number": "51828", "name": "Itarsi Passenger", "category": "PASSENGER", "dwell": 45, "coaches": 8, "pf": 6},
    {"number": "12138", "name": "Punjab Mail", "category": "EXPRESS", "dwell": 15, "coaches": 22, "pf": 1},
    {"number": "12412", "name": "Gondwana Express", "category": "SUPERFAST", "dwell": 10, "coaches": 20, "pf": 2},
    {"number": "51829", "name": "Bhopal Shuttle", "category": "PASSENGER", "dwell": 35, "coaches": 10, "pf": 7},
    {"number": "GOODS-4421", "name": "Freight Rake North", "category": "FREIGHT", "dwell": 120, "coaches": 42, "pf": 8},
    {"number": "GOODS-8812", "name": "Coal Rake South", "category": "FREIGHT", "dwell": 150, "coaches": 48, "pf": 8},
    {"number": "12722", "name": "Dakshin Express", "category": "SUPERFAST", "dwell": 15, "coaches": 24, "pf": 1},
    {"number": "12156", "name": "Shan-e-Bhopal Exp", "category": "SUPERFAST", "dwell": 10, "coaches": 22, "pf": 2},
]

def generate_synthetic_history(count: int = 70) -> List[Dict[str, Any]]:
    """Generates synthetic completed platform occupancy records for Random Forest training."""
    # Fixed seed for repeatable, consistent benchmark metrics
    rng = random.Random(42)
    records: List[Dict[str, Any]] = []

    base_time = datetime(2026, 11, 1, 6, 0, 0)

    for i in range(count):
        proto = rng.choice(TRAIN_PROTOTYPES)
        arr_hour = rng.randint(0, 23)
        arr_min = rng.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
        scheduled_arrival = f"{arr_hour:02d}:{arr_min:02d}"

        scheduled_dwell = proto["dwell"]
        dep_total_mins = arr_hour * 60 + arr_min + scheduled_dwell
        dep_hour = (dep_total_mins // 60) % 24
        dep_min = dep_total_mins % 60
        scheduled_departure = f"{dep_hour:02d}:{dep_min:02d}"

        # Category-based realistic delay/variance patterns
        if proto["category"] == "SUPERFAST":
            # Highly punctual with tight dwell; variance between -1 to +5 minutes
            noise = rng.uniform(-1.0, 4.5)
        elif proto["category"] == "EXPRESS":
            # Medium variance between -2 to +8 minutes
            noise = rng.uniform(-1.5, 7.0)
        elif proto["category"] == "PASSENGER":
            # Longer turnaround; variance between -3 to +12 minutes
            noise = rng.uniform(-2.0, 10.0)
        elif proto["category"] == "FREIGHT":
            # Heavy yard operations; variance between -10 to +25 minutes
            noise = rng.uniform(-5.0, 22.0)
        else:
            noise = rng.uniform(-2.0, 5.0)

        # Time-of-day rush hour penalty (17:00-21:00 or 08:00-11:00)
        if (8 <= arr_hour <= 11) or (17 <= arr_hour <= 21):
            noise += rng.uniform(1.0, 3.5)

        # Coach count factor: heavier rakes (>20 coaches) take slightly longer to disembark
        if proto["coaches"] >= 22:
            noise += rng.uniform(0.5, 2.0)

        actual_duration = round(max(5.0, scheduled_dwell + noise), 1)

        day_of_week = rng.randint(0, 6)
        record_date = base_time + timedelta(days=rng.randint(0, 12), hours=arr_hour, minutes=arr_min)
        clearance_date = record_date + timedelta(minutes=actual_duration)

        records.append({
            "id": f"hist-{i+1:03d}",
            "train_id": f"t-demo-{proto['number']}",
            "platform_id": proto["pf"],
            "train_number": proto["number"],
            "train_name": proto["name"],
            "train_category": proto["category"],
            "scheduled_arrival": scheduled_arrival,
            "scheduled_departure": scheduled_departure,
            "scheduled_dwell_minutes": scheduled_dwell,
            "coaches": proto["coaches"],
            "day_of_week": day_of_week,
            "arrival_timestamp": record_date,
            "clearance_timestamp": clearance_date,
            "actual_occupancy_duration": actual_duration,
            "is_synthetic": True,
            "notes": "Synthetic demonstration record for Stage 6 Random Forest training",
            "created_at": record_date,
        })

    return records

