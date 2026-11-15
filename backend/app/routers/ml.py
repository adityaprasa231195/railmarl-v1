import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.occupancy_history import OccupancyHistory, PredictionLog
from ..models.train import Train
from ..schemas.ml import (
    ModelStatusResponse,
    ModelMetricsResponse,
    PredictRequest,
    PredictResponse,
    PredictionHistoryItem,
    TrainModelResponse,
    ActualVsPredictedItem,
    FeatureImportanceItem,
)
from ..ml.occupancy_model import (
    occupancy_predictor,
    MIN_TRAINING_SAMPLES,
    DEFAULT_MODEL_VERSION,
)
from ..ml.synthetic_data import generate_synthetic_history

router = APIRouter(prefix="/ml", tags=["Machine Learning"])

@router.get("/status", response_model=ModelStatusResponse)
def get_model_status(db: Session = Depends(get_db)):
    """Retrieves current Decision Tree clearance model state, training record count, and readiness."""
    total_records = db.query(OccupancyHistory).count()
    synthetic_records = db.query(OccupancyHistory).filter(OccupancyHistory.is_synthetic == True).count()
    real_records = db.query(OccupancyHistory).filter(OccupancyHistory.is_synthetic == False).count()

    if total_records < MIN_TRAINING_SAMPLES:
        curr_status = "INSUFFICIENT_DATA"
    elif occupancy_predictor.is_ready:
        curr_status = "TRAINED"
    else:
        curr_status = "UNTRAINED"

    active_algo = occupancy_predictor.metadata.get(
        "algorithm", "Decision Tree Regression (Scikit-Learn DecisionTreeRegressor)"
    )
    active_version = occupancy_predictor.metadata.get("model_version", DEFAULT_MODEL_VERSION)

    return ModelStatusResponse(
        status=curr_status,
        modelVersion=active_version,
        totalTrainingRecords=total_records,
        syntheticRecords=synthetic_records,
        realRecords=real_records,
        lastTrainedAt=occupancy_predictor.metadata.get("last_trained_at"),
        minSamplesRequired=MIN_TRAINING_SAMPLES,
        algorithm=active_algo,
        isReady=occupancy_predictor.is_ready,
        dataNotice="Training dataset includes clearly labeled synthetic demonstration records for Itarsi Junction testing.",
    )

@router.get("/metrics", response_model=ModelMetricsResponse)
def get_model_metrics():
    """Returns evaluation metrics (MAE, RMSE, R-squared) and actual vs predicted comparisons."""
    if not occupancy_predictor.is_ready:
        return ModelMetricsResponse(
            status="UNTRAINED",
            isReady=False,
            mae=None,
            rmse=None,
            r2Score=None,
            sampleCount=0,
            testSamples=0,
            actualVsPredicted=[],
            featureImportances=[],
            lastTrainedAt=None,
            notes="Model is not yet trained. Use POST /api/ml/train to train on historical occupancy records.",
        )

    meta = occupancy_predictor.metadata
    act_vs_pred = [ActualVsPredictedItem(**item) for item in meta.get("actual_vs_predicted", [])]
    feat_imp = [FeatureImportanceItem(**item) for item in meta.get("feature_importances", [])]
    algo_name = meta.get("algorithm", "DecisionTreeRegressor")

    return ModelMetricsResponse(
        status="TRAINED",
        isReady=True,
        mae=meta.get("mae"),
        rmse=meta.get("rmse"),
        r2Score=meta.get("r2_score"),
        sampleCount=meta.get("sample_count", 0),
        testSamples=meta.get("test_samples", 0),
        actualVsPredicted=act_vs_pred,
        featureImportances=feat_imp,
        lastTrainedAt=meta.get("last_trained_at"),
        notes=f"Evaluated on 80/20 train/test partition using Scikit-Learn {algo_name}.",
    )

