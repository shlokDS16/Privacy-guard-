import base64
import json
import os
import hashlib
from datetime import datetime, timezone
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

_seed = (os.getenv("PG_SIGNING_SEED") or "demo-only-change-me").encode("utf-8")
_private_key = Ed25519PrivateKey.from_private_bytes(hashlib.sha256(_seed).digest())
_public_key = _private_key.public_key()

_prev_hash = None

def _canonical_json(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def issue_receipt(raw_sql: str, rewritten_sql: str | None, decision: str, analysis: dict,
                  applied_rules: list[str], result_summary: dict | None) -> dict:
    global _prev_hash
    ts = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    payload = {
        "receipt_version": "1.0",
        "timestamp_utc": ts,
        "prev_receipt_hash": _prev_hash,
        "query": {"raw_sql": raw_sql, "rewritten_sql": rewritten_sql},
        "policy": {"k_min": 5, "l_min": 2, "dp": {"enabled": False}},
        "risk_assessment": {
            "risk_score": analysis["risk_score"],
            "risk_level": analysis["risk_level"],
            "k_est": analysis["k_est"],
            "l_est": analysis["l_est"],
            "factors": analysis["factors"],
        },
        "rewrite": {"decision": decision, "applied_rules": applied_rules},
        "execution": {"result_summary": result_summary},
        "signature": {"algo": "ed25519", "public_key_id": "demo_key_01"},
    }

    canon = _canonical_json(payload)
    receipt_hash = hashlib.sha256(canon).hexdigest()
    sig = _private_key.sign(bytes.fromhex(receipt_hash))

    payload["receipt_hash"] = f"sha256:{receipt_hash}"
    payload["signature"]["sig"] = "base64:" + base64.b64encode(sig).decode("ascii")

    _prev_hash = payload["receipt_hash"]
    return payload

def verify_receipt(receipt: dict) -> dict:
    try:
        sig_b64 = receipt.get("signature", {}).get("sig", "")
        if not sig_b64.startswith("base64:"):
            return {"valid": False, "reason": "Missing signature"}

        sig = base64.b64decode(sig_b64.split("base64:")[1])

        claimed = receipt.get("receipt_hash", "")
        if not claimed.startswith("sha256:"):
            return {"valid": False, "reason": "Missing receipt_hash"}

        receipt_copy = json.loads(json.dumps(receipt))  # deep copy
        receipt_copy.pop("receipt_hash", None)
        if isinstance(receipt_copy.get("signature"), dict):
            receipt_copy["signature"].pop("sig", None)

        canon = _canonical_json(receipt_copy)
        recomputed = hashlib.sha256(canon).hexdigest()
        if "sha256:" + recomputed != claimed:
            return {"valid": False, "reason": "Hash mismatch", "recomputed": "sha256:" + recomputed}

        _public_key.verify(sig, bytes.fromhex(recomputed))
        return {"valid": True, "reason": "OK"}
    except Exception as e:
        return {"valid": False, "reason": f"Verification error: {e.__class__.__name__}"}
