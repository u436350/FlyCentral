"""FlyCentral SaaS – Flask Backend v0.3 (SQLite + Stripe simulation)"""
from __future__ import annotations

import os as _os
import pathlib as _pathlib

def _load_dotenv_simple() -> None:
    """Minimal .env loader – no external packages needed."""
    env_file = _pathlib.Path(__file__).parent / ".env"
    if not env_file.exists():
        return
    for raw in env_file.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip().strip('"').strip("'")
        if key and key not in _os.environ:
            _os.environ[key] = val

_load_dotenv_simple()

try:
    from dotenv import load_dotenv as _ld
    _ld(override=False)
except ImportError:
    pass

import hashlib
import hmac
import io
import json
import os
import random
import string
import csv
import time
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
from itsdangerous import URLSafeTimedSerializer, BadTimeSignature, SignatureExpired

from database import get_conn, init_db, row_to_dict
from flight_market import build_catalog_metadata, flight_provider_status, search_market_flights

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY   = os.environ.get("SECRET_KEY", "flycentral-dev-secret-change-in-production")
ALGORITHM    = "HS256"
TOKEN_HOURS  = 8
STATIC_DIR   = Path(__file__).parent / "static"
MONTHLY_FEE  = 149.0   # EUR per tenant per month (SaaS subscription)
LOGIN_LIMIT_PER_MIN = 8
WEBHOOK_LIMIT_PER_MIN = 120
RATE_BUCKETS: dict[str, list[float]] = {}

app = Flask(__name__, static_folder=str(STATIC_DIR))
CORS(app, origins=[
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:3000",
    "https://u436350.github.io",
    os.environ.get("CORS_ORIGIN", ""),
], supports_credentials=True)
token_signer = URLSafeTimedSerializer(SECRET_KEY, salt="flycentral-auth")


class TokenExpiredError(Exception):
    pass


class TokenInvalidError(Exception):
    pass

