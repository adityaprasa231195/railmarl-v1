"""
Demonstration Data Seeder for RAILMARL Backend.
Notice: All records below are illustrative demonstration samples for Itarsi Junction (ET).
They do not represent real-time railway telemetry, live schedules, or actual platform states.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
from .models.platform import Platform
from .models.train import Train
from .models.allocation import Allocation
from .models.occupancy_history import OccupancyHistory, PredictionLog
from .ml.synthetic_data import generate_synthetic_history
from .ml.occupancy_model import occupancy_predictor

DEMO_PLATFORMS = [
    {
        "id": 1,
        "name": "Platform 1",
        "status": "OCCUPIED",
        "description": "Primary high-capacity main through line for long-distance express and superfast trains.",
        "track_type": "Main",
        "length": 600,
        "max_coaches": 24,
        "features": "Covered, Display Board, Waiting Room, Escalator",
        "assigned_train_number": "12627",
        "assigned_train_name": "Karnataka Express",
        "arrival_time": "14:30",
        "departure_time": "14:45",
    },
    {
        "id": 2,
        "name": "Platform 2",
        "status": "RESERVED",
        "description": "Main electrified line serving north-south arterial traffic with foot overbridge connectivity.",
        "track_type": "Main",
        "length": 550,
        "max_coaches": 22,
        "features": "Covered, Display Board, Foot Overbridge",
        "assigned_train_number": "12186",
        "assigned_train_name": "Rewanchal Express",
        "arrival_time": "15:10",
        "departure_time": "15:25",
    },
    {
        "id": 3,
        "name": "Platform 3",
        "status": "AVAILABLE",
        "description": "Through line track equipped with digital coach display systems and catering stalls.",
        "track_type": "Through",
        "length": 500,
        "max_coaches": 20,
        "features": "Covered, Display Board, Food Stall",
        "assigned_train_number": None,
        "assigned_train_name": None,
        "arrival_time": None,
        "departure_time": None,
    },
    {
        "id": 4,
        "name": "Platform 4",
        "status": "OCCUPIED",
        "description": "Through line track with passenger waiting sheds, tea stalls, and water dispensers.",
        "track_type": "Through",
        "length": 480,
        "max_coaches": 19,
        "features": "Covered, Tea Stall, Water Booth",
        "assigned_train_number": "11072",
        "assigned_train_name": "Kamayani Express",
        "arrival_time": "13:55",
        "departure_time": "14:20",
    },
    {
        "id": 5,
        "name": "Platform 5",
        "status": "AVAILABLE",
        "description": "Electrified through track handling regional mail and express rakes.",
        "track_type": "Through",
        "length": 520,
        "max_coaches": 21,
        "features": "Covered, Display Board",
        "assigned_train_number": None,
        "assigned_train_name": None,
        "arrival_time": None,
        "departure_time": None,
    },
    {
        "id": 6,
        "name": "Platform 6",
        "status": "RESERVED",
        "description": "Terminal bay platform dedicated to branch line passenger shuttles.",
        "track_type": "Bay",
        "length": 350,
        "max_coaches": 14,
        "features": "Open, Passenger Shed",
        "assigned_train_number": "51828",
        "assigned_train_name": "Itarsi Passenger",
        "arrival_time": "15:45",
        "departure_time": "16:30",
    },
    {
        "id": 7,
        "name": "Platform 7",
        "status": "AVAILABLE",
        "description": "Short-rake bay track suitable for DEMU/MEMU local services and inspection cars.",
        "track_type": "Bay",
        "length": 300,
        "max_coaches": 12,
        "features": "Open, Basic Seating",
        "assigned_train_number": None,
        "assigned_train_name": None,
        "arrival_time": None,
        "departure_time": None,
    },
    {
        "id": 8,
        "name": "Platform 8",
        "status": "OCCUPIED",
        "description": "Heavy-duty yard siding and goods loop track with weighbridge and high-capacity loading crane.",
        "track_type": "Goods",
        "length": 700,
        "max_coaches": 42,
        "features": "Loading Crane, Weighbridge, Floodlights",
        "assigned_train_number": "GOODS-4421",
        "assigned_train_name": "Freight Rake",
        "arrival_time": "12:00",
        "departure_time": "16:00",
    },
]

DEMO_TRAINS = [
    {
        "id": "t1",
        "number": "12627",
        "name": "Karnataka Express",
        "category": "SUPERFAST",
        "origin": "New Delhi",
        "destination": "Bengaluru",
        "arrival_time": "14:30",
        "departure_time": "14:45",
        "is_overnight": False,
        "platform_id": 1,
        "status": "ARRIVED",
        "delay": 0,
        "coaches": 24,
        "priority": "HIGH",
        "description": "Prestigious southern trunk route superfast service berthed on Main track.",
    },
    {
        "id": "t2",
        "number": "12186",
        "name": "Rewanchal Express",
        "category": "EXPRESS",
        "origin": "Rewa",
        "destination": "Mumbai CSMT",
        "arrival_time": "15:10",
        "departure_time": "15:25",
        "is_overnight": False,
        "platform_id": 2,
        "status": "APPROACHING",
        "delay": 0,
        "coaches": 18,
        "priority": "MEDIUM",
        "description": "Overnight connection between Vindhya region and Western Mumbai.",
    },
    {
        "id": "t3",
        "number": "11072",
        "name": "Kamayani Express",
        "category": "EXPRESS",
        "origin": "Varanasi",
        "destination": "Mumbai LTT",
        "arrival_time": "13:55",
        "departure_time": "14:20",
        "is_overnight": False,
        "platform_id": 4,
        "status": "ARRIVED",
        "delay": 12,
        "coaches": 20,
        "priority": "MEDIUM",
        "description": "Daily mail route from eastern UP to central terminals with 12m delay offset.",
    },
    {
        "id": "t4",
        "number": "18234",
        "name": "Narmada Express",
        "category": "EXPRESS",
        "origin": "Indore",
        "destination": "Bilaspur",
        "arrival_time": "16:00",
        "departure_time": "16:15",
        "is_overnight": False,
        "platform_id": None,
        "status": "SCHEDULED",
        "delay": 0,
        "coaches": 16,
        "priority": "MEDIUM",
        "description": "Intercity link traversing Madhya Pradesh river valleys.",
    },
    {
        "id": "t5",
        "number": "51828",
        "name": "Itarsi Passenger",
        "category": "PASSENGER",
        "origin": "Itarsi",
        "destination": "Bhopal",
        "arrival_time": "15:45",
        "departure_time": "16:30",
        "is_overnight": False,
        "platform_id": 6,
        "status": "SCHEDULED",
        "delay": 0,
        "coaches": 8,
        "priority": "LOW",
        "description": "Local branch passenger rake initiating from bay platform 6.",
    },
    {
        "id": "t6",
        "number": "12138",
        "name": "Punjab Mail",
        "category": "EXPRESS",
        "origin": "Firozpur",
        "destination": "Mumbai CSMT",
        "arrival_time": "17:20",
        "departure_time": "17:35",
        "is_overnight": False,
        "platform_id": None,
        "status": "DELAYED",
        "delay": 45,
        "coaches": 22,
        "priority": "HIGH",
        "description": "Historic northern trunk mail train running behind schedule.",
    },
    {
        "id": "t7",
        "number": "12412",
        "name": "Gondwana Express",
        "category": "SUPERFAST",
        "origin": "Nagpur",
        "destination": "Hazrat Nizamuddin",
        "arrival_time": "18:05",
        "departure_time": "18:15",
        "is_overnight": False,
        "platform_id": None,
        "status": "SCHEDULED",
        "delay": 0,
        "coaches": 20,
        "priority": "HIGH",
        "description": "North-South high speed corridor passenger express.",
    },
    {
        "id": "t8",
        "number": "GOODS-4421",
        "name": "Freight Rake",
        "category": "FREIGHT",
        "origin": "Katni",
        "destination": "Mumbai",
        "arrival_time": "12:00",
        "departure_time": "16:00",
        "is_overnight": False,
        "platform_id": 8,
        "status": "ARRIVED",
        "delay": 0,
        "coaches": 42,
        "priority": "LOW",
        "description": "Bulk commodities goods rake stationed on freight loop siding.",
    },
]

DEMO_ALLOCATIONS = [
    {
        "id": "ar-1",
        "train_id": "t4",
        "platform_id": 3,
        "status": "pending",
        "score": 92,
        "reasons": "Available now, 500m fits 16 coaches, No immediate conflicts",
        "conflicts": "",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "id": "ar-2",
        "train_id": "t6",
        "platform_id": 1,
        "status": "pending",
        "score": 88,
        "reasons": "600m fits 22 coaches, Line will clear after departure, Main track for Mail category",
        "conflicts": "Prior train on PF 1 clearing at 14:45",
        "created_at": datetime.now(timezone.utc),
    },
    {
        "id": "ar-3",
        "train_id": "t7",
        "platform_id": 2,
        "status": "pending",
        "score": 95,
        "reasons": "550m fits 20 coaches, Cleared after Rewanchal Exp departure",
        "conflicts": "",
        "created_at": datetime.now(timezone.utc),
    },
]

def ensure_schema_compatibility(db: Session) -> None:
    """Ensures newly added columns exist in the SQLite database."""
    try:
        # Check platforms table
        cursor = db.execute(text("PRAGMA table_info(platforms)"))
        columns_p = [row[1] for row in cursor.fetchall()]
        if "description" not in columns_p:
            db.execute(text("ALTER TABLE platforms ADD COLUMN description TEXT"))
        if "created_at" not in columns_p:
            db.execute(text("ALTER TABLE platforms ADD COLUMN created_at DATETIME"))
        if "updated_at" not in columns_p:
            db.execute(text("ALTER TABLE platforms ADD COLUMN updated_at DATETIME"))

        # Check trains table
        cursor = db.execute(text("PRAGMA table_info(trains)"))
        columns_t = [row[1] for row in cursor.fetchall()]
        if "is_overnight" not in columns_t:
            db.execute(text("ALTER TABLE trains ADD COLUMN is_overnight BOOLEAN DEFAULT 0"))
        if "description" not in columns_t:
            db.execute(text("ALTER TABLE trains ADD COLUMN description TEXT"))
        if "data_source" not in columns_t:
            db.execute(text("ALTER TABLE trains ADD COLUMN data_source VARCHAR(30) DEFAULT 'DEMONSTRATION_DATA'"))
        if "last_synced_at" not in columns_t:
            db.execute(text("ALTER TABLE trains ADD COLUMN last_synced_at DATETIME"))
        if "external_reference" not in columns_t:
            db.execute(text("ALTER TABLE trains ADD COLUMN external_reference VARCHAR(100)"))
        if "created_at" not in columns_t:
            db.execute(text("ALTER TABLE trains ADD COLUMN created_at DATETIME"))
        if "updated_at" not in columns_t:
            db.execute(text("ALTER TABLE trains ADD COLUMN updated_at DATETIME"))

        # Check allocations table
        cursor = db.execute(text("PRAGMA table_info(allocations)"))
        columns_a = [row[1] for row in cursor.fetchall()]
        if "occupancy_start" not in columns_a:
            db.execute(text("ALTER TABLE allocations ADD COLUMN occupancy_start TEXT"))
        if "occupancy_end" not in columns_a:
            db.execute(text("ALTER TABLE allocations ADD COLUMN occupancy_end TEXT"))
        if "notes" not in columns_a:
            db.execute(text("ALTER TABLE allocations ADD COLUMN notes TEXT"))
        if "updated_at" not in columns_a:
            db.execute(text("ALTER TABLE allocations ADD COLUMN updated_at DATETIME"))

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Schema check notice (safe if tables created fresh): {e}")

def seed_database(db: Session) -> None:
    """Populates database with sample demonstration records if empty."""
    ensure_schema_compatibility(db)

    if db.query(Platform).count() == 0:
        for p_data in DEMO_PLATFORMS:
            db.add(Platform(
                **p_data,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            ))
        db.commit()

    if db.query(Train).count() == 0:
        for t_data in DEMO_TRAINS:
            db.add(Train(
                **t_data,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            ))
        db.commit()

    if db.query(Allocation).count() == 0:
        for a_data in DEMO_ALLOCATIONS:
            db.add(Allocation(**a_data))
        db.commit()

    # Seed synthetic historical occupancy records for Stage 6 ML training
    if db.query(OccupancyHistory).count() == 0:
        synthetic_records = generate_synthetic_history(count=70)
        for h_data in synthetic_records:
            db.add(OccupancyHistory(**h_data))
        db.commit()
        print("Seeded 70 synthetic historical platform occupancy records for Stage 6 ML.")

    # Auto-train Random Forest model on seed if not yet trained
    if not occupancy_predictor.is_ready:
        records_query = db.query(OccupancyHistory).all()
        records_dicts = [
            {
                "train_number": r.train_number,
                "train_category": r.train_category,
                "scheduled_arrival": r.scheduled_arrival,
                "scheduled_departure": r.scheduled_departure,
                "day_of_week": r.day_of_week,
                "coaches": r.coaches,
                "platform_id": r.platform_id,
                "actual_occupancy_duration": r.actual_occupancy_duration,
            }
            for r in records_query
        ]
        train_res = occupancy_predictor.train_from_records(records_dicts)
        print(f"ML Model initial training result: {train_res.get('message')}")

if __name__ == "__main__":
    from .database import SessionLocal, Base, engine
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    seed_database(db)
    db.close()
    print("Database seeded successfully with demonstration records.")
