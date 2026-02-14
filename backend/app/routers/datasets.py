from fastapi import APIRouter

router = APIRouter(tags=["datasets"])

@router.get("/datasets/uci_heart/schema")
def get_schema():
    return {
        "dataset_id": "uci_heart_v1",
        "columns": [
            {"name": "age", "dtype": "int", "sensitivity": "QI"},
            {"name": "sex", "dtype": "int", "sensitivity": "QI"},
            {"name": "cp", "dtype": "int", "sensitivity": "QI"},
            {"name": "trestbps", "dtype": "int", "sensitivity": "SENSITIVE"},
            {"name": "chol", "dtype": "int", "sensitivity": "SENSITIVE"},
            {"name": "fbs", "dtype": "int", "sensitivity": "SENSITIVE"},
            {"name": "thalach", "dtype": "int", "sensitivity": "SENSITIVE"},
            {"name": "target", "dtype": "int", "sensitivity": "SENSITIVE"},
            {"name": "age_band", "dtype": "text", "sensitivity": "DERIVED"},
            {"name": "cp_group", "dtype": "text", "sensitivity": "DERIVED"},
            {"name": "chol_level", "dtype": "text", "sensitivity": "DERIVED"},
        ],
        "policy_defaults": {"k_min": 5, "l_min": 2, "enable_drop_predicate": True},
    }