# ── Static flight catalogue (broad demo coverage until real GDS integration) ─
def _build_flight_catalog(seed_rows: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    flights: dict[str, dict[str, object]] = {}
    for index, row in enumerate(seed_rows, start=1):
        flight_id = f"FL-{index}"
        flights[flight_id] = {"id": flight_id, **row}
    return flights


FLIGHTS = _build_flight_catalog([
    dict(origin="FRA", destination="DXB", departure_at="2026-05-11T09:10:00Z", arrival_at="2026-05-11T15:40:00Z", airline="Lufthansa", base_price=460.0, duration_minutes=390),
    dict(origin="FRA", destination="DXB", departure_at="2026-05-11T12:20:00Z", arrival_at="2026-05-11T19:30:00Z", airline="Emirates", base_price=590.0, duration_minutes=430),
    dict(origin="BER", destination="IST", departure_at="2026-05-11T07:00:00Z", arrival_at="2026-05-11T10:00:00Z", airline="Turkish Airlines", base_price=280.0, duration_minutes=180),
    dict(origin="MUC", destination="JFK", departure_at="2026-05-12T10:00:00Z", arrival_at="2026-05-12T14:30:00Z", airline="Lufthansa", base_price=820.0, duration_minutes=570),
    dict(origin="LHR", destination="DXB", departure_at="2026-05-12T06:45:00Z", arrival_at="2026-05-12T17:00:00Z", airline="Emirates", base_price=510.0, duration_minutes=435),
    dict(origin="CDG", destination="BKK", departure_at="2026-05-13T22:00:00Z", arrival_at="2026-05-14T14:30:00Z", airline="Thai Airways", base_price=695.0, duration_minutes=690),
    dict(origin="FRA", destination="JFK", departure_at="2026-05-14T08:30:00Z", arrival_at="2026-05-14T11:45:00Z", airline="United Airlines", base_price=750.0, duration_minutes=555),
    dict(origin="DXB", destination="SIN", departure_at="2026-05-14T01:30:00Z", arrival_at="2026-05-14T13:15:00Z", airline="Emirates", base_price=480.0, duration_minutes=465),
    dict(origin="BER", destination="BCN", departure_at="2026-05-15T06:00:00Z", arrival_at="2026-05-15T08:20:00Z", airline="Vueling", base_price=120.0, duration_minutes=140),
    dict(origin="VIE", destination="DXB", departure_at="2026-05-15T11:10:00Z", arrival_at="2026-05-15T17:25:00Z", airline="Austrian Airlines", base_price=410.0, duration_minutes=375),
    dict(origin="ZRH", destination="BKK", departure_at="2026-05-16T22:45:00Z", arrival_at="2026-05-17T14:55:00Z", airline="Swiss", base_price=780.0, duration_minutes=730),
    dict(origin="AMS", destination="NRT", departure_at="2026-05-16T10:30:00Z", arrival_at="2026-05-17T06:00:00Z", airline="KLM", base_price=895.0, duration_minutes=690),
    dict(origin="MAD", destination="GRU", departure_at="2026-05-17T23:55:00Z", arrival_at="2026-05-18T07:10:00Z", airline="Iberia", base_price=670.0, duration_minutes=730),
    dict(origin="FRA", destination="SIN", departure_at="2026-05-18T13:00:00Z", arrival_at="2026-05-19T07:30:00Z", airline="Singapore Airlines", base_price=980.0, duration_minutes=780),
    dict(origin="LHR", destination="JFK", departure_at="2026-05-18T09:00:00Z", arrival_at="2026-05-18T12:00:00Z", airline="British Airways", base_price=620.0, duration_minutes=420),
    dict(origin="CDG", destination="JFK", departure_at="2026-05-19T08:15:00Z", arrival_at="2026-05-19T11:05:00Z", airline="Air France", base_price=655.0, duration_minutes=470),
    dict(origin="AMS", destination="JFK", departure_at="2026-05-19T10:25:00Z", arrival_at="2026-05-19T13:00:00Z", airline="Delta Air Lines", base_price=690.0, duration_minutes=455),
    dict(origin="MAD", destination="MEX", departure_at="2026-05-19T12:30:00Z", arrival_at="2026-05-19T22:10:00Z", airline="Aeromexico", base_price=760.0, duration_minutes=730),
    dict(origin="FCO", destination="EZE", departure_at="2026-05-20T19:40:00Z", arrival_at="2026-05-21T07:00:00Z", airline="ITA Airways", base_price=910.0, duration_minutes=830),
    dict(origin="IST", destination="DOH", departure_at="2026-05-20T14:20:00Z", arrival_at="2026-05-20T18:30:00Z", airline="Qatar Airways", base_price=430.0, duration_minutes=250),
    dict(origin="DOH", destination="JNB", departure_at="2026-05-20T22:30:00Z", arrival_at="2026-05-21T06:55:00Z", airline="Qatar Airways", base_price=610.0, duration_minutes=505),
    dict(origin="ADD", destination="LHR", departure_at="2026-05-21T00:10:00Z", arrival_at="2026-05-21T06:15:00Z", airline="Ethiopian Airlines", base_price=540.0, duration_minutes=485),
    dict(origin="CAI", destination="FRA", departure_at="2026-05-21T05:50:00Z", arrival_at="2026-05-21T09:15:00Z", airline="EgyptAir", base_price=295.0, duration_minutes=265),
    dict(origin="CMN", destination="CDG", departure_at="2026-05-21T07:30:00Z", arrival_at="2026-05-21T11:25:00Z", airline="Royal Air Maroc", base_price=245.0, duration_minutes=235),
    dict(origin="LIS", destination="GRU", departure_at="2026-05-21T12:00:00Z", arrival_at="2026-05-21T21:10:00Z", airline="TAP Air Portugal", base_price=715.0, duration_minutes=610),
    dict(origin="MAD", destination="BOG", departure_at="2026-05-21T23:10:00Z", arrival_at="2026-05-22T08:20:00Z", airline="Avianca", base_price=635.0, duration_minutes=650),
    dict(origin="BCN", destination="MIA", departure_at="2026-05-22T10:45:00Z", arrival_at="2026-05-22T18:05:00Z", airline="American Airlines", base_price=705.0, duration_minutes=560),
    dict(origin="MUC", destination="ORD", departure_at="2026-05-22T09:25:00Z", arrival_at="2026-05-22T12:35:00Z", airline="United Airlines", base_price=730.0, duration_minutes=550),
    dict(origin="FRA", destination="YYZ", departure_at="2026-05-22T11:40:00Z", arrival_at="2026-05-22T14:10:00Z", airline="Air Canada", base_price=680.0, duration_minutes=510),
    dict(origin="LHR", destination="LAX", departure_at="2026-05-22T15:15:00Z", arrival_at="2026-05-22T18:25:00Z", airline="Virgin Atlantic", base_price=840.0, duration_minutes=655),
    dict(origin="JFK", destination="SFO", departure_at="2026-05-23T06:00:00Z", arrival_at="2026-05-23T09:35:00Z", airline="JetBlue", base_price=240.0, duration_minutes=335),
    dict(origin="ATL", destination="MCO", departure_at="2026-05-23T07:10:00Z", arrival_at="2026-05-23T08:45:00Z", airline="Southwest Airlines", base_price=99.0, duration_minutes=95),
    dict(origin="ORD", destination="DFW", departure_at="2026-05-23T09:25:00Z", arrival_at="2026-05-23T11:50:00Z", airline="American Airlines", base_price=130.0, duration_minutes=145),
    dict(origin="SEA", destination="ANC", departure_at="2026-05-23T10:10:00Z", arrival_at="2026-05-23T13:05:00Z", airline="Alaska Airlines", base_price=185.0, duration_minutes=175),
    dict(origin="DEN", destination="LAS", departure_at="2026-05-23T14:00:00Z", arrival_at="2026-05-23T15:35:00Z", airline="Frontier Airlines", base_price=88.0, duration_minutes=95),
    dict(origin="LAX", destination="HNL", departure_at="2026-05-23T16:45:00Z", arrival_at="2026-05-23T20:30:00Z", airline="Hawaiian Airlines", base_price=330.0, duration_minutes=345),
    dict(origin="SFO", destination="NRT", departure_at="2026-05-23T12:20:00Z", arrival_at="2026-05-24T15:30:00Z", airline="ANA", base_price=960.0, duration_minutes=660),
    dict(origin="LAX", destination="SYD", departure_at="2026-05-23T22:50:00Z", arrival_at="2026-05-25T07:10:00Z", airline="Qantas", base_price=1240.0, duration_minutes=900),
    dict(origin="YVR", destination="ICN", departure_at="2026-05-24T13:00:00Z", arrival_at="2026-05-25T05:40:00Z", airline="Korean Air", base_price=905.0, duration_minutes=640),
    dict(origin="SFO", destination="TPE", departure_at="2026-05-24T11:15:00Z", arrival_at="2026-05-25T16:45:00Z", airline="EVA Air", base_price=885.0, duration_minutes=765),
    dict(origin="LAX", destination="MNL", departure_at="2026-05-24T23:30:00Z", arrival_at="2026-05-26T06:20:00Z", airline="Philippine Airlines", base_price=870.0, duration_minutes=830),
    dict(origin="HKG", destination="SIN", departure_at="2026-05-24T08:10:00Z", arrival_at="2026-05-24T12:05:00Z", airline="Cathay Pacific", base_price=260.0, duration_minutes=235),
    dict(origin="SIN", destination="NRT", departure_at="2026-05-24T13:50:00Z", arrival_at="2026-05-24T21:55:00Z", airline="Japan Airlines", base_price=540.0, duration_minutes=365),
    dict(origin="NRT", destination="CTS", departure_at="2026-05-25T07:15:00Z", arrival_at="2026-05-25T08:55:00Z", airline="ANA", base_price=110.0, duration_minutes=100),
    dict(origin="ICN", destination="BKK", departure_at="2026-05-25T09:20:00Z", arrival_at="2026-05-25T13:10:00Z", airline="Asiana Airlines", base_price=285.0, duration_minutes=230),
    dict(origin="KUL", destination="CGK", departure_at="2026-05-25T11:00:00Z", arrival_at="2026-05-25T12:05:00Z", airline="AirAsia", base_price=72.0, duration_minutes=65),
    dict(origin="DEL", destination="DXB", departure_at="2026-05-25T14:45:00Z", arrival_at="2026-05-25T17:15:00Z", airline="IndiGo", base_price=165.0, duration_minutes=210),
    dict(origin="BOM", destination="LHR", departure_at="2026-05-25T02:15:00Z", arrival_at="2026-05-25T08:30:00Z", airline="Air India", base_price=505.0, duration_minutes=555),
    dict(origin="DEL", destination="SIN", departure_at="2026-05-25T23:00:00Z", arrival_at="2026-05-26T07:10:00Z", airline="Singapore Airlines", base_price=350.0, duration_minutes=370),
    dict(origin="DXB", destination="RUH", departure_at="2026-05-26T06:30:00Z", arrival_at="2026-05-26T07:25:00Z", airline="Saudia", base_price=102.0, duration_minutes=115),
    dict(origin="AUH", destination="CAI", departure_at="2026-05-26T09:15:00Z", arrival_at="2026-05-26T11:40:00Z", airline="Etihad Airways", base_price=195.0, duration_minutes=205),
    dict(origin="DOH", destination="KWI", departure_at="2026-05-26T12:05:00Z", arrival_at="2026-05-26T13:20:00Z", airline="Qatar Airways", base_price=92.0, duration_minutes=75),
    dict(origin="JNB", destination="CPT", departure_at="2026-05-26T14:00:00Z", arrival_at="2026-05-26T16:10:00Z", airline="South African Airways", base_price=125.0, duration_minutes=130),
    dict(origin="NBO", destination="DAR", departure_at="2026-05-26T15:35:00Z", arrival_at="2026-05-26T16:45:00Z", airline="Kenya Airways", base_price=95.0, duration_minutes=70),
    dict(origin="LOS", destination="ACC", departure_at="2026-05-26T18:15:00Z", arrival_at="2026-05-26T19:20:00Z", airline="Air Peace", base_price=118.0, duration_minutes=65),
    dict(origin="CMN", destination="JFK", departure_at="2026-05-26T22:10:00Z", arrival_at="2026-05-27T02:30:00Z", airline="Royal Air Maroc", base_price=690.0, duration_minutes=500),
    dict(origin="SYD", destination="MEL", departure_at="2026-05-27T06:00:00Z", arrival_at="2026-05-27T07:35:00Z", airline="Virgin Australia", base_price=98.0, duration_minutes=95),
    dict(origin="AKL", destination="SYD", departure_at="2026-05-27T08:25:00Z", arrival_at="2026-05-27T10:15:00Z", airline="Air New Zealand", base_price=175.0, duration_minutes=170),
    dict(origin="MEL", destination="SIN", departure_at="2026-05-27T12:45:00Z", arrival_at="2026-05-27T19:30:00Z", airline="Scoot", base_price=240.0, duration_minutes=465),
    dict(origin="SYD", destination="SIN", departure_at="2026-05-27T13:05:00Z", arrival_at="2026-05-27T19:10:00Z", airline="Singapore Airlines", base_price=520.0, duration_minutes=490),
    dict(origin="SCL", destination="LIM", departure_at="2026-05-27T09:35:00Z", arrival_at="2026-05-27T12:00:00Z", airline="LATAM Airlines", base_price=165.0, duration_minutes=205),
    dict(origin="BOG", destination="MIA", departure_at="2026-05-27T14:10:00Z", arrival_at="2026-05-27T18:15:00Z", airline="Avianca", base_price=295.0, duration_minutes=245),
    dict(origin="GRU", destination="EZE", departure_at="2026-05-27T16:00:00Z", arrival_at="2026-05-27T18:50:00Z", airline="Gol", base_price=155.0, duration_minutes=170),
    dict(origin="MEX", destination="CUN", departure_at="2026-05-27T17:40:00Z", arrival_at="2026-05-27T19:55:00Z", airline="Volaris", base_price=82.0, duration_minutes=135),
    dict(origin="PTY", destination="MIA", departure_at="2026-05-27T18:05:00Z", arrival_at="2026-05-27T22:00:00Z", airline="Copa Airlines", base_price=225.0, duration_minutes=235),
    dict(origin="FRA", destination="DOH", departure_at="2026-05-28T10:10:00Z", arrival_at="2026-05-28T16:55:00Z", airline="Qatar Airways", base_price=515.0, duration_minutes=405),
    dict(origin="LHR", destination="SIN", departure_at="2026-05-28T20:35:00Z", arrival_at="2026-05-29T16:45:00Z", airline="Singapore Airlines", base_price=935.0, duration_minutes=780),
    dict(origin="CDG", destination="HND", departure_at="2026-05-28T11:20:00Z", arrival_at="2026-05-29T06:50:00Z", airline="Air France", base_price=940.0, duration_minutes=750),
    dict(origin="MAD", destination="IST", departure_at="2026-05-28T07:10:00Z", arrival_at="2026-05-28T11:20:00Z", airline="Turkish Airlines", base_price=215.0, duration_minutes=250),
    dict(origin="VIE", destination="NRT", departure_at="2026-05-28T13:00:00Z", arrival_at="2026-05-29T07:45:00Z", airline="ANA", base_price=910.0, duration_minutes=705),
])

# ── Password helpers ──────────────────────────────────────────────────────────
def hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    dk   = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260_000)
    return f"{salt}${dk.hex()}"


