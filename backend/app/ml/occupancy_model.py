"""
RAILMARL — Smart Platform Clearance Predictor (Machine Learning Model).
Stage 8: DecisionTreeRegressor for Platform Clearance Duration Prediction at Itarsi Junction.

Predicts how many minutes a train is expected to occupy a platform based on
scheduled timetable dwell, category, coach count, day of week, time of day slot,
and target platform track parameters.

Uses Scikit-learn DecisionTreeRegressor with Joblib persistence. Reuses Stage 6
pipeline architecture without duplicate models.
Zero future leakage: Never uses actual clearance time or future information as model input.
"""

import os
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, List, Optional

import joblib
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.tree import DecisionTreeRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder

logger = logging.getLogger("railmarl.ml")

# Paths for saving model and metadata
CURRENT_DIR = Path(__file__).resolve().parent
SAVED_MODELS_DIR = CURRENT_DIR / "saved_models"
MODEL_PATH = SAVED_MODELS_DIR / "occupancy_dt.joblib"
LEGACY_MODEL_PATH = SAVED_MODELS_DIR / "occupancy_rf.joblib"
METADATA_PATH = SAVED_MODELS_DIR / "model_metadata.json"

MIN_TRAINING_SAMPLES = 15
DEFAULT_MODEL_VERSION = "dt-regressor-v2.0"
CATEGORIES = ["SUPERFAST", "EXPRESS", "PASSENGER", "FREIGHT", "OTHER"]


