from __future__ import annotations

import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

FLIGHT_DATA_PROVIDER = os.environ.get("FLIGHT_DATA_PROVIDER", "auto").strip().lower()
AMADEUS_BASE_URL = os.environ.get("AMADEUS_BASE_URL", "https://test.api.amadeus.com").rstrip("/")
AMADEUS_CLIENT_ID = os.environ.get("AMADEUS_CLIENT_ID", "").strip()
AMADEUS_CLIENT_SECRET = os.environ.get("AMADEUS_CLIENT_SECRET", "").strip()
AMADEUS_MAX_RESULTS = max(1, min(int(os.environ.get("AMADEUS_MAX_RESULTS", "25")), 50))
AMADEUS_TOKEN_CACHE: dict[str, object] = {"access_token": None, "expires_at": 0.0}

# Duffel
DUFFEL_ACCESS_TOKEN = os.environ.get("DUFFEL_ACCESS_TOKEN", "").strip()
DUFFEL_BASE_URL = os.environ.get("DUFFEL_BASE_URL", "https://api.duffel.com").rstrip("/")
DUFFEL_MAX_RESULTS = max(1, min(int(os.environ.get("DUFFEL_MAX_RESULTS", "25")), 50))


def amadeus_configured() -> bool:
    return bool(AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET)


def duffel_configured() -> bool:
    return bool(DUFFEL_ACCESS_TOKEN)


def active_flight_provider() -> str:
    if FLIGHT_DATA_PROVIDER == "demo":
        return "demo"
    if FLIGHT_DATA_PROVIDER == "duffel" and duffel_configured():
        return "duffel"
    if FLIGHT_DATA_PROVIDER == "amadeus" and amadeus_configured():
        return "amadeus"
    if FLIGHT_DATA_PROVIDER == "auto":
        if duffel_configured():
            return "duffel"
        if amadeus_configured():
            return "amadeus"
    return "demo"


def flight_provider_status() -> dict[str, object]:
    active_provider = active_flight_provider()
    return {
        "configured_provider": FLIGHT_DATA_PROVIDER,
        "active_provider": active_provider,
        "amadeus_configured": amadeus_configured(),
        "duffel_configured": duffel_configured(),
        "live_market_enabled": active_provider in ("amadeus", "duffel"),
        "live_search_requirements": ["origin", "destination", "departure_date"],
    }


def build_catalog_metadata(catalog: dict[str, dict[str, object]]) -> dict[str, object]:
    meta = flight_provider_status()
    meta.update(
        {
            "airlines": sorted({str(f["airline"]) for f in catalog.values()}),
            "origins": sorted({str(f["origin"]) for f in catalog.values()}),
            "destinations": sorted({str(f["destination"]) for f in catalog.values()}),
            "flight_count": len(catalog),
        }
    )
    return meta


def _http_json(url: str, *, method: str = "GET", headers: dict[str, str] | None = None, body: bytes | None = None) -> dict:
    req = urllib.request.Request(url, data=body, headers=headers or {}, method=method)
    with urllib.request.urlopen(req, timeout=25) as response:
        payload = response.read().decode("utf-8")
    return json.loads(payload) if payload else {}


def _get_amadeus_access_token() -> str:
    now_ts = time.time()
    cached_token = str(AMADEUS_TOKEN_CACHE.get("access_token") or "")
    expires_at = float(AMADEUS_TOKEN_CACHE.get("expires_at") or 0.0)
    if cached_token and expires_at > now_ts + 60:
        return cached_token

    body = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": AMADEUS_CLIENT_ID,
            "client_secret": AMADEUS_CLIENT_SECRET,
        }
    ).encode("utf-8")
    data = _http_json(
        f"{AMADEUS_BASE_URL}/v1/security/oauth2/token",
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        body=body,
    )
    access_token = str(data.get("access_token", "")).strip()
    expires_in = int(data.get("expires_in", 1800) or 1800)
    if not access_token:
        raise ValueError("Amadeus token response did not include access_token")
    AMADEUS_TOKEN_CACHE["access_token"] = access_token
    AMADEUS_TOKEN_CACHE["expires_at"] = now_ts + expires_in
    return access_token