def verify_password(plain: str, hashed: str) -> bool:
    try:
        salt, dk_hex = hashed.split("$", 1)
        dk = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt.encode(), 260_000)
        return hmac.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


# ── JWT helpers ───────────────────────────────────────────────────────────────
def create_token(payload: dict) -> str:
    data = payload.copy()
    data["iat"] = datetime.now(timezone.utc).isoformat()
    return token_signer.dumps(data)


def decode_token(token: str) -> dict:
    try:
        return token_signer.loads(token, max_age=TOKEN_HOURS * 3600)
    except SignatureExpired as exc:
        raise TokenExpiredError("token expired") from exc
    except BadTimeSignature as exc:
        raise TokenInvalidError("invalid token") from exc


# ── DB helpers ────────────────────────────────────────────────────────────────
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _audit_date_bounds(from_date: str, to_date: str) -> tuple[str | None, str | None]:
    from_bound = None
    to_bound = None
    if from_date:
        from_bound = datetime.strptime(from_date, "%Y-%m-%d").strftime("%Y-%m-%d 00:00:00")
    if to_date:
        to_bound = datetime.strptime(to_date, "%Y-%m-%d").strftime("%Y-%m-%d 23:59:59")
    return from_bound, to_bound


def _client_ip() -> str:
    xff = request.headers.get("X-Forwarded-For", "").strip()
    if xff:
        return xff.split(",")[0].strip()
    return request.remote_addr or "unknown"


def _rate_limit_ok(scope: str, key: str, max_calls: int, per_seconds: int) -> bool:
    now_ts = time.time()
    bucket_key = f"{scope}:{key}"
    calls = RATE_BUCKETS.get(bucket_key, [])
    cutoff = now_ts - per_seconds
    calls = [t for t in calls if t >= cutoff]
    if len(calls) >= max_calls:
        RATE_BUCKETS[bucket_key] = calls
        return False
    calls.append(now_ts)
    RATE_BUCKETS[bucket_key] = calls
    return True


def _push_event(tenant_id: str, type_: str, message: str) -> None:
    eid = f"EV-{uuid4().hex[:8]}"
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO live_events (id, tenant_id, type, message) VALUES (?,?,?,?)",
            (eid, tenant_id, type_, message)
        )


