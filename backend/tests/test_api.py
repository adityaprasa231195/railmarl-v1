import uuid
from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.main import app
from backend.app.database import Base, get_db
from backend.app.seed import seed_database
from backend.app.models.platform import Platform
from backend.app.models.train import Train
from backend.app.models.allocation import Allocation
from backend.app.models.occupancy_history import OccupancyHistory, PredictionLog
from backend.app.ml.occupancy_model import MIN_TRAINING_SAMPLES

# Test SQLite in-memory database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_database(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

# ==========================================
# HEALTH & DASHBOARD TESTS
# ==========================================

def test_health_endpoint():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "version" in data

def test_dashboard_summary():
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert data["totalPlatforms"] == 8
    assert data["availablePlatforms"] == 3
    assert data["occupiedPlatforms"] == 3
    assert data["reservedPlatforms"] == 2
    assert data["incomingTrains"] >= 1
    assert "stationName" in data
    assert "timestamp" in data

# ==========================================
# PLATFORM TESTS
# ==========================================

def test_get_platforms():
    response = client.get("/api/platforms")
    assert response.status_code == 200
    platforms = response.json()
    assert len(platforms) == 8
    assert platforms[0]["name"] == "Platform 1"
    assert platforms[0]["status"] == "OCCUPIED"
    assert isinstance(platforms[0]["features"], list)

def test_get_platforms_filtered():
    response = client.get("/api/platforms?status=available")
    assert response.status_code == 200
    platforms = response.json()
    assert len(platforms) == 3
    for p in platforms:
        assert p["status"] == "AVAILABLE"

def test_get_platforms_search():
    response = client.get("/api/platforms?search=Platform 2")
    assert response.status_code == 200
    platforms = response.json()
    assert len(platforms) == 1
    assert platforms[0]["id"] == 2

def test_get_platform_by_id():
    response = client.get("/api/platforms/1")
    assert response.status_code == 200
    platform = response.json()
    assert platform["id"] == 1
    assert platform["name"] == "Platform 1"
    assert "description" in platform

def test_get_platform_not_found():
    response = client.get("/api/platforms/999")
    assert response.status_code == 404
    data = response.json()
    assert data["error"] is True
    assert "not found" in data["message"].lower()

