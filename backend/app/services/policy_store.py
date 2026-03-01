from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

# File-backed policy store (demo-friendly).
# This keeps Milestone-4 "Policy Studio" simple while still being persistent.

DEFAULT_POLICY: Dict[str, Any] = {
    "policy_id": "default",
    "k_min": 5,
    "l_min": 2,
    "enable_drop_predicate": True,
}

_lock = threading.RLock()


def _policy_path() -> Path:
    # backend/data/policy.json
    here = Path(__file__).resolve()
    # app/services/policy_store.py -> backend/app/services -> backend/app -> backend
    backend_root = here.parents[2]
    path = os.getenv("POLICY_PATH")
    if path:
        return Path(path).expanduser().resolve()
    return (backend_root / "data" / "policy.json").resolve()

def _validate(policy: Dict[str, Any]) -> Dict[str, Any]:
    p = dict(DEFAULT_POLICY)
    p.update({k: policy[k] for k in policy.keys() if k in ["policy_id", "k_min", "l_min", "enable_drop_predicate"]})

    # Coerce + clamp
    try:
        p["k_min"] = int(p["k_min"])
    except Exception:
        p["k_min"] = DEFAULT_POLICY["k_min"]
    try:
        p["l_min"] = int(p["l_min"])
    except Exception:
        p["l_min"] = DEFAULT_POLICY["l_min"]
    p["k_min"] = max(2, min(50, p["k_min"]))
    p["l_min"] = max(1, min(10, p["l_min"]))
    p["enable_drop_predicate"] = bool(p.get("enable_drop_predicate", True))

    p["updated_at"] = datetime.now(timezone.utc).isoformat()
    return p

def get_policy() -> Dict[str, Any]:
    path = _policy_path()
    with _lock:
        if not path.exists():
            path.parent.mkdir(parents=True, exist_ok=True)
            p = _validate(DEFAULT_POLICY)
            _atomic_write(path, p)
            return p
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            raw = {}
        p = _validate(raw)
        # keep file normalized
        _atomic_write(path, p)
        return p

def set_policy(*, k_min: int | None = None, l_min: int | None = None, enable_drop_predicate: bool | None = None) -> Dict[str, Any]:
    path = _policy_path()
    with _lock:
        current = get_policy()
        if k_min is not None:
            current["k_min"] = k_min
        if l_min is not None:
            current["l_min"] = l_min
        if enable_drop_predicate is not None:
            current["enable_drop_predicate"] = enable_drop_predicate
        p = _validate(current)
        path.parent.mkdir(parents=True, exist_ok=True)
        _atomic_write(path, p)
        return p

def _atomic_write(path: Path, obj: Dict[str, Any]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(obj, indent=2), encoding="utf-8")
    os.replace(str(tmp), str(path))