class OccupancyPredictor:
    """
    Manages training, persistence, evaluation, and inference for the
    DecisionTree platform clearance occupancy model.
    """

    def __init__(self):
        self.model: Optional[Pipeline] = None
        self.metadata: Dict[str, Any] = {}
        self._load_saved_model()

    def _load_saved_model(self) -> None:
        """Loads model and metadata from disk if available."""
        target_model_path = MODEL_PATH if MODEL_PATH.exists() else LEGACY_MODEL_PATH
        if target_model_path.exists() and METADATA_PATH.exists():
            try:
                self.model = joblib.load(target_model_path)
                with open(METADATA_PATH, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                logger.info(
                    f"Loaded existing ML model version {self.metadata.get('model_version')} "
                    f"({self.metadata.get('algorithm')})"
                )
            except Exception as e:
                logger.warning(f"Could not load saved model: {e}")
                self.model = None
                self.metadata = {}

    @property
    def is_ready(self) -> bool:
        return self.model is not None and bool(self.metadata.get("is_ready", False))

    @staticmethod
    def _parse_time_minutes(time_str: str) -> int:
        """Converts HH:MM to minute offset from midnight."""
        parts = time_str.strip().split(":")
        return int(parts[0]) * 60 + int(parts[1])

    @staticmethod
    def _minutes_to_time_str(total_minutes: int) -> str:
        """Converts minute offset back to HH:MM format (wrapped in 24h)."""
        norm = total_minutes % 1440
        h = norm // 60
        m = norm % 60
        return f"{h:02d}:{m:02d}"

    @staticmethod
    def format_time_12h(time_str: str) -> str:
        """Formats HH:MM string to 12-hour AM/PM format (e.g. '10:30' -> '10:30 AM')."""
        try:
            parts = time_str.strip().split(":")
            h = int(parts[0]) % 24
            m = int(parts[1])
            suffix = "AM" if h < 12 else "PM"
            h12 = h % 12
            if h12 == 0:
                h12 = 12
            return f"{h12:02d}:{m:02d} {suffix}"
        except Exception:
            return time_str

    @classmethod
    def extract_features_from_dict(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extracts valid model input features from a raw record.
        Strict rule: Do not use actual clearance time or future information as input.
        """
        arr_str = str(data.get("scheduled_arrival") or data.get("scheduledArrival") or "12:00")
        dep_str = str(data.get("scheduled_departure") or data.get("scheduledDeparture") or "12:15")

        arr_mins = cls._parse_time_minutes(arr_str)
        dep_mins = cls._parse_time_minutes(dep_str)
        if dep_mins < arr_mins:
            dep_mins += 1440  # overnight dwell
        dwell_mins = max(2, dep_mins - arr_mins)

        arr_hour = arr_mins // 60
        arr_minute = arr_mins % 60

        # Time of day slot: 0=Night (0-6), 1=Morning (6-12), 2=Afternoon (12-17), 3=Evening (17-24)
        if 0 <= arr_hour < 6:
            time_slot = 0
        elif 6 <= arr_hour < 12:
            time_slot = 1
        elif 12 <= arr_hour < 17:
            time_slot = 2
        else:
            time_slot = 3

        category = str(
            data.get("train_category") or data.get("category") or data.get("trainCategory") or "EXPRESS"
        ).upper()
        if category not in CATEGORIES:
            category = "OTHER"

        return {
            "train_category": category,
            "scheduled_dwell_minutes": dwell_mins,
            "arrival_hour": arr_hour,
            "arrival_minute": arr_minute,
            "time_of_day_slot": time_slot,
            "day_of_week": int(data.get("day_of_week") or data.get("dayOfWeek") or datetime.now(timezone.utc).weekday()),
            "coaches": int(data.get("coaches") or 18),
            "platform_id": int(data.get("platform_id") or data.get("platformId") or 1),
        }

    def train_from_records(
        self,
        records: List[Dict[str, Any]],
        algorithm: str = "DecisionTree"
    ) -> Dict[str, Any]:
        """
        Cleans data, builds feature matrix, splits train/test, trains DecisionTreeRegressor
        (or RandomForestRegressor), evaluates MAE & RMSE, and saves model artifacts.
        """
        if len(records) < MIN_TRAINING_SAMPLES:
            return {
                "success": False,
                "status": "INSUFFICIENT_DATA",
                "message": f"Insufficient Training Data: Requires at least {MIN_TRAINING_SAMPLES} records to train. Found {len(records)}.",
                "sampleCount": len(records),
                "algorithm": algorithm,
            }

        # Build feature DataFrame and target array
        feature_rows: List[Dict[str, Any]] = []
        target_values: List[float] = []
        raw_items_for_eval: List[Dict[str, Any]] = []

        for r in records:
            actual = r.get("actual_occupancy_duration") or r.get("actualDurationMinutes")
            if actual is None or float(actual) <= 0:
                continue
            feats = self.extract_features_from_dict(r)
            feature_rows.append(feats)
            target_values.append(float(actual))
            raw_items_for_eval.append({
                "train_number": str(r.get("train_number") or r.get("trainNumber") or "TRAIN"),
                "train_category": feats["train_category"],
                "scheduled_dwell": feats["scheduled_dwell_minutes"],
                "actual": float(actual),
            })

        if len(feature_rows) < MIN_TRAINING_SAMPLES:
            return {
                "success": False,
                "status": "INSUFFICIENT_DATA",
                "message": f"Valid training records with non-zero durations was {len(feature_rows)}, below required {MIN_TRAINING_SAMPLES}.",
                "sampleCount": len(feature_rows),
                "algorithm": algorithm,
            }

        X = pd.DataFrame(feature_rows)
        y = np.array(target_values)

        # Train / Test Split (80% train, 20% test)
        X_train, X_test, y_train, y_test, raw_train, raw_test = train_test_split(
            X, y, raw_items_for_eval, test_size=0.2, random_state=42
        )

        # Build Pipeline with ColumnTransformer
        categorical_features = ["train_category"]
        numerical_features = [
            "scheduled_dwell_minutes",
            "arrival_hour",
            "arrival_minute",
            "time_of_day_slot",
            "day_of_week",
            "coaches",
            "platform_id",
        ]

        preprocessor = ColumnTransformer(
            transformers=[
                (
                    "cat",
                    OneHotEncoder(categories=[CATEGORIES], handle_unknown="ignore", sparse_output=False),
                    categorical_features,
                ),
                ("num", "passthrough", numerical_features),
            ]
        )

        # Stage 8: DecisionTreeRegressor (default) with optional RandomForest fallback
        algo_choice = algorithm.lower().replace("_", "").replace("-", "")
        if "forest" in algo_choice or algo_choice == "randomforest":
            regressor = RandomForestRegressor(
                n_estimators=100,
                max_depth=6,
                min_samples_split=2,
                random_state=42,
            )
            algo_label = "Random Forest Regression (Scikit-Learn RandomForestRegressor)"
            model_ver = "rf-regressor-v1.0"
        else:
            regressor = DecisionTreeRegressor(
                max_depth=6,
                min_samples_split=4,
                min_samples_leaf=2,
                random_state=42,
            )
            algo_label = "Decision Tree Regression (Scikit-Learn DecisionTreeRegressor)"
            model_ver = DEFAULT_MODEL_VERSION

        pipeline = Pipeline(
            steps=[
                ("preprocessor", preprocessor),
                ("regressor", regressor),
            ]
        )

        # Fit model
        pipeline.fit(X_train, y_train)

        # Evaluate on test set
        y_pred = pipeline.predict(X_test)
        mae = float(mean_absolute_error(y_test, y_pred))
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2 = float(r2_score(y_test, y_pred)) if len(y_test) > 1 else 1.0

        # Build Actual vs Predicted comparison samples for UI
        actual_vs_pred_list = []
        for i in range(len(y_test)):
            act = round(float(y_test[i]), 1)
            pred = round(float(y_pred[i]), 1)
            var = round(pred - act, 1)
            acc_pct = max(0, min(100, round((1.0 - (abs(var) / max(act, 1.0))) * 100)))
            actual_vs_pred_list.append({
                "trainNumber": raw_test[i]["train_number"],
                "trainCategory": raw_test[i]["train_category"],
                "scheduledDwell": int(raw_test[i]["scheduled_dwell"]),
                "actual": act,
                "predicted": pred,
                "variance": var,
                "accuracyPct": acc_pct,
            })

        # Feature importances extraction
        fitted_regressor = pipeline.named_steps["regressor"]
        onehot_encoder = pipeline.named_steps["preprocessor"].named_transformers_["cat"]
        cat_feature_names = [f"cat_{c}" for c in onehot_encoder.categories_[0]]
        all_feature_names = cat_feature_names + numerical_features
        importances = getattr(fitted_regressor, "feature_importances_", np.zeros(len(all_feature_names)))

        feature_importances_list = []
        for feat_name, imp in zip(all_feature_names, importances):
            feature_importances_list.append({
                "feature": feat_name.replace("cat_", "Category: ").replace("_", " ").title(),
                "importance": round(float(imp), 4),
            })
        feature_importances_list.sort(key=lambda x: x["importance"], reverse=True)

        # Save model and metadata to disk
        SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)
        joblib.dump(pipeline, MODEL_PATH)

        metadata = {
            "model_version": model_ver,
            "status": "TRAINED",
            "is_ready": True,
            "algorithm": algo_label,
            "sample_count": len(feature_rows),
            "train_samples": len(X_train),
            "test_samples": len(X_test),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2_score": round(r2, 3),
            "last_trained_at": datetime.now(timezone.utc).isoformat(),
            "actual_vs_predicted": actual_vs_pred_list,
            "feature_importances": feature_importances_list,
        }

        with open(METADATA_PATH, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2)

        self.model = pipeline
        self.metadata = metadata

        return {
            "success": True,
            "status": "TRAINED",
            "algorithm": algo_label,
            "message": f"Decision Tree model successfully trained on {len(feature_rows)} records (MAE: {mae:.2f}m, RMSE: {rmse:.2f}m).",
            "sampleCount": len(feature_rows),
            "mae": round(mae, 2),
            "rmse": round(rmse, 2),
            "r2Score": round(r2, 3),
        }

    def predict_occupancy(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Generates advisory prediction of platform occupancy duration in minutes.
        Computes estimated clearance timestamp, 12-hour formatted strings, and variance.
        """
        arr_str = str(data.get("scheduled_arrival") or data.get("scheduledArrival") or "12:00")
        dep_str = str(data.get("scheduled_departure") or data.get("scheduledDeparture") or "12:15")
        train_num = str(data.get("train_number") or data.get("trainNumber") or "TRAIN")
        category = str(
            data.get("train_category") or data.get("category") or data.get("trainCategory") or "EXPRESS"
        ).upper()

        arr_mins = self._parse_time_minutes(arr_str)
        dep_mins = self._parse_time_minutes(dep_str)
        if dep_mins < arr_mins:
            dep_mins += 1440
        sched_dwell = max(2, dep_mins - arr_mins)

        arr_12h = self.format_time_12h(arr_str)
        dep_12h = self.format_time_12h(dep_str)
        algo_label = self.metadata.get("algorithm", "Decision Tree Regression (Scikit-Learn DecisionTreeRegressor)")

        if not self.is_ready or self.model is None:
            # Fallback when model is not yet trained
            est_clearance_12h = dep_12h
            return {
                "trainNumber": train_num,
                "trainCategory": category,
                "scheduledArrival": arr_str,
                "scheduledDeparture": dep_str,
                "scheduledArrivalFormatted": arr_12h,
                "scheduledDepartureFormatted": dep_12h,
                "scheduledDwellMinutes": sched_dwell,
                "predictedDurationMinutes": float(sched_dwell),
                "varianceFromScheduleMinutes": 0.0,
                "estimatedClearanceTime": dep_str,
                "estimatedClearanceTimeFormatted": est_clearance_12h,
                "confidence": 60,
                "isModelReady": False,
                "algorithm": algo_label,
                "advisoryNote": "Advisory ML prediction unavailable (Model Untrained or Insufficient Data). Scheduled dwell used.",
                "status": "UNTRAINED",
                "display": {
                    "train": train_num,
                    "scheduledArrival": arr_12h,
                    "scheduledDeparture": dep_12h,
                    "predictedOccupancy": f"{sched_dwell} minutes",
                    "estimatedClearance": est_clearance_12h,
                },
            }

        feats = self.extract_features_from_dict(data)
        X_df = pd.DataFrame([feats])
        pred_val = float(self.model.predict(X_df)[0])
        pred_duration = round(max(2.0, pred_val), 1)

        variance = round(pred_duration - sched_dwell, 1)

        # Estimated clearance time = arrival + predicted dwell
        clearance_minutes = arr_mins + round(pred_duration)
        est_clearance = self._minutes_to_time_str(clearance_minutes)
        est_clearance_12h = self.format_time_12h(est_clearance)

        mae = self.metadata.get("mae", 2.0)
        confidence = max(50, min(95, int(round((1.0 - (mae / max(sched_dwell, 10.0))) * 100))))

        if variance > 0:
            note = f"Advisory ML estimate: Predicted dwell is {pred_duration} mins (+{variance} mins over schedule). Clearance estimated at {est_clearance_12h}."
        elif variance < 0:
            note = f"Advisory ML estimate: Predicted dwell is {pred_duration} mins ({variance} mins under schedule). Clearance estimated at {est_clearance_12h}."
        else:
            note = f"Advisory ML estimate: Predicted dwell aligns with scheduled timetable ({pred_duration} mins). Clearance at {est_clearance_12h}."

        return {
            "trainNumber": train_num,
            "trainCategory": category,
            "scheduledArrival": arr_str,
            "scheduledDeparture": dep_str,
            "scheduledArrivalFormatted": arr_12h,
            "scheduledDepartureFormatted": dep_12h,
            "scheduledDwellMinutes": sched_dwell,
            "predictedDurationMinutes": pred_duration,
            "varianceFromScheduleMinutes": variance,
            "estimatedClearanceTime": est_clearance,
            "estimatedClearanceTimeFormatted": est_clearance_12h,
            "confidence": confidence,
            "isModelReady": True,
            "algorithm": algo_label,
            "advisoryNote": note,
            "status": "PREDICTED",
            "display": {
                "train": train_num,
                "scheduledArrival": arr_12h,
                "scheduledDeparture": dep_12h,
                "predictedOccupancy": f"{int(round(pred_duration))} minutes",
                "estimatedClearance": est_clearance_12h,
            },
        }


# Global predictor singleton
occupancy_predictor = OccupancyPredictor()