def test_create_platform_success():
    payload = {
        "id": 9,
        "name": "Platform 9",
        "status": "AVAILABLE",
        "description": "Newly constructed suburban loop line",
        "type": "Through",
        "length": 550,
        "max_coaches": 22,
        "features": ["Covered", "Digital Display", "Water Booth"],
    }
    response = client.post("/api/platforms", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["id"] == 9
    assert created["name"] == "Platform 9"
    assert created["status"] == "AVAILABLE"
    assert "createdDate" in created

def test_create_platform_duplicate_id_prevented():
    payload = {
        "id": 1,
        "name": "Platform 1 Duplicate",
        "status": "AVAILABLE",
        "type": "Through",
        "length": 500,
        "max_coaches": 20,
    }
    response = client.post("/api/platforms", json=payload)
    assert response.status_code == 400
    data = response.json()
    assert "already exists" in data["message"].lower()

def test_update_platform_success():
    update_payload = {
        "name": "Platform 3 Extended",
        "status": "OUT_OF_SERVICE",
        "description": "Platform 3 temporarily out of service for platform raising",
        "length": 580,
        "max_coaches": 24,
    }
    response = client.put("/api/platforms/3", json=update_payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Platform 3 Extended"
    assert updated["status"] == "OUT_OF_SERVICE"
    assert updated["length"] == 580

def test_delete_platform_safe_success():
    response = client.delete("/api/platforms/7")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

def test_delete_platform_with_dependent_allocations_prevented():
    response = client.delete("/api/platforms/1")
    assert response.status_code == 400
    data = response.json()
    assert "dependent allocation" in data["message"].lower()

# ==========================================
# STAGE 4: TRAIN MANAGEMENT TESTS
# ==========================================

def test_get_trains():
    response = client.get("/api/trains")
    assert response.status_code == 200
    trains = response.json()
    assert len(trains) == 8
    assert trains[0]["number"] != ""
    # Verify assigned platform information is included
    t1 = next(t for t in trains if t["id"] == "t1")
    assert t1["platform"] == 1
    assert t1["platformName"] == "Platform 1"
    assert t1["platformType"] == "Main"

def test_get_trains_filtered_by_category():
    response = client.get("/api/trains?category=SUPERFAST")
    assert response.status_code == 200
    trains = response.json()
    assert len(trains) == 2
    for t in trains:
        assert t["category"] == "SUPERFAST"

def test_get_trains_filtered_by_status():
    response = client.get("/api/trains?status=ARRIVED")
    assert response.status_code == 200
    trains = response.json()
    assert len(trains) >= 2
    for t in trains:
        assert t["status"] == "ARRIVED"

def test_get_trains_search():
    response = client.get("/api/trains?search=Karnataka")
    assert response.status_code == 200
    trains = response.json()
    assert len(trains) == 1
    assert trains[0]["number"] == "12627"

def test_get_train_by_id():
    response = client.get("/api/trains/t1")
    assert response.status_code == 200
    train = response.json()
    assert train["id"] == "t1"
    assert train["name"] == "Karnataka Express"
    assert train["number"] == "12627"
    assert "description" in train
    assert "createdDate" in train

def test_get_train_by_number():
    response = client.get("/api/trains/12627")
    assert response.status_code == 200
    train = response.json()
    assert train["id"] == "t1"
    assert train["name"] == "Karnataka Express"

def test_get_train_not_found():
    response = client.get("/api/trains/nonexistent-999")
    assert response.status_code == 404
    data = response.json()
    assert data["error"] is True

def test_create_train_success():
    payload = {
        "id": "t-test-1",
        "number": "22188",
        "name": "Bhopal Intercity Express",
        "category": "INTERCITY" if "INTERCITY" in ["EXPRESS"] else "EXPRESS",
        "origin": "Jabalpur",
        "destination": "Habibganj",
        "arrivalTime": "10:15",
        "departureTime": "10:25",
        "isOvernight": False,
        "platform": 3,
        "status": "SCHEDULED",
        "coaches": 18,
        "priority": "MEDIUM",
        "description": "Daily intercity executive connection",
    }
    response = client.post("/api/trains", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["id"] == "t-test-1"
    assert created["number"] == "22188"
    assert created["name"] == "Bhopal Intercity Express"
    assert created["platform"] == 3
    assert created["platformName"] == "Platform 3"
    assert "createdDate" in created

    # Verify persistence
    get_res = client.get("/api/trains/22188")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Bhopal Intercity Express"

def test_create_train_overnight_schedule_success():
    payload = {
        "number": "12853",
        "name": "Amarkantak Express",
        "category": "SUPERFAST",
        "origin": "Durg",
        "destination": "Bhopal",
        "arrivalTime": "23:45",
        "departureTime": "00:15",
        "isOvernight": True,  # Overnight departure next morning
        "status": "SCHEDULED",
        "coaches": 22,
        "priority": "HIGH",
    }
    response = client.post("/api/trains", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["isOvernight"] is True
    assert created["arrivalTime"] == "23:45"
    assert created["departureTime"] == "00:15"

def test_create_train_invalid_schedule_without_overnight_rejected():
    payload = {
        "number": "99999",
        "name": "Invalid Time Train",
        "category": "EXPRESS",
        "origin": "A",
        "destination": "B",
        "arrivalTime": "14:00",
        "departureTime": "13:30",  # earlier than arrival without overnight flag
        "isOvernight": False,
    }
    response = client.post("/api/trains", json=payload)
    assert response.status_code in (400, 422)

def test_create_train_invalid_time_format_rejected():
    payload = {
        "number": "88888",
        "name": "Bad Format Train",
        "category": "EXPRESS",
        "origin": "A",
        "destination": "B",
        "arrivalTime": "25:70",  # Invalid 24-hr time
        "departureTime": "15:00",
    }
    response = client.post("/api/trains", json=payload)
    assert response.status_code in (400, 422)

def test_create_train_duplicate_number_rejected():
    payload = {
        "number": "12627",  # Karnataka Express already exists
        "name": "Karnataka Express Duplicate",
        "category": "SUPERFAST",
        "origin": "New Delhi",
        "destination": "Bengaluru",
        "arrivalTime": "14:30",
        "departureTime": "14:45",
    }
    response = client.post("/api/trains", json=payload)
    assert response.status_code == 400
    assert "already exists" in response.json()["message"].lower()

def test_create_train_nonexistent_platform_rejected():
    payload = {
        "number": "77777",
        "name": "Nonexistent Track Train",
        "category": "EXPRESS",
        "origin": "A",
        "destination": "B",
        "arrivalTime": "11:00",
        "departureTime": "11:20",
        "platform": 9999,  # Does not exist
    }
    response = client.post("/api/trains", json=payload)
    assert response.status_code == 400
    assert "does not exist" in response.json()["message"].lower()

def test_create_train_out_of_service_platform_rejected():
    # Set Platform 5 to OUT_OF_SERVICE
    client.put("/api/platforms/5", json={"status": "OUT_OF_SERVICE"})

    payload = {
        "number": "66666",
        "name": "Train on Disabled Platform",
        "category": "EXPRESS",
        "origin": "A",
        "destination": "B",
        "arrivalTime": "12:00",
        "departureTime": "12:20",
        "platform": 5,  # OUT_OF_SERVICE
    }
    response = client.post("/api/trains", json=payload)
    assert response.status_code == 400
    assert "out_of_service" in response.json()["message"].lower()

def test_update_train_success():
    update_payload = {
        "name": "Karnataka Super Express",
        "status": "DEPARTED",
        "delay": 15,
        "coaches": 24,
        "description": "Departed successfully with 15m delay clearance.",
    }
    response = client.put("/api/trains/t1", json=update_payload)
    assert response.status_code == 200
    updated = response.json()
    assert updated["name"] == "Karnataka Super Express"
    assert updated["status"] == "DEPARTED"
    assert updated["delay"] == 15
    assert updated["description"] == update_payload["description"]
    assert "updatedDate" in updated

def test_update_train_duplicate_number_rejected():
    # Attempt to change t2 number to t1's number
    response = client.put("/api/trains/t2", json={"number": "12627"})
    assert response.status_code == 400
    assert "already used" in response.json()["message"].lower()

def test_update_train_schedule_invalid_rejected():
    response = client.put("/api/trains/t2", json={
        "arrivalTime": "16:00",
        "departureTime": "15:00",
        "isOvernight": False,
    })
    assert response.status_code == 400
    assert "cannot be earlier" in response.json()["message"].lower()

def test_update_train_to_out_of_service_platform_rejected():
    client.put("/api/platforms/5", json={"status": "OUT_OF_SERVICE"})
    response = client.put("/api/trains/t2", json={"platform": 5})
    assert response.status_code == 400
    assert "out_of_service" in response.json()["message"].lower()

def test_delete_train_safe_success():
    # t5 (Itarsi Passenger) has no dependent allocations in demo data
    response = client.delete("/api/trains/t5")
    assert response.status_code == 200
    assert response.json()["success"] is True

    # Verify deleted
    get_res = client.get("/api/trains/t5")
    assert get_res.status_code == 404

def test_delete_train_with_dependent_allocations_prevented():
    # t4 (Narmada Express) is referenced in allocation ar-1
    response = client.delete("/api/trains/t4")
    assert response.status_code == 400
    assert "dependent allocation" in response.json()["message"].lower()

def test_delete_train_not_found():
    response = client.delete("/api/trains/nonexistent-train-id")
    assert response.status_code == 404

# ==========================================
# ALLOCATION & INTEGRATION TESTS
# ==========================================

def test_get_allocations():
    response = client.get("/api/allocations")
    assert response.status_code == 200
    allocations = response.json()
    assert len(allocations) == 3
    assert allocations[0]["status"] == "pending"

def test_empty_database_handling():
    db = TestingSessionLocal()
    db.query(Allocation).delete()
    db.query(Train).delete()
    db.query(Platform).delete()
    db.commit()
    db.close()

    trains_res = client.get("/api/trains")
    assert trains_res.status_code == 200
    assert trains_res.json() == []

    platforms_res = client.get("/api/platforms")
    assert platforms_res.status_code == 200
    assert platforms_res.json() == []

def test_cors_options_preflight():
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/api/trains", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

# ==========================================
# STAGE 5: SMART ALLOCATION & RECOMMENDATION TESTS
# ==========================================

def test_recommend_platform_success():
    # Train t4 (Narmada Express) is unscheduled (platform_id=None, arr=16:00, dep=16:15)
    response = client.post("/api/allocations/recommend", json={"trainId": "t4", "bufferMinutes": 15})
    assert response.status_code == 200
    data = response.json()
    assert data["trainId"] == "t4"
    assert data["trainNumber"] == "18234"
    assert data["occupancyWindow"] == "16:00 - 16:15"
    assert "recommended" in data
    assert data["recommended"] is not None
    assert data["recommended"]["isAvailable"] is True
    assert data["recommended"]["score"] > 60
    assert len(data["recommended"]["reasons"]) > 0
    assert len(data["alternatives"]) > 0

def test_recommend_platform_nonexistent_train():
    response = client.post("/api/allocations/recommend", json={"trainId": "nonexistent-train-999"})
    assert response.status_code == 404

def test_recommend_platform_conflict_detection():
    # Platform 1 has Karnataka Express berthed 14:30 - 14:45.
    # Create a test train overlapping that window on Day 1: 14:35 - 14:50
    db = TestingSessionLocal()
    overlapping_train = Train(
        id="t-overlap-test",
        number="99991",
        name="Overlap Express",
        category="SUPERFAST",
        origin="TestOrigin",
        destination="TestDest",
        arrival_time="14:35",
        departure_time="14:50",
        is_overnight=False,
        platform_id=None,
        status="SCHEDULED",
        coaches=20,
    )
    db.add(overlapping_train)
    db.commit()
    db.close()

    response = client.post("/api/allocations/recommend", json={"trainId": "t-overlap-test", "bufferMinutes": 15})
    assert response.status_code == 200
    data = response.json()
    
    # Check that Platform 1 has conflict listed or is marked unavailable
    pf1 = next((p for p in [data["recommended"]] + data["alternatives"] if p and p["platformId"] == 1), None)
    assert pf1 is not None
    assert pf1["isAvailable"] is False or len(pf1["conflicts"]) > 0

def test_create_allocation_success():
    # Allocate unscheduled Train t4 to available Platform 3
    payload = {
        "trainId": "t4",
        "platformId": 3,
        "status": "RESERVED",
        "notes": "Stage 5 automated test allocation",
        "bufferMinutes": 15
    }
    response = client.post("/api/allocations", json=payload)
    assert response.status_code == 201
    alloc = response.json()
    assert alloc["trainId"] == "t4"
    assert alloc["platformId"] == 3
    assert alloc["status"] == "RESERVED"
    assert len(alloc["reasons"]) > 0

    # Verify Train record updated with assigned platform
    train_res = client.get("/api/trains/t4")
    assert train_res.status_code == 200
    assert train_res.json()["platform"] == 3

    # Verify Platform record updated to RESERVED with assigned train info
    pf_res = client.get("/api/platforms/3")
    assert pf_res.status_code == 200
    assert pf_res.json()["status"] == "RESERVED"
    assert pf_res.json()["assignedTrain"] == "18234"

def test_create_allocation_nonexistent_train_rejected():
    response = client.post("/api/allocations", json={"trainId": "ghost-train", "platformId": 3})
    assert response.status_code == 404

def test_create_allocation_nonexistent_platform_rejected():
    response = client.post("/api/allocations", json={"trainId": "t4", "platformId": 999})
    assert response.status_code == 404

def test_create_allocation_out_of_service_platform_rejected():
    # Mark Platform 5 OUT_OF_SERVICE
    client.put("/api/platforms/5", json={"status": "OUT_OF_SERVICE"})
    
    response = client.post("/api/allocations", json={"trainId": "t4", "platformId": 5})
    assert response.status_code == 400
    assert "OUT OF SERVICE" in response.json()["message"]

def test_create_allocation_conflict_double_booking_rejected():
    # First allocate train t4 to Platform 3 (dwell: 16:00 - 16:15)
    res1 = client.post("/api/allocations", json={"trainId": "t4", "platformId": 3})
    assert res1.status_code == 201

    # Create another train with overlapping schedule (16:05 - 16:20)
    db = TestingSessionLocal()
    train_conflict = Train(
        id="t-conflict-99",
        number="88888",
        name="Conflict Intercity",
        category="EXPRESS",
        origin="Bhopal",
        destination="Nagpur",
        arrival_time="16:05",
        departure_time="16:20",
        is_overnight=False,
        platform_id=None,
        status="SCHEDULED",
        coaches=18,
    )
    db.add(train_conflict)
    db.commit()
    db.close()

    # Attempt to allocate conflicting train to same Platform 3
    res2 = client.post("/api/allocations", json={"trainId": "t-conflict-99", "platformId": 3})
    assert res2.status_code == 409
    assert "conflict" in res2.json()["message"].lower()

def test_cancel_allocation_success():
    # Create allocation for train t4 on Platform 3
    create_res = client.post("/api/allocations", json={"trainId": "t4", "platformId": 3})
    assert create_res.status_code == 201
    alloc_id = create_res.json()["id"]

    # Cancel allocation
    cancel_res = client.post(f"/api/allocations/{alloc_id}/cancel")
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # Verify platform returned to AVAILABLE
    pf_res = client.get("/api/platforms/3")
    assert pf_res.json()["status"] == "AVAILABLE"
    assert pf_res.json()["assignedTrain"] is None

    # Verify train unassigned
    train_res = client.get("/api/trains/t4")
    assert train_res.json()["platform"] is None

def test_cancel_allocation_already_cancelled_rejected():
    create_res = client.post("/api/allocations", json={"trainId": "t4", "platformId": 3})
    alloc_id = create_res.json()["id"]

    client.post(f"/api/allocations/{alloc_id}/cancel")
    # Cancel again
    res = client.post(f"/api/allocations/{alloc_id}/cancel")
    assert res.status_code == 400

def test_release_allocation_success():
    # Create allocation for train t4 on Platform 3
    create_res = client.post("/api/allocations", json={"trainId": "t4", "platformId": 3})
    alloc_id = create_res.json()["id"]

    # Release platform
    release_res = client.post(f"/api/allocations/{alloc_id}/release")
    assert release_res.status_code == 200
    assert release_res.json()["status"] == "COMPLETED"

    # Verify platform returned to AVAILABLE
    pf_res = client.get("/api/platforms/3")
    assert pf_res.json()["status"] == "AVAILABLE"

    # Verify train marked DEPARTED
    train_res = client.get("/api/trains/t4")
    assert train_res.json()["status"] == "DEPARTED"

def test_release_cancelled_allocation_rejected():
    create_res = client.post("/api/allocations", json={"trainId": "t4", "platformId": 3})
    alloc_id = create_res.json()["id"]

    client.post(f"/api/allocations/{alloc_id}/cancel")
    # Cannot release cancelled allocation
    res = client.post(f"/api/allocations/{alloc_id}/release")
    assert res.status_code == 400

def test_release_already_completed_allocation_rejected():
    create_res = client.post("/api/allocations", json={"trainId": "t4", "platformId": 3})
    alloc_id = create_res.json()["id"]

    res1 = client.post(f"/api/allocations/{alloc_id}/release")
    assert res1.status_code == 200

    # Cannot release completed allocation twice
    res2 = client.post(f"/api/allocations/{alloc_id}/release")
    assert res2.status_code == 400

def test_get_allocation_by_id_success():
    res = client.get("/api/allocations/ar-1")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "ar-1"
    assert data["trainId"] == "t4"
    assert data["platformId"] == 3

def test_get_allocation_by_id_not_found():
    res = client.get("/api/allocations/nonexistent-alloc-xyz")
    assert res.status_code == 404

def test_list_allocations_filtered_by_status():
    res = client.get("/api/allocations?status=pending")
    assert res.status_code == 200
    data = res.json()
    assert len(data) >= 1
    for item in data:
        assert item["status"].lower() == "pending"

def test_buffer_clearance_calculation_and_recommendation_ranking():
    # Test recommendation ranking with different buffer minutes
    res_15 = client.post("/api/allocations/recommend", json={"trainId": "t4", "bufferMinutes": 15})
    assert res_15.status_code == 200
    data_15 = res_15.json()
    assert data_15["bufferMinutes"] == 15
    assert data_15["clearanceWindow"] == "15:45 - 16:30"

    res_30 = client.post("/api/allocations/recommend", json={"trainId": "t4", "bufferMinutes": 30})
    assert res_30.status_code == 200
    data_30 = res_30.json()
    assert data_30["bufferMinutes"] == 30
    assert data_30["clearanceWindow"] == "15:30 - 16:45"

# ==========================================
# STAGE 6: MACHINE LEARNING & PREDICTION TESTS
# ==========================================

def test_ml_status_endpoint():
    response = client.get("/api/ml/status")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["TRAINED", "UNTRAINED", "INSUFFICIENT_DATA"]
    assert "algorithm" in data
    assert ("Decision Tree" in data["algorithm"] or "Random Forest" in data["algorithm"])
    assert data["totalTrainingRecords"] >= MIN_TRAINING_SAMPLES
    assert data["syntheticRecords"] >= 1
    assert data["isReady"] is True

def test_ml_metrics_endpoint():
    response = client.get("/api/ml/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["isReady"] is True
    assert data["mae"] is not None
    assert data["mae"] > 0
    assert data["rmse"] is not None
    assert data["rmse"] >= data["mae"]
    assert len(data["actualVsPredicted"]) > 0
    assert len(data["featureImportances"]) > 0

def test_ml_train_endpoint():
    response = client.post("/api/ml/train")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "TRAINED"
    assert data["sampleCount"] >= MIN_TRAINING_SAMPLES
    assert data["mae"] is not None
    assert data["rmse"] is not None

def test_ml_predict_endpoint_custom_payload():
    payload = {
        "trainNumber": "12627",
        "trainCategory": "SUPERFAST",
        "scheduledArrival": "14:30",
        "scheduledDeparture": "14:45",
        "coaches": 24,
        "platformId": 1,
        "dayOfWeek": 2,
    }
    response = client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["trainNumber"] == "12627"
    assert data["trainCategory"] == "SUPERFAST"
    assert data["scheduledDwellMinutes"] == 15
    assert data["predictedDurationMinutes"] > 0
    assert len(data["estimatedClearanceTime"]) == 5  # "HH:MM"
    assert data["isModelReady"] is True
    assert len(data["advisoryNote"]) > 0

def test_ml_predict_endpoint_by_train_id():
    payload = {
        "trainId": "t4",
        "platformId": 3,
    }
    response = client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["trainNumber"] == "18234"
    assert data["trainCategory"] == "EXPRESS"
    assert data["scheduledDwellMinutes"] == 15
    assert data["predictedDurationMinutes"] > 0

def test_ml_prediction_history_logging():
    pred_res = client.post("/api/ml/predict", json={
        "trainNumber": "99999",
        "trainCategory": "EXPRESS",
        "scheduledArrival": "10:00",
        "scheduledDeparture": "10:20",
    })
    assert pred_res.status_code == 200

    hist_res = client.get("/api/ml/history?limit=10")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 1
    recent = history[0]
    assert recent["trainNumber"] == "99999"
    assert recent["predictedDurationMinutes"] > 0

def test_smart_allocation_advisory_ml_integration():
    rec_res = client.post("/api/allocations/recommend", json={"trainId": "t4", "bufferMinutes": 15})
    assert rec_res.status_code == 200
    data = rec_res.json()

    # Rule-based allocation remains primary
    assert data["recommended"] is not None
    assert data["recommended"]["isAvailable"] is True

    # Advisory ML prediction is included
    assert "mlPrediction" in data
    ml_pred = data["mlPrediction"]
    assert ml_pred["isModelReady"] is True
    assert ml_pred["predictedDurationMinutes"] > 0
    assert ml_pred["estimatedClearanceTime"] is not None
    assert "advisory" in ml_pred["advisoryNote"].lower()

def test_insufficient_data_handling():
    db = TestingSessionLocal()
    db.query(OccupancyHistory).delete()
    db.commit()
    db.close()

    train_res = client.post("/api/ml/train")
    assert train_res.status_code == 200
    data = train_res.json()
    assert data["success"] is False
    assert data["status"] == "INSUFFICIENT_DATA"
    assert "Insufficient Training Data" in data["message"]

# ==========================================
# STAGE 7: EXTERNAL RAILWAY API TESTS
# ==========================================

def test_railway_api_status_endpoint():
    response = client.get("/api/railway-api/status")
    assert response.status_code == 200
    data = response.json()
    assert "provider" in data
    assert "stationCode" in data
    assert data["stationCode"] == "ET"
    assert "isOfflineFallback" in data
    assert "cacheEntries" in data

def test_railway_api_test_connection_endpoint():
    response = client.post("/api/railway-api/test-connection")
    assert response.status_code == 200
    data = response.json()
    assert "isConnected" in data
    assert "provider" in data
    assert "message" in data

def test_railway_api_search_known_train():
    response = client.get("/api/railway-api/search?query=12627")
    assert response.status_code == 200
    data = response.json()
    assert data["totalResults"] >= 1
    assert data["stationCode"] == "ET"
    train = data["results"][0]
    assert train["trainNumber"] == "12627"
    assert train["trainName"] == "Karnataka Express"
    assert train["arrivalTime"] == "14:30"
    assert train["departureTime"] == "14:45"
    assert train["dataSource"] == "EXTERNAL_API"

def test_railway_api_search_empty_query_rejected():
    response = client.get("/api/railway-api/search?query=%20")
    assert response.status_code == 400

def test_railway_api_search_offline_synthetic_generation():
    response = client.get("/api/railway-api/search?query=12999")
    assert response.status_code == 200
    data = response.json()
    assert data["totalResults"] >= 1
    train = data["results"][0]
    assert train["trainNumber"] == "12999"
    assert train["stationCode"] == "ET"
    assert ":" in train["arrivalTime"]
    assert ":" in train["departureTime"]

def test_railway_api_live_status():
    response = client.get("/api/railway-api/live-status?train_number=12627")
    assert response.status_code == 200
    data = response.json()
    assert data["trainNumber"] == "12627"
    assert "delayMinutes" in data
    assert "currentStation" in data
    assert "statusSummary" in data

def test_railway_api_import_new_train_success():
    import_payload = {
        "trains": [{
            "trainNumber": "22692",
            "trainName": "Bengaluru Rajdhani Express",
            "category": "SUPERFAST",
            "origin": "Hazrat Nizamuddin (NZM)",
            "destination": "KSR Bengaluru (SBC)",
            "arrivalTime": "03:50",
            "departureTime": "04:00",
            "isOvernight": False,
            "dwellMinutes": 10,
            "coaches": 22,
            "stationCode": "ET",
            "stationName": "Itarsi Junction",
            "runsOnDays": ["Daily"],
            "provider": "Offline Demonstration Adapter (Itarsi ET)",
            "dataSource": "EXTERNAL_API",
            "lastUpdated": "2026-11-15T00:00:00",
        }],
        "overwriteExisting": False
    }
    response = client.post("/api/railway-api/import", json=import_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["importedCount"] == 1
    assert data["results"][0]["status"] == "IMPORTED"

    # Verify train exists in database with EXTERNAL_API data source
    train_check = client.get("/api/trains/t-ext-22692")
    assert train_check.status_code == 200
    t_data = train_check.json()
    assert t_data["number"] == "22692"
    assert t_data["dataSource"] == "EXTERNAL_API"
    assert t_data["platform"] is None  # Never automatically overrides platform allocations

def test_railway_api_import_duplicate_prevention():
    import_payload = {
        "trains": [{
            "trainNumber": "12627",
            "trainName": "Karnataka Express",
            "category": "SUPERFAST",
            "origin": "Bengaluru (SBC)",
            "destination": "New Delhi (NDLS)",
            "arrivalTime": "14:30",
            "departureTime": "14:45",
            "isOvernight": False,
            "dwellMinutes": 15,
            "coaches": 24,
            "stationCode": "ET",
            "stationName": "Itarsi Junction",
            "runsOnDays": ["Daily"],
            "provider": "Offline Demonstration Adapter (Itarsi ET)",
            "dataSource": "EXTERNAL_API",
            "lastUpdated": "2026-11-15T00:00:00",
        }],
        "overwriteExisting": False
    }
    response = client.post("/api/railway-api/import", json=import_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["skippedCount"] == 1
    assert data["results"][0]["status"] in ("SKIPPED_EXISTING", "PRESERVED_MANUAL")

def test_railway_api_import_overwrite_allowed():
    import_payload = {
        "trains": [{
            "trainNumber": "12627",
            "trainName": "Karnataka Express Updated",
            "category": "SUPERFAST",
            "origin": "Bengaluru City",
            "destination": "New Delhi Main",
            "arrivalTime": "14:30",
            "departureTime": "14:45",
            "isOvernight": False,
            "dwellMinutes": 15,
            "coaches": 24,
            "stationCode": "ET",
            "stationName": "Itarsi Junction",
            "runsOnDays": ["Daily"],
            "provider": "Offline Demonstration Adapter (Itarsi ET)",
            "dataSource": "EXTERNAL_API",
            "lastUpdated": "2026-11-15T00:00:00",
        }],
        "overwriteExisting": True
    }
    response = client.post("/api/railway-api/import", json=import_payload)
    assert response.status_code == 200
    data = response.json()
    assert data["updatedCount"] == 1
    assert data["results"][0]["status"] == "UPDATED"

def test_railway_api_cache_clear_endpoint():
    response = client.delete("/api/railway-api/cache")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "clearedEntries" in data


# ==========================================
# STAGE 8: SMART PLATFORM CLEARANCE PREDICTOR TESTS
# ==========================================

def test_stage8_decision_tree_training():
    """Verify DecisionTreeRegressor trains successfully and updates model status."""
    # Ensure sufficient training data is present
    client.post("/api/ml/seed-synthetic?count=70")

    response = client.post("/api/ml/train?algorithm=DecisionTree")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["status"] == "TRAINED"
    assert data["sampleCount"] >= 15
    assert data["mae"] is not None
    assert data["rmse"] is not None
    assert "Decision Tree" in data["algorithm"]

    # Verify status endpoint reflects DecisionTree
    status_res = client.get("/api/ml/status")
    assert status_res.status_code == 200
    s_data = status_res.json()
    assert s_data["isReady"] is True
    assert "Decision Tree" in s_data["algorithm"]


def test_stage8_clearance_prediction_format():
    """
    Verify Stage 8 clearance prediction format:
    Train ID, Scheduled arrival, Scheduled departure, Predicted occupancy, Estimated clearance (12h format).
    """
    payload = {
        "trainNumber": "SIM-001",
        "trainCategory": "EXPRESS",
        "scheduledArrival": "10:30",
        "scheduledDeparture": "10:45",
        "coaches": 18,
        "platformId": 1,
    }
    response = client.post("/api/ml/predict", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["trainNumber"] == "SIM-001"
    assert data["scheduledArrival"] == "10:30"
    assert data["scheduledDeparture"] == "10:45"
    assert data["scheduledArrivalFormatted"] == "10:30 AM"
    assert data["scheduledDepartureFormatted"] == "10:45 AM"
    assert data["predictedDurationMinutes"] > 0
    assert len(data["estimatedClearanceTime"]) == 5  # "HH:MM"
    assert "AM" in data["estimatedClearanceTimeFormatted"] or "PM" in data["estimatedClearanceTimeFormatted"]

    # Check illustrative display dict format
    display = data["display"]
    assert display is not None
    assert display["train"] == "SIM-001"
    assert display["scheduledArrival"] == "10:30 AM"
    assert display["scheduledDeparture"] == "10:45 AM"
    assert "minutes" in display["predictedOccupancy"]
    assert "AM" in display["estimatedClearance"] or "PM" in display["estimatedClearance"]


def test_stage8_smart_allocation_clearance_and_conflict_warning():
    """
    Verify Smart Allocation incorporates advisory clearance prediction and generates
    clearance conflict warnings without overriding rule-based platform safety.
    """
    # Recommend platform for train t4 (Bhopal Express)
    response = client.post("/api/allocations/recommend", json={"trainId": "t4", "bufferMinutes": 15})
    assert response.status_code == 200
    data = response.json()

    # Rule-based safety remains primary
    assert data["recommended"] is not None
    assert data["recommended"]["isAvailable"] is True

    # ML clearance advisory is attached
    assert "mlPrediction" in data
    ml_pred = data["mlPrediction"]
    assert ml_pred["isModelReady"] is True
    assert ml_pred["predictedDurationMinutes"] > 0
    assert ml_pred["estimatedClearanceTimeFormatted"] is not None
    assert ml_pred["scheduledArrivalFormatted"] is not None
    assert ml_pred["scheduledDepartureFormatted"] is not None
    assert "advisory" in ml_pred["advisoryNote"].lower()


def test_stage8_retraining_with_new_historical_records():
    """Verify retraining updates sample count and model metadata when new records are added."""
    db = TestingSessionLocal()
    initial_count = db.query(OccupancyHistory).count()

    now = datetime.now(timezone.utc)
    new_record = OccupancyHistory(
        id=f"hist-test-{uuid.uuid4().hex[:6]}",
        train_number="TEST-888",
        train_name="Test Special Express",
        train_category="EXPRESS",
        scheduled_arrival="08:00",
        scheduled_departure="08:15",
        scheduled_dwell_minutes=15,
        day_of_week=3,
        coaches=20,
        platform_id=2,
        arrival_timestamp=now,
        clearance_timestamp=now + timedelta(minutes=20),
        actual_occupancy_duration=20.0,
        is_synthetic=True,
    )
    db.add(new_record)
    db.commit()
    db.close()

    train_res = client.post("/api/ml/train?algorithm=DecisionTree")
    assert train_res.status_code == 200
    t_data = train_res.json()
    assert t_data["success"] is True
    assert t_data["sampleCount"] == initial_count + 1


def test_stage8_prediction_history_contains_clearance_times():
    """Verify prediction history records clearance timestamps and 12-hour formatted strings."""
    pred_res = client.post("/api/ml/predict", json={
        "trainNumber": "12627",
        "trainCategory": "SUPERFAST",
        "scheduledArrival": "14:30",
        "scheduledDeparture": "14:45",
    })
    assert pred_res.status_code == 200

    hist_res = client.get("/api/ml/history?limit=5")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 1
    item = history[0]
    assert "estimatedClearanceTime" in item
    assert "estimatedClearanceTimeFormatted" in item


# ==========================================
# STAGE 9: RAILWAY TRAFFIC MANAGEMENT TESTS
# ==========================================

def test_traffic_overview_endpoint():
    """Verify traffic overview endpoint returns summary KPIs, busy periods, and 24-hour density."""
    response = client.get("/api/traffic/overview")
    assert response.status_code == 200
    data = response.json()

    assert "summary" in data
    summary = data["summary"]
    assert summary["incomingTrains"] >= 0
    assert summary["departingTrains"] >= 0
    assert summary["platformOccupancyPercent"] >= 0.0
    assert summary["stationCongestionLevel"] in ("LOW", "MODERATE", "HIGH")
    assert "activeProvider" in summary
    assert "dataFreshnessNotice" in summary

    # Verify 24-hour hourly density list
    assert "hourlyDensity" in data
    assert len(data["hourlyDensity"]) == 24
    first_hour = data["hourlyDensity"][0]
    assert first_hour["hour"] == "00:00"
    assert "totalMovements" in first_hour

    # Verify busy periods
    assert "busyPeriods" in data
    assert len(data["busyPeriods"]) >= 1
    assert "congestionNotice" in data


def test_traffic_arrivals_endpoint():
    """Verify traffic arrivals board returns incoming trains with delays and status."""
    response = client.get("/api/traffic/arrivals")
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert data["total"] >= 1
    assert "arrivals" in data
    first_train = data["arrivals"][0]
    assert "trainNumber" in first_train
    assert "scheduledTime" in first_train
    assert "expectedTime" in first_train
    assert "delayMinutes" in first_train
    assert "status" in first_train
    assert "dataSource" in first_train


def test_traffic_departures_endpoint():
    """Verify traffic departures board returns departing trains with status."""
    response = client.get("/api/traffic/departures")
    assert response.status_code == 200
    data = response.json()

    assert "total" in data
    assert data["total"] >= 1
    assert "departures" in data
    first_train = data["departures"][0]
    assert "trainNumber" in first_train
    assert "scheduledTime" in first_train
    assert "expectedTime" in first_train


def test_traffic_queue_endpoint_and_prioritization():
    """
    Verify traffic queue management endpoint ranks pending platform requests
    using category weights, delay urgency, and arrival proximity with clear reasons.
    """
    # Create an unassigned test superfast train with delay to test queue ranking
    db = TestingSessionLocal()
    unassigned_id = f"t-queue-{uuid.uuid4().hex[:6]}"
    unassigned_train = Train(
        id=unassigned_id,
        number="12001",
        name="Shatabdi Express Test",
        category="SUPERFAST",
        origin="New Delhi (NDLS)",
        destination="Habibganj (RKMP)",
        arrival_time="11:30",
        departure_time="11:45",
        is_overnight=False,
        platform_id=None,  # Pending platform allocation
        status="SCHEDULED",
        delay=12,
        coaches=24,
        priority="HIGH",
        data_source="EXTERNAL_API",
    )
    db.add(unassigned_train)
    db.commit()
    db.close()

    response = client.get("/api/traffic/queue")
    assert response.status_code == 200
    data = response.json()

    assert data["totalInQueue"] >= 1
    queue = data["queue"]
    assert len(queue) >= 1

    # Verify queue prioritization fields and reasons
    top_item = queue[0]
    assert "queuePosition" in top_item
    assert top_item["queuePosition"] == 1
    assert top_item["priorityScore"] >= 0
    assert top_item["priorityLevel"] in ("URGENT", "HIGH", "MEDIUM", "LOW")
    assert len(top_item["priorityReason"]) > 0

    # Ensure queue is sorted in descending priority score order
    for idx in range(len(queue) - 1):
        assert queue[idx]["priorityScore"] >= queue[idx + 1]["priorityScore"]


def test_traffic_conflicts_detection():
    """Verify platform schedule conflict detection returns overlap details and suggested actions."""
    response = client.get("/api/traffic/conflicts")
    assert response.status_code == 200
    data = response.json()

    assert "totalConflicts" in data
    assert "conflicts" in data
    if data["totalConflicts"] > 0:
        c = data["conflicts"][0]
        assert "conflictId" in c
        assert "platformId" in c
        assert "severity" in c
        assert c["severity"] in ("HIGH", "MEDIUM")
        assert "overlapMinutes" in c
        assert "description" in c
        assert "suggestedAction" in c


def test_traffic_sync_telemetry_endpoint():
    """Verify manual telemetry synchronization endpoint updates timestamps and returns status."""
    response = client.post("/api/traffic/sync")
    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "provider" in data
    assert "syncedTrainsCount" in data
    assert data["syncedTrainsCount"] >= 0
    assert "timestamp" in data
    assert "message" in data


def test_traffic_offline_fallback_resilience():
    """Verify that traffic overview operates seamlessly with offline demonstration fallback."""
    response = client.get("/api/traffic/overview")
    assert response.status_code == 200
    data = response.json()
    summary = data["summary"]
    assert summary["incomingTrains"] >= 1
    assert summary["departingTrains"] >= 1