def _audit_log(
    action: str,
    entity_type: str,
    entity_id: str | None,
    tenant_id: str | None = None,
    actor_user_id: str | None = None,
    actor_role: str | None = None,
    details: str | None = None,
) -> None:
    aid = f"AL-{uuid4().hex[:10].upper()}"
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO audit_logs
               (id, tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, details)
               VALUES (?,?,?,?,?,?,?,?)""",
            (aid, tenant_id, actor_user_id, actor_role, action, entity_type, entity_id, details)
        )


def _get_tenant(tenant_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM tenants WHERE id=?", (tenant_id,)).fetchone()
    return row_to_dict(row) if row else None


def _get_user(user_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    return row_to_dict(row) if row else None


def _get_user_by_email(email: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    return row_to_dict(row) if row else None


def _get_booking(booking_id: str, tenant_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM bookings WHERE id=? AND tenant_id=?",
            (booking_id, tenant_id)
        ).fetchone()
    if not row:
        return None
    b = row_to_dict(row)
    b["passenger_names"] = json.loads(b["passenger_names"])
    return b


def _get_payment_by_intent(intent_id: str) -> dict | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM payments WHERE payment_intent_id=?",
            (intent_id,)
        ).fetchone()
    return row_to_dict(row) if row else None


def _finalize_payment_intent(intent_id: str, event_type: str) -> tuple[bool, str, dict | None]:
    payment = _get_payment_by_intent(intent_id)
    if not payment:
        return False, "payment intent not found", None

    if payment["status"] == "succeeded":
        booking = _get_booking(payment["booking_id"], payment["tenant_id"])
        return True, "already finalized", booking

    if event_type != "payment_intent.succeeded":
        with get_conn() as conn:
            conn.execute(
                "UPDATE payments SET status=?, updated_at=datetime('now') WHERE payment_intent_id=?",
                ("failed", intent_id)
            )
        _push_event(payment["tenant_id"], "PAYMENT_FAILED", f"{payment['booking_id']} failed")
        return False, "payment failed", _get_booking(payment["booking_id"], payment["tenant_id"])

    ticket_no = "220-" + "".join(random.choices(string.digits, k=10))
    with get_conn() as conn:
        conn.execute(
            "UPDATE payments SET status=?, updated_at=datetime('now') WHERE payment_intent_id=?",
            ("succeeded", intent_id)
        )
        conn.execute(
            """UPDATE bookings
               SET payment_status='paid', status='ticketed', ticket_number=?, last_action=?
               WHERE id=?""",
            (ticket_no, "Payment confirmed via webhook - ticket issued", payment["booking_id"])
        )

    _push_event(payment["tenant_id"], "PAYMENT_CONFIRMED", f"{payment['booking_id']} paid - ticket {ticket_no}")
    return True, "payment finalized", _get_booking(payment["booking_id"], payment["tenant_id"])


# ── Auth decorators ───────────────────────────────────────────────────────────
def require_auth(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth  = request.headers.get("Authorization", "")
        token = auth[7:] if auth.startswith("Bearer ") else None
        if not token:
            return jsonify({"error": "Missing token"}), 401
        try:
            payload = decode_token(token)
        except TokenExpiredError:
            return jsonify({"error": "Token expired"}), 401
        except TokenInvalidError:
            return jsonify({"error": "Invalid token"}), 401
        user = _get_user(payload.get("sub", ""))
        if not user:
            return jsonify({"error": "User not found"}), 401
        tenant = _get_tenant(user["tenant_id"])
        if tenant and tenant["status"] == "suspended" and user["role"] != "admin":
            return jsonify({"error": "Account suspended – contact admin"}), 403
        request.current_user   = user
        request.current_tenant = tenant
        return f(*args, **kwargs)
    return wrapper


def require_admin(f):
    @wraps(f)
    @require_auth
    def wrapper(*args, **kwargs):
        if request.current_user["role"] != "admin":
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return wrapper


def require_roles(*allowed_roles: str):
    def decorator(f):
        @wraps(f)
        @require_auth
        def wrapper(*args, **kwargs):
            if request.current_user["role"] not in allowed_roles:
                return jsonify({"error": f"Role '{request.current_user['role']}' is not allowed"}), 403
            return f(*args, **kwargs)
        return wrapper
    return decorator


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "flycentral-api", "version": "0.3.0"})


# ── Auth ──────────────────────────────────────────────────────────────────────
@app.post("/api/auth/login")
def login():
    data     = request.get_json(silent=True) or {}
    email    = str(data.get("email",    "")).strip()
    password = str(data.get("password", ""))
    client_key = f"{_client_ip()}|{email or 'unknown'}"
    if not _rate_limit_ok("login", client_key, LOGIN_LIMIT_PER_MIN, 60):
        return jsonify({"error": "Too many login attempts. Try again in a minute."}), 429
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400
    user = _get_user_by_email(email)
    if not user or not verify_password(password, user["hashed_password"]):
        return jsonify({"error": "Invalid credentials"}), 401
    tenant = _get_tenant(user["tenant_id"])
    if tenant and tenant["status"] == "suspended" and user["role"] != "admin":
        return jsonify({"error": "Account suspended"}), 403
    token = create_token({"sub": user["id"], "role": user["role"], "tenant_id": user["tenant_id"]})
    return jsonify({
        "access_token": token,
        "token_type":   "bearer",
        "role":         user["role"],
        "tenant_id":    user["tenant_id"],
        "email":        user["email"],
    })


@app.post("/api/auth/register")
def register_agency():
    """Self-service signup for new agencies."""
    data        = request.get_json(silent=True) or {}
    agency_name = str(data.get("agency_name", "")).strip()
    email       = str(data.get("email", "")).strip()
    password    = str(data.get("password", ""))
    if not all([agency_name, email, password]):
        return jsonify({"error": "agency_name, email, password required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if _get_user_by_email(email):
        return jsonify({"error": "Email already registered"}), 409
    tid = f"t-{uuid4().hex[:8]}"
    uid = f"u-{uuid4().hex[:8]}"
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO tenants (id, name, email, status, markup_percent) VALUES (?,?,?,'active',8.0)",
            (tid, agency_name, email)
        )
        conn.execute(
            "INSERT INTO users (id, tenant_id, email, hashed_password, role) VALUES (?,?,?,?,'agent')",
            (uid, tid, email, hash_password(password))
        )
    _push_event(tid, "TENANT_CREATED", f"Self-signup: {agency_name}")
    _audit_log(
        action="agency.registered",
        entity_type="tenant",
        entity_id=tid,
        tenant_id=tid,
        actor_user_id=uid,
        actor_role="agent",
        details=f"self-signup email={email}",
    )
    token = create_token({"sub": uid, "role": "agent", "tenant_id": tid})
    return jsonify({
        "access_token": token,
        "token_type":   "bearer",
        "role":         "agent",
        "tenant_id":    tid,
        "email":        email,
    }), 201


# ── Flights ───────────────────────────────────────────────────────────────────
@app.get("/api/providers/flights/status")
@require_roles("agent", "supervisor", "admin")
def flight_provider_info():
    return jsonify(flight_provider_status())


@app.get("/api/flights/search")
@require_roles("agent", "supervisor", "admin")
def search_flights():
    tenant = request.current_tenant
    origin = request.args.get("origin", "").upper()
    destination = request.args.get("destination", "").upper()
    departure_date = request.args.get("departure_date", "").strip()
    airline_q = request.args.get("airline", "").lower()
    max_price = float(request.args.get("max_price", 9999))
    max_dur = int(request.args.get("max_duration", 9999))
    sort_by = request.args.get("sort", "price")

    try:
        results = search_market_flights(
            FLIGHTS,
            tenant,
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            airline_q=airline_q,
            max_price=max_price,
            max_dur=max_dur,
            sort_by=sort_by,
        )
    except Exception as exc:
        return jsonify({"error": f"Live flight provider error: {exc}"}), 502

    provider_state = flight_provider_status()
    return jsonify({
        "count": len(results),
        "results": results,
        "provider": provider_state["active_provider"],
        "live_market_used": bool(departure_date and origin and destination and provider_state["active_provider"] == "amadeus"),
    })


@app.get("/api/flights/catalog")
@require_roles("agent", "supervisor", "admin")
def flights_catalog():
    return jsonify(build_catalog_metadata(FLIGHTS))


# ── Bookings ──────────────────────────────────────────────────────────────────
@app.get("/api/bookings")
@require_roles("agent", "supervisor", "admin")
def list_bookings():
    tid = request.current_user["tenant_id"]
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM bookings WHERE tenant_id=? ORDER BY created_at DESC", (tid,)
        ).fetchall()
    result = []
    for r in rows:
        b = row_to_dict(r)
        b["passenger_names"] = json.loads(b["passenger_names"])
        result.append(b)
    return jsonify({"count": len(result), "results": result})


@app.post("/api/bookings")
@require_roles("agent", "supervisor", "admin")
def create_booking():
    user   = request.current_user
    tenant = request.current_tenant
    data   = request.get_json(silent=True) or {}

    flight_id = str(data.get("flight_id", "")).strip()
    names     = [str(n).strip() for n in (data.get("passenger_names") or []) if str(n).strip()]

    if not flight_id:
        return jsonify({"error": "flight_id required"}), 400
    if not names:
        return jsonify({"error": "at least one passenger name required"}), 400

    flight = FLIGHTS.get(flight_id)
    if not flight:
        return jsonify({"error": "Flight not found"}), 404

    markup = tenant["markup_percent"] if tenant else 8.0
    paid   = round(flight["base_price"] * (1 + markup / 100), 2)
    bid    = f"BK-{uuid4().hex[:8].upper()}"

    with get_conn() as conn:
        conn.execute(
            """INSERT INTO bookings
               (id, tenant_id, flight_id, passenger_names, paid_price, status, payment_status, last_action)
               VALUES (?,?,?,?,?,'reserved','unpaid','created')""",
            (bid, user["tenant_id"], flight_id, json.dumps(names), paid)
        )
    _push_event(user["tenant_id"], "BOOKING_CREATED",
                f"{bid} – {flight['origin']}→{flight['destination']}")
    _audit_log(
        action="booking.created",
        entity_type="booking",
        entity_id=bid,
        tenant_id=user["tenant_id"],
        actor_user_id=user["id"],
        actor_role=user["role"],
        details=f"flight_id={flight_id}; passengers={len(names)}",
    )
    return jsonify(_get_booking(bid, user["tenant_id"])), 201


@app.post("/api/bookings/<booking_id>/checkout")
@require_roles("agent", "supervisor", "admin")
def checkout(booking_id: str):
    """Create a Stripe payment intent (simulated)."""
    user    = request.current_user
    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if booking["payment_status"] == "paid":
        return jsonify({"error": "Already paid"}), 400

    # Simulate a Stripe payment intent
    intent_id = f"pi_{uuid4().hex[:24]}"
    client_secret = f"{intent_id}_secret_{uuid4().hex[:16]}"

    with get_conn() as conn:
        conn.execute(
            "UPDATE bookings SET payment_intent=?, last_action=? WHERE id=?",
            (intent_id, "checkout initiated", booking_id)
        )
        conn.execute(
            """INSERT INTO payments (id, tenant_id, booking_id, payment_intent_id, amount_eur, currency, status)
               VALUES (?,?,?,?,?,'EUR','requires_action')""",
            (f"PY-{uuid4().hex[:10].upper()}", user["tenant_id"], booking_id, intent_id, booking["paid_price"])
        )
    _audit_log(
        action="payment.checkout_initiated",
        entity_type="payment_intent",
        entity_id=intent_id,
        tenant_id=user["tenant_id"],
        actor_user_id=user["id"],
        actor_role=user["role"],
        details=f"booking_id={booking_id}; amount={booking['paid_price']}",
    )

    return jsonify({
        "payment_intent_id": intent_id,
        "client_secret":     client_secret,
        "amount_eur":        booking["paid_price"],
        "currency":          "EUR",
        "booking_id":        booking_id,
        "note":              "Stripe simulation – use /api/bookings/{id}/pay to confirm"
    })


@app.post("/api/bookings/<booking_id>/pay")
@require_roles("agent", "supervisor", "admin")
def confirm_payment(booking_id: str):
    """Simulate Stripe payment confirmation → auto-ticket."""
    user    = request.current_user
    data    = request.get_json(silent=True) or {}
    email   = str(data.get("customer_email", "")).strip()
    if not email or "@" not in email:
        return jsonify({"error": "valid customer_email required"}), 400

    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if booking["payment_status"] == "paid":
        return jsonify({
            "ok": True,
            "ticket_number": booking.get("ticket_number"),
            "email_sent_to": email,
            "booking": booking,
            "message": "Payment already confirmed",
        })

    intent_id = booking.get("payment_intent")
    if not intent_id:
        return jsonify({"error": "Checkout required before payment"}), 400

    ok, message, updated_booking = _finalize_payment_intent(intent_id, "payment_intent.succeeded")
    if not ok:
        return jsonify({"error": message}), 400

    _audit_log(
        action="payment.confirmed",
        entity_type="booking",
        entity_id=booking_id,
        tenant_id=user["tenant_id"],
        actor_user_id=user["id"],
        actor_role=user["role"],
        details=f"intent={intent_id}; email={email}",
    )

    return jsonify({
        "ok":           True,
        "ticket_number": updated_booking.get("ticket_number") if updated_booking else None,
        "email_sent_to": email,
        "booking":       updated_booking,
    })


@app.post("/api/bookings/<booking_id>/rebook")
@require_roles("agent", "supervisor", "admin")
def rebook(booking_id: str):
    user    = request.current_user
    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    data     = request.get_json(silent=True) or {}
    new_date = str(data.get("new_date", "")).strip()
    if not new_date:
        return jsonify({"error": "new_date required"}), 400
    with get_conn() as conn:
        conn.execute(
            "UPDATE bookings SET last_action=? WHERE id=?",
            (f"Rebook request: {new_date}", booking_id)
        )
    _push_event(user["tenant_id"], "REBOOK_REQUESTED", f"{booking_id} → {new_date}")
    return jsonify({"ok": True, "booking": _get_booking(booking_id, user["tenant_id"])})


@app.post("/api/bookings/<booking_id>/extras")
@require_roles("agent", "supervisor", "admin")
def add_extras(booking_id: str):
    user    = request.current_user
    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    data   = request.get_json(silent=True) or {}
    extras = [str(e) for e in data.get("extras", [])]
    label  = ", ".join(extras)
    with get_conn() as conn:
        conn.execute(
            "UPDATE bookings SET last_action=? WHERE id=?",
            (f"Extras: {label}", booking_id)
        )
    _push_event(user["tenant_id"], "EXTRAS_ADDED", f"{booking_id} – {label}")
    return jsonify({"ok": True, "booking": _get_booking(booking_id, user["tenant_id"])})


@app.post("/api/bookings/<booking_id>/name-correction")
@require_roles("agent", "supervisor", "admin")
def name_correction(booking_id: str):
    user    = request.current_user
    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    data = request.get_json(silent=True) or {}
    idx  = int(data.get("passenger_index", 0))
    name = str(data.get("corrected_name", "")).strip()
    if not name:
        return jsonify({"error": "corrected_name required"}), 400
    names = booking["passenger_names"]
    if idx >= len(names):
        return jsonify({"error": "invalid passenger index"}), 400
    names[idx] = name
    with get_conn() as conn:
        conn.execute(
            "UPDATE bookings SET passenger_names=?, last_action=? WHERE id=?",
            (json.dumps(names), f"Name corrected at index {idx}", booking_id)
        )
    _push_event(user["tenant_id"], "NAME_CORRECTED", booking_id)
    return jsonify({"ok": True, "booking": _get_booking(booking_id, user["tenant_id"])})


@app.post("/api/bookings/<booking_id>/ticket")
@require_roles("agent", "supervisor", "admin")
def issue_ticket(booking_id: str):
    user    = request.current_user
    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if booking["payment_status"] != "paid":
        return jsonify({"error": "Booking must be paid before manual ticketing"}), 400
    data  = request.get_json(silent=True) or {}
    email = str(data.get("customer_email", "")).strip()
    if not email or "@" not in email:
        return jsonify({"error": "valid customer_email required"}), 400
    ticket_no = "220-" + "".join(random.choices(string.digits, k=10))
    with get_conn() as conn:
        conn.execute(
            "UPDATE bookings SET status='ticketed', ticket_number=?, last_action=? WHERE id=?",
            (ticket_no, "Ticket issued manually", booking_id)
        )
    _push_event(user["tenant_id"], "TICKET_ISSUED", f"{booking_id} – {ticket_no}")
    return jsonify({
        "ok":            True,
        "ticket_number": ticket_no,
        "email_sent_to": email,
        "booking":       _get_booking(booking_id, user["tenant_id"]),
    })


# ── Booking cancellation ───────────────────────────────────────────────────────
@app.post("/api/bookings/<booking_id>/cancel")
@require_roles("agent", "supervisor", "admin")
def cancel_booking(booking_id: str):
    user    = request.current_user
    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if booking["status"] == "cancelled":
        return jsonify({"error": "Booking already cancelled"}), 400
    if booking["status"] == "ticketed":
        return jsonify({"error": "Ticketed bookings require supervisor approval to cancel"}), 403

    refund_amount = 0.0
    refund_note   = "No refund (unpaid)"
    if booking["payment_status"] == "paid":
        refund_amount = round(float(booking["paid_price"]) * 0.85, 2)
        refund_note   = f"Refund simulated: {refund_amount} EUR (85% of paid)"

    with get_conn() as conn:
        conn.execute(
            "UPDATE bookings SET status='cancelled', last_action=? WHERE id=?",
            (f"Cancelled – {refund_note}", booking_id)
        )
    _push_event(user["tenant_id"], "BOOKING_CANCELLED", f"{booking_id} – {refund_note}")
    _audit_log(
        action="booking.cancelled",
        entity_type="booking",
        entity_id=booking_id,
        tenant_id=user["tenant_id"],
        actor_user_id=user["id"],
        actor_role=user["role"],
        details=refund_note,
    )
    return jsonify({
        "ok": True,
        "refund_amount": refund_amount,
        "refund_note": refund_note,
        "booking": _get_booking(booking_id, user["tenant_id"]),
    })


# ── Fare watch / price alerts ─────────────────────────────────────────────────
@app.post("/api/fare-watch")
@require_roles("agent", "supervisor", "admin")
def create_fare_watch():
    user = request.current_user
    data = request.get_json(silent=True) or {}
    origin      = str(data.get("origin", "")).upper().strip()
    destination = str(data.get("destination", "")).upper().strip()
    max_price   = float(data.get("max_price", 0) or 0)
    if not origin or not destination or max_price <= 0:
        return jsonify({"error": "origin, destination and max_price required"}), 400
    watch_id = f"FW-{uuid4().hex[:8].upper()}"
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO fare_watches (id, tenant_id, user_id, origin, destination, max_price)
               VALUES (?,?,?,?,?,?)""",
            (watch_id, user["tenant_id"], user["id"], origin, destination, max_price)
        )
    return jsonify({"ok": True, "id": watch_id, "origin": origin,
                    "destination": destination, "max_price": max_price}), 201