def _iso_duration_minutes(departure_at: str, arrival_at: str) -> int:
    dep = datetime.fromisoformat(departure_at.replace("Z", "+00:00"))
    arr = datetime.fromisoformat(arrival_at.replace("Z", "+00:00"))
    return max(1, int((arr - dep).total_seconds() // 60))


def _apply_markup(flight_row: dict[str, object], tenant: dict | None) -> dict[str, object]:
    markup = tenant["markup_percent"] if tenant else 8.0
    base_price = float(flight_row["base_price"])
    row = dict(flight_row)
    row["final_price"] = round(base_price * (1 + markup / 100), 2)
    row["markup_percent"] = markup
    return row


def _search_demo_flights(
    catalog: dict[str, dict[str, object]],
    tenant: dict | None,
    *,
    origin: str,
    destination: str,
    airline_q: str,
    max_price: float,
    max_dur: int,
    sort_by: str,
) -> list[dict[str, object]]:
    results: list[dict[str, object]] = []
    for flight in catalog.values():
        if origin and str(flight["origin"]).upper() != origin:
            continue
        if destination and str(flight["destination"]).upper() != destination:
            continue
        if airline_q and airline_q not in str(flight["airline"]).lower():
            continue
        if float(flight["base_price"]) > max_price:
            continue
        if int(flight["duration_minutes"]) > max_dur:
            continue
        results.append(_apply_markup(flight, tenant))

    key = "duration_minutes" if sort_by == "duration" else "final_price"
    results.sort(key=lambda item: item[key])
    return results


def _search_amadeus_flights(
    tenant: dict | None,
    *,
    origin: str,
    destination: str,
    departure_date: str,
    airline_q: str,
    max_price: float,
    max_dur: int,
    sort_by: str,
) -> list[dict[str, object]]:
    token = _get_amadeus_access_token()
    query = urllib.parse.urlencode(
        {
            "originLocationCode": origin,
            "destinationLocationCode": destination,
            "departureDate": departure_date,
            "adults": 1,
            "nonStop": "false",
            "max": AMADEUS_MAX_RESULTS,
            "currencyCode": "EUR",
        }
    )
    payload = _http_json(
        f"{AMADEUS_BASE_URL}/v2/shopping/flight-offers?{query}",
        headers={"Authorization": f"Bearer {token}"},
    )
    offers = payload.get("data") or []
    results: list[dict[str, object]] = []
    for index, offer in enumerate(offers, start=1):
        itineraries = offer.get("itineraries") or []
        if not itineraries:
            continue
        segments = itineraries[0].get("segments") or []
        if not segments:
            continue
        first_segment = segments[0]
        last_segment = segments[-1]
        departure_at = str(first_segment.get("departure", {}).get("at", ""))
        arrival_at = str(last_segment.get("arrival", {}).get("at", ""))
        if not departure_at or not arrival_at:
            continue
        airline = str(first_segment.get("carrierCode") or (offer.get("validatingAirlineCodes") or ["LIVE"])[0])
        base_price = float(offer.get("price", {}).get("grandTotal") or 0)
        row = {
            "id": f"AM-{index}",
            "origin": str(first_segment.get("departure", {}).get("iataCode", origin)),
            "destination": str(last_segment.get("arrival", {}).get("iataCode", destination)),
            "departure_at": departure_at,
            "arrival_at": arrival_at,
            "airline": airline,
            "base_price": base_price,
            "duration_minutes": _iso_duration_minutes(departure_at, arrival_at),
            "provider": "amadeus",
            "provider_offer_id": str(offer.get("id", f"offer-{index}")),
            "stops": max(0, len(segments) - 1),
        }
        if airline_q and airline_q not in airline.lower():
            continue
        if base_price > max_price:
            continue
        if int(row["duration_minutes"]) > max_dur:
            continue
        results.append(_apply_markup(row, tenant))

    key = "duration_minutes" if sort_by == "duration" else "final_price"
    results.sort(key=lambda item: item[key])
    return results


def _search_duffel_flights(
    tenant: dict | None,
    *,
    origin: str,
    destination: str,
    departure_date: str,
    airline_q: str,
    max_price: float,
    max_dur: int,
    sort_by: str,
) -> list[dict[str, object]]:
    headers = {
        "Authorization": f"Bearer {DUFFEL_ACCESS_TOKEN}",
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = json.dumps({
        "data": {
            "slices": [{"origin": origin, "destination": destination, "departure_date": departure_date}],
            "passengers": [{"type": "adult"}],
            "cabin_class": "economy",
        }
    }).encode("utf-8")
    payload = _http_json(
        f"{DUFFEL_BASE_URL}/air/offer_requests?return_offers=true",
        method="POST",
        headers=headers,
        body=body,
    )
    offers = (payload.get("data") or {}).get("offers") or []
    results: list[dict[str, object]] = []
    for index, offer in enumerate(offers[:DUFFEL_MAX_RESULTS], start=1):
        slices = offer.get("slices") or []
        if not slices:
            continue
        segments = slices[0].get("segments") or []
        if not segments:
            continue
        first_seg = segments[0]
        last_seg = segments[-1]
        departure_at = str(first_seg.get("departing_at", ""))
        arrival_at = str(last_seg.get("arriving_at", ""))
        if not departure_at or not arrival_at:
            continue
        airline = str((offer.get("owner") or {}).get("iata_code") or "XX")
        base_price = float(offer.get("total_amount") or 0)
        duration_minutes = _iso_duration_minutes(departure_at, arrival_at)
        row = {
            "id": f"DF-{index}",
            "origin": str(first_seg.get("origin", {}).get("iata_code", origin)),
            "destination": str(last_seg.get("destination", {}).get("iata_code", destination)),
            "departure_at": departure_at,
            "arrival_at": arrival_at,
            "airline": airline,
            "base_price": base_price,
            "duration_minutes": duration_minutes,
            "provider": "duffel",
            "provider_offer_id": str(offer.get("id", f"duffel-{index}")),
            "stops": max(0, len(segments) - 1),
        }
        if airline_q and airline_q not in airline.lower():
            continue
        if base_price > max_price:
            continue
        if duration_minutes > max_dur:
            continue
        results.append(_apply_markup(row, tenant))

    key = "duration_minutes" if sort_by == "duration" else "final_price"
    results.sort(key=lambda item: item[key])
    return results


def search_market_flights(
    catalog: dict[str, dict[str, object]],
    tenant: dict | None,
    *,
    origin: str,
    destination: str,
    departure_date: str,
    airline_q: str,
    max_price: float,
    max_dur: int,
    sort_by: str,
) -> list[dict[str, object]]:
    provider = active_flight_provider()
    if provider in ("amadeus", "duffel") and origin and destination and departure_date:
        if provider == "duffel":
            return _search_duffel_flights(
                tenant,
                origin=origin,
                destination=destination,
                departure_date=departure_date,
                airline_q=airline_q,
                max_price=max_price,
                max_dur=max_dur,
                sort_by=sort_by,
            )
        return _search_amadeus_flights(
            tenant,
            origin=origin,
            destination=destination,
            departure_date=departure_date,
            airline_q=airline_q,
            max_price=max_price,
            max_dur=max_dur,
            sort_by=sort_by,
        )
    return _search_demo_flights(
        catalog,
        tenant,
        origin=origin,
        destination=destination,
        airline_q=airline_q,
        max_price=max_price,
        max_dur=max_dur,
        sort_by=sort_by,
    )