@router.post("/train", response_model=TrainModelResponse)
def train_model(
    algorithm: str = Query("DecisionTree", description="Algorithm to train (DecisionTree or RandomForest)"),
    db: Session = Depends(get_db)
):
    """
    Cleans historical records, trains the Decision Tree occupancy regression model,
    calculates MAE and RMSE on test split, and updates saved model artifacts.
    """
    records = db.query(OccupancyHistory).all()
    if len(records) < MIN_TRAINING_SAMPLES:
        return TrainModelResponse(
            success=False,
            status="INSUFFICIENT_DATA",
            message=f"Insufficient Training Data: Requires at least {MIN_TRAINING_SAMPLES} records. Found {len(records)} in database.",
            sampleCount=len(records),
            algorithm=algorithm,
            mae=None,
            rmse=None,
            r2Score=None,
        )

    dict_records = [
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
        for r in records
    ]

    result = occupancy_predictor.train_from_records(dict_records, algorithm=algorithm)
    return TrainModelResponse(**result)

@router.post("/predict", response_model=PredictResponse)
def predict_occupancy(payload: PredictRequest, db: Session = Depends(get_db)):
    """
    Predicts expected platform occupancy duration in minutes.
    Computes expected clearance timestamp without using future information.
    """
    req_dict = payload.model_dump()

    # If trainId is provided, pull real train specs from database
    if payload.trainId:
        train = db.query(Train).filter(Train.id == payload.trainId).first()
        if train:
            req_dict["train_number"] = train.number
            req_dict["train_category"] = train.category
            req_dict["scheduled_arrival"] = train.arrival_time
            req_dict["scheduled_departure"] = train.departure_time
            req_dict["coaches"] = train.coaches
            if train.platform_id:
                req_dict["platform_id"] = train.platform_id

    res = occupancy_predictor.predict_occupancy(req_dict)

    # Log prediction to database
    try:
        log_entry = PredictionLog(
            id=f"pred-{uuid.uuid4().hex[:8]}",
            train_id=payload.trainId,
            platform_id=payload.platformId,
            train_number=res["trainNumber"],
            train_category=res["trainCategory"],
            scheduled_dwell_minutes=res["scheduledDwellMinutes"],
            predicted_duration_minutes=res["predictedDurationMinutes"],
            estimated_clearance_time=res["estimatedClearanceTime"],
            model_version=occupancy_predictor.metadata.get("model_version", DEFAULT_MODEL_VERSION),
            created_at=datetime.now(timezone.utc),
        )
        db.add(log_entry)
        db.commit()
    except Exception as e:
        db.rollback()

    return PredictResponse(**res)

@router.get("/history", response_model=List[PredictionHistoryItem])
def get_prediction_history(
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieves recent platform occupancy predictions made by the ML model."""
    logs = db.query(PredictionLog).order_by(PredictionLog.created_at.desc()).limit(limit).all()
    return [
        PredictionHistoryItem(
            id=str(log.id),
            trainNumber=str(log.train_number),
            trainCategory=str(log.train_category),
            scheduledDwellMinutes=int(log.scheduled_dwell_minutes),
            predictedDurationMinutes=float(log.predicted_duration_minutes),
            estimatedClearanceTime=str(log.estimated_clearance_time),
            estimatedClearanceTimeFormatted=occupancy_predictor.format_time_12h(str(log.estimated_clearance_time)),
            actualDurationMinutes=float(log.actual_duration_minutes) if log.actual_duration_minutes is not None else None,
            modelVersion=str(log.model_version),
            createdAt=log.created_at.isoformat() if log.created_at else "",
        )
        for log in logs
    ]

@router.post("/seed-synthetic")
def seed_synthetic_data(count: int = Query(70, ge=15, le=200), db: Session = Depends(get_db)):
    """Seeds synthetic historical records for ML testing and retrains the model."""
    existing_ids = {r[0] for r in db.query(OccupancyHistory.id).all()}
    synthetic_records = generate_synthetic_history(count=count)
    for h_data in synthetic_records:
        rec_dict = dict(h_data)
        if rec_dict["id"] in existing_ids:
            rec_dict["id"] = f"hist-{uuid.uuid4().hex[:8]}"
        existing_ids.add(rec_dict["id"])
        db.add(OccupancyHistory(**rec_dict))
    db.commit()

    # Retrain model on new synthetic records
    records = db.query(OccupancyHistory).all()
    dict_records = [
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
        for r in records
    ]
    train_res = occupancy_predictor.train_from_records(dict_records, algorithm="DecisionTree")
    return {
        "success": True,
        "message": f"Seeded {len(synthetic_records)} synthetic records.",
        "trainingResult": train_res,
    }