@app.get("/api/fare-watch")
@require_roles("agent", "supervisor", "admin")
def list_fare_watches():
    user = request.current_user
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM fare_watches WHERE tenant_id=? ORDER BY created_at DESC",
            (user["tenant_id"],)
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


@app.post("/api/fare-watch/<watch_id>/delete")
@require_roles("agent", "supervisor", "admin")
def delete_fare_watch(watch_id: str):
    user = request.current_user
    with get_conn() as conn:
        conn.execute(
            "DELETE FROM fare_watches WHERE id=? AND tenant_id=?",
            (watch_id, user["tenant_id"])
        )
    return jsonify({"ok": True})


# ── Booking Notes ────────────────────────────────────────────────────────────
@app.get("/api/bookings/<booking_id>/notes")
@require_roles("agent", "supervisor", "admin")
def get_booking_notes(booking_id: str):
    user = request.current_user
    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM booking_notes WHERE booking_id=? AND tenant_id=? ORDER BY created_at ASC",
            (booking_id, user["tenant_id"])
        ).fetchall()
    return jsonify({"notes": [row_to_dict(r) for r in rows]})


@app.post("/api/bookings/<booking_id>/notes")
@require_roles("agent", "supervisor", "admin")
def add_booking_note(booking_id: str):
    user = request.current_user
    booking = _get_booking(booking_id, user["tenant_id"])
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    data = request.get_json(silent=True) or {}
    note_text = str(data.get("note", "")).strip()
    if not note_text:
        return jsonify({"error": "note required"}), 400
    if len(note_text) > 500:
        return jsonify({"error": "Note max 500 Zeichen"}), 400
    nid = f"BN-{uuid4().hex[:8].upper()}"
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO booking_notes (id, booking_id, tenant_id, user_id, user_email, note) VALUES (?,?,?,?,?,?)",
            (nid, booking_id, user["tenant_id"], user["id"], user["email"], note_text)
        )
    return jsonify({"ok": True, "note_id": nid}), 201


