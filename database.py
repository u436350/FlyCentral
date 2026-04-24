"""SQLite persistence layer for FlyCentral – Python stdlib only, no pip needed."""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "flycentral.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS tenants (
            id              TEXT PRIMARY KEY,
            name            TEXT NOT NULL,
            email           TEXT NOT NULL UNIQUE,
            status          TEXT NOT NULL DEFAULT 'active',
            markup_percent  REAL NOT NULL DEFAULT 8.0,
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS users (
            id              TEXT PRIMARY KEY,
            tenant_id       TEXT NOT NULL REFERENCES tenants(id),
            email           TEXT NOT NULL UNIQUE,
            hashed_password TEXT NOT NULL,
            role            TEXT NOT NULL DEFAULT 'agent',
            created_at      TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS bookings (
            id               TEXT PRIMARY KEY,
            tenant_id        TEXT NOT NULL REFERENCES tenants(id),
            flight_id        TEXT NOT NULL,
            passenger_names  TEXT NOT NULL,
            paid_price       REAL NOT NULL,
            status           TEXT NOT NULL DEFAULT 'reserved',
            ticket_number    TEXT,
            payment_status   TEXT NOT NULL DEFAULT 'unpaid',
            payment_intent   TEXT,
            created_at       TEXT NOT NULL DEFAULT (datetime('now')),
            last_action      TEXT NOT NULL DEFAULT 'created'
        );

        CREATE TABLE IF NOT EXISTS notifications (
            id          TEXT PRIMARY KEY,
            tenant_id   TEXT NOT NULL REFERENCES tenants(id),
            title       TEXT NOT NULL,
            body        TEXT NOT NULL,
            read        INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS live_events (
            id          TEXT PRIMARY KEY,
            tenant_id   TEXT NOT NULL,
            type        TEXT NOT NULL,
            message     TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS invoices (
            id           TEXT PRIMARY KEY,
            tenant_id    TEXT NOT NULL REFERENCES tenants(id),
            period       TEXT NOT NULL,
            amount_eur   REAL NOT NULL,
            status       TEXT NOT NULL DEFAULT 'pending',
            created_at   TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS payments (
            id                TEXT PRIMARY KEY,
            tenant_id         TEXT NOT NULL REFERENCES tenants(id),
            booking_id        TEXT NOT NULL REFERENCES bookings(id),
            payment_intent_id TEXT NOT NULL UNIQUE,
            amount_eur        REAL NOT NULL,
            currency          TEXT NOT NULL DEFAULT 'EUR',
            status            TEXT NOT NULL DEFAULT 'requires_action',
            provider          TEXT NOT NULL DEFAULT 'stripe_sim',
            created_at        TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS audit_logs (
            id             TEXT PRIMARY KEY,
            tenant_id      TEXT,
            actor_user_id  TEXT,
            actor_role     TEXT,
            action         TEXT NOT NULL,
            entity_type    TEXT NOT NULL,
            entity_id      TEXT,
            details        TEXT,
            created_at     TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS fare_watches (
            id          TEXT PRIMARY KEY,
            tenant_id   TEXT NOT NULL REFERENCES tenants(id),
            user_id     TEXT NOT NULL REFERENCES users(id),
            origin      TEXT NOT NULL,
            destination TEXT NOT NULL,
            max_price   REAL NOT NULL,
            triggered   INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS booking_notes (
            id          TEXT PRIMARY KEY,
            booking_id  TEXT NOT NULL REFERENCES bookings(id),
            tenant_id   TEXT NOT NULL,
            user_id     TEXT NOT NULL,
            user_email  TEXT NOT NULL,
            note        TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """)


def row_to_dict(row: sqlite3.Row) -> dict:
    return dict(row)