# ── Analytics ─────────────────────────────────────────────────────────────────
@app.get("/api/analytics/bookings")
@require_roles("agent", "supervisor", "finance", "admin")
def analytics_bookings():
    user = request.current_user
    tid  = user["tenant_id"]
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT strftime('%Y-%m-%d', created_at) as day,
                      COUNT(*) as bookings,
                      SUM(CASE WHEN payment_status='paid' THEN paid_price ELSE 0 END) as revenue,
                      SUM(CASE WHEN status='cancelled' THEN 1 ELSE 0 END) as cancelled,
                      SUM(CASE WHEN status='ticketed' THEN 1 ELSE 0 END) as ticketed
               FROM bookings
               WHERE tenant_id=?
               GROUP BY day ORDER BY day DESC LIMIT 30""",
            (tid,)
        ).fetchall()
        top_routes = conn.execute(
            """SELECT flight_id, COUNT(*) as cnt,
                      SUM(CASE WHEN payment_status='paid' THEN paid_price ELSE 0 END) as revenue
               FROM bookings WHERE tenant_id=?
               GROUP BY flight_id ORDER BY cnt DESC LIMIT 5""",
            (tid,)
        ).fetchall()
        agent_rows = conn.execute(
            """SELECT al.actor_user_id as user_id, u.email, COUNT(*) as bookings,
                      SUM(CASE WHEN b.payment_status='paid' THEN b.paid_price ELSE 0 END) as revenue
               FROM audit_logs al
               JOIN bookings b ON b.id = al.entity_id
               JOIN users u ON u.id = al.actor_user_id
               WHERE al.action = 'booking.created' AND b.tenant_id = ?
               GROUP BY al.actor_user_id ORDER BY bookings DESC LIMIT 10""",
            (tid,)
        ).fetchall()
    return jsonify({
        "daily": [row_to_dict(r) for r in rows],
        "top_routes": [row_to_dict(r) for r in top_routes],
        "agent_leaderboard": [row_to_dict(r) for r in agent_rows],
    })


@app.get("/api/admin/analytics")
@require_roles("admin")
def admin_analytics():
    with get_conn() as conn:
        daily = conn.execute(
            """SELECT strftime('%Y-%m-%d', created_at) as day,
                      COUNT(*) as bookings,
                      SUM(CASE WHEN payment_status='paid' THEN paid_price ELSE 0 END) as revenue
               FROM bookings GROUP BY day ORDER BY day DESC LIMIT 30"""
        ).fetchall()
        by_tenant = conn.execute(
            """SELECT t.name as tenant_name, COUNT(b.id) as bookings,
                      SUM(CASE WHEN b.payment_status='paid' THEN b.paid_price ELSE 0 END) as revenue
               FROM bookings b JOIN tenants t ON b.tenant_id=t.id
               GROUP BY b.tenant_id ORDER BY revenue DESC"""
        ).fetchall()
    return jsonify({
        "daily": [row_to_dict(r) for r in daily],
        "by_tenant": [row_to_dict(r) for r in by_tenant],
    })


# ── Notifications ─────────────────────────────────────────────────────────────
@app.get("/api/notifications")
@require_auth
def get_notifications():
    tid = request.current_user["tenant_id"]
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM notifications WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50",
            (tid,)
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


@app.post("/api/notifications/<notif_id>/read")
@require_auth
def mark_read(notif_id: str):
    tid = request.current_user["tenant_id"]
    with get_conn() as conn:
        conn.execute(
            "UPDATE notifications SET read=1 WHERE id=? AND tenant_id=?",
            (notif_id, tid)
        )
    return jsonify({"ok": True})


# ── Webhooks ──────────────────────────────────────────────────────────────────
@app.post("/api/webhooks/stripe")
def stripe_webhook():
    """Simulated Stripe webhook endpoint for payment intent lifecycle events."""
    if not _rate_limit_ok("webhook_stripe", _client_ip(), WEBHOOK_LIMIT_PER_MIN, 60):
        return jsonify({"error": "Webhook rate limit exceeded"}), 429
    data = request.get_json(silent=True) or {}
    event_type = str(data.get("event_type", "")).strip()
    intent_id = str(data.get("payment_intent_id", "")).strip()
    if not event_type or not intent_id:
        return jsonify({"error": "event_type and payment_intent_id required"}), 400

    ok, message, booking = _finalize_payment_intent(intent_id, event_type)
    if not ok and message == "payment intent not found":
        return jsonify({"error": message}), 404
    if not ok:
        if booking:
            _audit_log(
                action="payment.webhook_failed",
                entity_type="booking",
                entity_id=booking.get("id"),
                tenant_id=booking.get("tenant_id"),
                actor_role="system",
                details=f"intent={intent_id}; event={event_type}",
            )
        return jsonify({"ok": False, "status": "failed", "message": message, "booking": booking}), 200
    _audit_log(
        action="payment.webhook_succeeded",
        entity_type="booking",
        entity_id=booking.get("id") if booking else None,
        tenant_id=booking.get("tenant_id") if booking else None,
        actor_role="system",
        details=f"intent={intent_id}; event={event_type}",
    )
    return jsonify({"ok": True, "status": "succeeded", "message": message, "booking": booking}), 200


@app.post("/api/webhooks/schedule-change")
def schedule_change_webhook():
    if not _rate_limit_ok("webhook_schedule", _client_ip(), WEBHOOK_LIMIT_PER_MIN, 60):
        return jsonify({"error": "Webhook rate limit exceeded"}), 429
    data   = request.get_json(silent=True) or {}
    tid    = str(data.get("tenant_id",    "")).strip()
    flight = str(data.get("flight_number","")).strip()
    change = str(data.get("change_type",  "")).strip()
    detail = str(data.get("details",      "")).strip()
    if not (tid and flight and change):
        return jsonify({"error": "tenant_id, flight_number, change_type required"}), 400
    if not _get_tenant(tid):
        return jsonify({"error": "Tenant not found"}), 404
    nid = f"NT-{uuid4().hex[:8]}"
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO notifications (id, tenant_id, title, body) VALUES (?,?,?,?)",
            (nid, tid, f"Flight {flight}: {change}", detail)
        )
    _push_event(tid, "SCHEDULE_CHANGE", f"{flight} – {change}")
    return jsonify({"ok": True})


# ── Admin: Tenants ────────────────────────────────────────────────────────────
@app.get("/api/admin/tenants")
@require_admin
def admin_list_tenants():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM tenants ORDER BY created_at DESC").fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


@app.post("/api/admin/tenants")
@require_admin
def admin_create_tenant():
    data        = request.get_json(silent=True) or {}
    name        = str(data.get("name",           "")).strip()
    email       = str(data.get("email",          "")).strip()
    agent_email = str(data.get("agent_email",    "")).strip()
    agent_pw    = str(data.get("agent_password", ""))
    markup      = float(data.get("markup_percent", 8.0))
    if not all([name, email, agent_email, agent_pw]):
        return jsonify({"error": "name, email, agent_email, agent_password required"}), 400
    tid = f"t-{uuid4().hex[:8]}"
    uid = f"u-{uuid4().hex[:8]}"
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO tenants (id, name, email, status, markup_percent) VALUES (?,?,?,'active',?)",
            (tid, name, email, markup)
        )
        conn.execute(
            "INSERT INTO users (id, tenant_id, email, hashed_password, role) VALUES (?,?,?,?,'agent')",
            (uid, tid, agent_email, hash_password(agent_pw))
        )
    _push_event(tid, "TENANT_CREATED", f"New agency: {name}")
    _audit_log(
        action="tenant.created_by_admin",
        entity_type="tenant",
        entity_id=tid,
        tenant_id=tid,
        actor_user_id=request.current_user["id"],
        actor_role=request.current_user["role"],
        details=f"name={name}; agent_email={agent_email}",
    )
    return jsonify({"ok": True, "tenant": _get_tenant(tid), "agent_user_id": uid}), 201


@app.get("/api/admin/users")
@require_admin
def admin_list_users():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT u.id, u.tenant_id, t.name AS tenant_name, u.email, u.role, u.created_at
               FROM users u JOIN tenants t ON u.tenant_id=t.id
               ORDER BY u.created_at DESC LIMIT 300"""
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


@app.post("/api/admin/tenants/<tenant_id>/users")
@require_admin
def admin_create_user(tenant_id: str):
    if not _get_tenant(tenant_id):
        return jsonify({"error": "Tenant not found"}), 404
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip()
    password = str(data.get("password", ""))
    role = str(data.get("role", "agent")).strip().lower()
    if role not in ("agent", "supervisor", "finance"):
        return jsonify({"error": "role must be agent, supervisor, or finance"}), 400
    if not email or not password:
        return jsonify({"error": "email and password required"}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400
    if _get_user_by_email(email):
        return jsonify({"error": "Email already registered"}), 409

    uid = f"u-{uuid4().hex[:8]}"
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO users (id, tenant_id, email, hashed_password, role) VALUES (?,?,?,?,?)",
            (uid, tenant_id, email, hash_password(password), role)
        )
    _audit_log(
        action="tenant.user_created",
        entity_type="user",
        entity_id=uid,
        tenant_id=tenant_id,
        actor_user_id=request.current_user["id"],
        actor_role=request.current_user["role"],
        details=f"email={email}; role={role}",
    )
    return jsonify({
        "ok": True,
        "user": {
            "id": uid,
            "tenant_id": tenant_id,
            "email": email,
            "role": role,
        }
    }), 201


@app.post("/api/admin/users/<user_id>/role")
@require_admin
def admin_update_user_role(user_id: str):
    user = _get_user(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user["role"] == "admin":
        return jsonify({"error": "Admin role cannot be changed"}), 400

    data = request.get_json(silent=True) or {}
    role = str(data.get("role", "")).strip().lower()
    if role not in ("agent", "supervisor", "finance"):
        return jsonify({"error": "role must be agent, supervisor, or finance"}), 400

    with get_conn() as conn:
        conn.execute("UPDATE users SET role=? WHERE id=?", (role, user_id))
    _audit_log(
        action="tenant.user_role_changed",
        entity_type="user",
        entity_id=user_id,
        tenant_id=user["tenant_id"],
        actor_user_id=request.current_user["id"],
        actor_role=request.current_user["role"],
        details=f"email={user['email']}; role={role}",
    )
    updated = _get_user(user_id)
    return jsonify({
        "ok": True,
        "user": {
            "id": updated["id"],
            "tenant_id": updated["tenant_id"],
            "email": updated["email"],
            "role": updated["role"],
        }
    })


@app.post("/api/admin/tenants/<tenant_id>/status")
@require_admin
def admin_set_status(tenant_id: str):
    if not _get_tenant(tenant_id):
        return jsonify({"error": "Tenant not found"}), 404
    data   = request.get_json(silent=True) or {}
    status = str(data.get("status", "")).strip()
    if status not in ("active", "suspended"):
        return jsonify({"error": "status must be 'active' or 'suspended'"}), 400
    with get_conn() as conn:
        conn.execute("UPDATE tenants SET status=? WHERE id=?", (status, tenant_id))
    _push_event(tenant_id, "STATUS_CHANGED", f"→ {status}")
    _audit_log(
        action="tenant.status_changed",
        entity_type="tenant",
        entity_id=tenant_id,
        tenant_id=tenant_id,
        actor_user_id=request.current_user["id"],
        actor_role=request.current_user["role"],
        details=f"status={status}",
    )
    return jsonify({"ok": True, "tenant": _get_tenant(tenant_id)})


@app.post("/api/admin/markup")
@require_admin
def admin_set_markup():
    data   = request.get_json(silent=True) or {}
    markup = float(data.get("markup_percent", 0))
    tid    = data.get("tenant_id")
    if not (0 <= markup <= 40):
        return jsonify({"error": "markup_percent must be 0–40"}), 400
    with get_conn() as conn:
        if tid:
            if not _get_tenant(str(tid)):
                return jsonify({"error": "Tenant not found"}), 404
            conn.execute("UPDATE tenants SET markup_percent=? WHERE id=?", (markup, str(tid)))
            _audit_log(
                action="tenant.markup_changed",
                entity_type="tenant",
                entity_id=str(tid),
                tenant_id=str(tid),
                actor_user_id=request.current_user["id"],
                actor_role=request.current_user["role"],
                details=f"markup={markup}",
            )
            return jsonify({"ok": True, "mode": "single", "tenant": _get_tenant(str(tid))})
        conn.execute("UPDATE tenants SET markup_percent=?", (markup,))
    _audit_log(
        action="tenant.markup_changed_global",
        entity_type="tenant",
        entity_id="*",
        actor_user_id=request.current_user["id"],
        actor_role=request.current_user["role"],
        details=f"markup={markup}",
    )
    return jsonify({"ok": True, "mode": "global", "markup_percent": markup})


# ── Admin: Live monitor ───────────────────────────────────────────────────────
@app.get("/api/admin/live-monitor")
@require_admin
def admin_live_monitor():
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM live_events ORDER BY created_at DESC LIMIT 100"
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


# ── Admin: Stats ──────────────────────────────────────────────────────────────
@app.get("/api/admin/stats")
@require_admin
def admin_stats():
    with get_conn() as conn:
        total_tenants  = conn.execute("SELECT COUNT(*) FROM tenants").fetchone()[0]
        active_tenants = conn.execute("SELECT COUNT(*) FROM tenants WHERE status='active'").fetchone()[0]
        total_bookings = conn.execute("SELECT COUNT(*) FROM bookings").fetchone()[0]
        total_revenue  = conn.execute("SELECT COALESCE(SUM(paid_price),0) FROM bookings WHERE payment_status='paid'").fetchone()[0]
        ticketed       = conn.execute("SELECT COUNT(*) FROM bookings WHERE status='ticketed'").fetchone()[0]
    return jsonify({
        "total_tenants":  total_tenants,
        "active_tenants": active_tenants,
        "total_bookings": total_bookings,
        "total_revenue":  round(float(total_revenue), 2),
        "ticketed":       ticketed,
    })


@app.get("/api/admin/payments")
@require_admin
def admin_payments():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT p.*, t.name AS tenant_name
               FROM payments p JOIN tenants t ON p.tenant_id=t.id
               ORDER BY p.created_at DESC LIMIT 150"""
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


@app.get("/api/billing/payments")
@require_auth
def my_payments():
    tid = request.current_user["tenant_id"]
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM payments WHERE tenant_id=? ORDER BY created_at DESC LIMIT 150",
            (tid,)
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


@app.get("/api/billing/summary")
@require_auth
def my_billing_summary():
    tid = request.current_user["tenant_id"]
    with get_conn() as conn:
        invoice_count = conn.execute(
            "SELECT COUNT(*) FROM invoices WHERE tenant_id=?",
            (tid,)
        ).fetchone()[0]
        paid_total = conn.execute(
            "SELECT COALESCE(SUM(amount_eur),0) FROM invoices WHERE tenant_id=? AND status='paid'",
            (tid,)
        ).fetchone()[0]
        payment_count = conn.execute(
            "SELECT COUNT(*) FROM payments WHERE tenant_id=? AND status='succeeded'",
            (tid,)
        ).fetchone()[0]
        booking_revenue = conn.execute(
            "SELECT COALESCE(SUM(paid_price),0) FROM bookings WHERE tenant_id=? AND payment_status='paid'",
            (tid,)
        ).fetchone()[0]
    return jsonify({
        "invoice_count": invoice_count,
        "paid_invoice_total": round(float(paid_total), 2),
        "payment_count": payment_count,
        "booking_revenue": round(float(booking_revenue), 2),
    })


@app.get("/api/admin/audit-logs")
@require_admin
def admin_audit_logs():
    tenant_id = str(request.args.get("tenant_id", "")).strip()
    action_q = str(request.args.get("action", "")).strip().lower()
    from_date = str(request.args.get("from_date", "")).strip()
    to_date = str(request.args.get("to_date", "")).strip()
    limit = int(request.args.get("limit", 150))
    limit = max(1, min(limit, 500))

    try:
        from_bound, to_bound = _audit_date_bounds(from_date, to_date)
    except ValueError:
        return jsonify({"error": "from_date/to_date must use YYYY-MM-DD"}), 400

    where_parts = []
    params: list[object] = []
    if tenant_id:
        where_parts.append("tenant_id=?")
        params.append(tenant_id)
    if action_q:
        where_parts.append("lower(action) LIKE ?")
        params.append(f"%{action_q}%")
    if from_bound:
        where_parts.append("created_at >= ?")
        params.append(from_bound)
    if to_bound:
        where_parts.append("created_at <= ?")
        params.append(to_bound)

    where_sql = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""
    params.append(limit)
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM audit_logs{where_sql} ORDER BY created_at DESC LIMIT ?",
            tuple(params)
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


# ── Admin: Billing (Stripe simulation) ───────────────────────────────────────
@app.post("/api/admin/billing/sync")
@require_admin
def admin_billing_sync():
    """Simulate monthly Stripe billing cycle for all active tenants."""
    period = datetime.now(timezone.utc).strftime("%Y-%m")
    with get_conn() as conn:
        tenants = conn.execute(
            "SELECT * FROM tenants WHERE status='active'"
        ).fetchall()
        invoices_created = 0
        for t in tenants:
            existing = conn.execute(
                "SELECT id FROM invoices WHERE tenant_id=? AND period=?",
                (t["id"], period)
            ).fetchone()
            if not existing:
                inv_id = f"INV-{uuid4().hex[:8].upper()}"
                conn.execute(
                    "INSERT INTO invoices (id, tenant_id, period, amount_eur, status) VALUES (?,?,?,?,'paid')",
                    (inv_id, t["id"], period, MONTHLY_FEE)
                )
                invoices_created += 1
                _audit_log(
                    action="billing.invoice_generated",
                    entity_type="invoice",
                    entity_id=inv_id,
                    tenant_id=t["id"],
                    actor_user_id=request.current_user["id"],
                    actor_role=request.current_user["role"],
                    details=f"period={period}; amount={MONTHLY_FEE}",
                )
    return jsonify({
        "ok":              True,
        "period":          period,
        "invoices_created": invoices_created,
        "monthly_fee_eur": MONTHLY_FEE,
        "charged_tenants": invoices_created,
    })


@app.get("/api/admin/billing/invoices")
@require_admin
def admin_list_invoices():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT i.*, t.name as tenant_name
               FROM invoices i JOIN tenants t ON i.tenant_id=t.id
               ORDER BY i.created_at DESC LIMIT 100"""
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


@app.get("/api/admin/export/bookings.csv")
@require_admin
def admin_export_bookings_csv():
    tenant_id = str(request.args.get("tenant_id", "")).strip()
    with get_conn() as conn:
        if tenant_id:
            rows = conn.execute(
                """SELECT b.id, b.tenant_id, t.name AS tenant_name, b.flight_id, b.paid_price,
                          b.status, b.payment_status, b.ticket_number, b.created_at, b.last_action,
                          b.passenger_names
                   FROM bookings b JOIN tenants t ON b.tenant_id=t.id
                   WHERE b.tenant_id=?
                   ORDER BY b.created_at DESC""",
                (tenant_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT b.id, b.tenant_id, t.name AS tenant_name, b.flight_id, b.paid_price,
                          b.status, b.payment_status, b.ticket_number, b.created_at, b.last_action,
                          b.passenger_names
                   FROM bookings b JOIN tenants t ON b.tenant_id=t.id
                   ORDER BY b.created_at DESC"""
            ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "booking_id",
        "tenant_id",
        "tenant_name",
        "flight_id",
        "paid_price_eur",
        "status",
        "payment_status",
        "ticket_number",
        "created_at",
        "last_action",
        "passenger_names",
    ])
    for r in rows:
        row = row_to_dict(r)
        names = ", ".join(json.loads(row["passenger_names"])) if row.get("passenger_names") else ""
        writer.writerow([
            row["id"],
            row["tenant_id"],
            row["tenant_name"],
            row["flight_id"],
            row["paid_price"],
            row["status"],
            row["payment_status"],
            row["ticket_number"] or "",
            row["created_at"],
            row["last_action"],
            names,
        ])

    filename = f"bookings-{tenant_id or 'all'}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/admin/export/invoices.csv")
@require_admin
def admin_export_invoices_csv():
    tenant_id = str(request.args.get("tenant_id", "")).strip()
    with get_conn() as conn:
        if tenant_id:
            rows = conn.execute(
                """SELECT i.id, i.tenant_id, t.name AS tenant_name, i.period,
                          i.amount_eur, i.status, i.created_at
                   FROM invoices i JOIN tenants t ON i.tenant_id=t.id
                   WHERE i.tenant_id=?
                   ORDER BY i.created_at DESC""",
                (tenant_id,)
            ).fetchall()
        else:
            rows = conn.execute(
                """SELECT i.id, i.tenant_id, t.name AS tenant_name, i.period,
                          i.amount_eur, i.status, i.created_at
                   FROM invoices i JOIN tenants t ON i.tenant_id=t.id
                   ORDER BY i.created_at DESC"""
            ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "invoice_id",
        "tenant_id",
        "tenant_name",
        "period",
        "amount_eur",
        "status",
        "created_at",
    ])
    for r in rows:
        row = row_to_dict(r)
        writer.writerow([
            row["id"],
            row["tenant_id"],
            row["tenant_name"],
            row["period"],
            row["amount_eur"],
            row["status"],
            row["created_at"],
        ])

    filename = f"invoices-{tenant_id or 'all'}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/admin/export/audit-logs.csv")
@require_admin
def admin_export_audit_logs_csv():
    action_q = str(request.args.get("action", "")).strip().lower()
    tenant_id = str(request.args.get("tenant_id", "")).strip()
    from_date = str(request.args.get("from_date", "")).strip()
    to_date = str(request.args.get("to_date", "")).strip()
    limit = int(request.args.get("limit", 1000))
    limit = max(1, min(limit, 5000))

    try:
        from_bound, to_bound = _audit_date_bounds(from_date, to_date)
    except ValueError:
        return jsonify({"error": "from_date/to_date must use YYYY-MM-DD"}), 400

    where_parts = []
    params: list[object] = []
    if tenant_id:
        where_parts.append("tenant_id=?")
        params.append(tenant_id)
    if action_q:
        where_parts.append("lower(action) LIKE ?")
        params.append(f"%{action_q}%")
    if from_bound:
        where_parts.append("created_at >= ?")
        params.append(from_bound)
    if to_bound:
        where_parts.append("created_at <= ?")
        params.append(to_bound)

    where_sql = (" WHERE " + " AND ".join(where_parts)) if where_parts else ""
    params.append(limit)

    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT * FROM audit_logs{where_sql} ORDER BY created_at DESC LIMIT ?",
            tuple(params)
        ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "audit_id",
        "created_at",
        "tenant_id",
        "actor_user_id",
        "actor_role",
        "action",
        "entity_type",
        "entity_id",
        "details",
    ])
    for r in rows:
        row = row_to_dict(r)
        writer.writerow([
            row.get("id", ""),
            row.get("created_at", ""),
            row.get("tenant_id", ""),
            row.get("actor_user_id", ""),
            row.get("actor_role", ""),
            row.get("action", ""),
            row.get("entity_type", ""),
            row.get("entity_id", ""),
            row.get("details", ""),
        ])

    filename = f"audit-logs-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/billing/invoices")
@require_auth
def my_invoices():
    tid = request.current_user["tenant_id"]
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM invoices WHERE tenant_id=? ORDER BY created_at DESC",
            (tid,)
        ).fetchall()
    return jsonify({"count": len(rows), "results": [row_to_dict(r) for r in rows]})


@app.get("/api/billing/export/invoices.csv")
@require_auth
def export_my_invoices_csv():
    tid = request.current_user["tenant_id"]
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM invoices WHERE tenant_id=? ORDER BY created_at DESC",
            (tid,)
        ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["invoice_id", "period", "amount_eur", "status", "created_at"])
    for r in rows:
        row = row_to_dict(r)
        writer.writerow([row["id"], row["period"], row["amount_eur"], row["status"], row["created_at"]])

    filename = f"tenant-invoices-{tid}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@app.get("/api/billing/export/payments.csv")
@require_auth
def export_my_payments_csv():
    tid = request.current_user["tenant_id"]
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM payments WHERE tenant_id=? ORDER BY created_at DESC",
            (tid,)
        ).fetchall()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["payment_id", "booking_id", "payment_intent_id", "amount_eur", "currency", "status", "provider", "created_at"])
    for r in rows:
        row = row_to_dict(r)
        writer.writerow([
            row["id"], row["booking_id"], row["payment_intent_id"], row["amount_eur"],
            row["currency"], row["status"], row["provider"], row["created_at"]
        ])

    filename = f"tenant-payments-{tid}-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}.csv"
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── Serve SPA ─────────────────────────────────────────────────────────────────
@app.get("/")
def serve_index():
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return send_from_directory(str(STATIC_DIR), "index.html")
    return jsonify({
        "service": "flycentral-api",
        "status": "ok",
        "message": "API is running. Use /api/health or /api/auth/login.",
    })


@app.get("/api/health")
def health_check():
    with get_conn() as conn:
        conn.execute("SELECT 1").fetchone()
    return jsonify({"status": "ok", "service": "flycentral-api"})


@app.get("/<path:path>")
def serve_static(path: str):
    target = STATIC_DIR / path
    if target.is_file():
        return send_from_directory(str(STATIC_DIR), path)
    index_file = STATIC_DIR / "index.html"
    if index_file.is_file():
        return send_from_directory(str(STATIC_DIR), "index.html")
    return jsonify({"error": "Not found"}), 404


# ── Seed initial data if DB is empty ──────────────────────────────────────────
def _seed():
    with get_conn() as conn:
        if conn.execute("SELECT COUNT(*) FROM tenants").fetchone()[0] > 0:
            return  # already seeded

        t_data = [
            ("t-berlin", "SkyBerlin Travel",  "berlin@demo.com",  "active",    7.0),
            ("t-dubai",  "Desert Wings",       "dubai@demo.com",   "active",   10.0),
            ("t-london", "BridgeAir Agency",   "london@demo.com",  "suspended", 6.0),
        ]
        for row in t_data:
            conn.execute(
                "INSERT INTO tenants (id, name, email, status, markup_percent) VALUES (?,?,?,?,?)",
                row
            )

        u_data = [
            ("u-berlin", "t-berlin", "agent@berlin.com",     hash_password("demo1234"),  "agent"),
            ("u-dubai",  "t-dubai",  "agent@dubai.com",      hash_password("demo1234"),  "agent"),
            ("u-admin",  "t-berlin", "admin@flycentral.com", hash_password("admin1234"), "admin"),
            ("u-super",  "t-berlin", "supervisor@berlin.com", hash_password("demo1234"), "supervisor"),
            ("u-fin",    "t-berlin", "finance@berlin.com",    hash_password("demo1234"), "finance"),
        ]
        for row in u_data:
            conn.execute(
                "INSERT INTO users (id, tenant_id, email, hashed_password, role) VALUES (?,?,?,?,?)",
                row
            )


def _ensure_demo_users() -> None:
    demo_users = [
        ("u-super", "t-berlin", "supervisor@berlin.com", "demo1234", "supervisor"),
        ("u-fin", "t-berlin", "finance@berlin.com", "demo1234", "finance"),
    ]
    with get_conn() as conn:
        for user_id, tenant_id, email, password, role in demo_users:
            existing = conn.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
            if existing:
                continue
            tenant = conn.execute("SELECT id FROM tenants WHERE id=?", (tenant_id,)).fetchone()
            if not tenant:
                continue
            conn.execute(
                "INSERT INTO users (id, tenant_id, email, hashed_password, role) VALUES (?,?,?,?,?)",
                (user_id, tenant_id, email, hash_password(password), role)
            )


# ── Auto-initialize DB (runs whether started via gunicorn or directly) ────────
init_db()
_seed()
_ensure_demo_users()

# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 4000))
    print(f"\n  FlyCentral SaaS v0.3 startet auf http://localhost:{port}\n")
    print("  Demo-Zugaenge:")
    print("    Agent : agent@berlin.com    / demo1234")
    print("    Admin : admin@flycentral.com / admin1234")
    print("    Super : supervisor@berlin.com / demo1234")
    print("    Finance : finance@berlin.com / demo1234\n")
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=True)
