"""
Sync Google Sheets Restaurant Master + Items Master → Supabase restaurants + expected_items tables.

Sheet structure expected:
  Sheet "Restaurant Master": brand | location | city | swiggy_id | zomato_id |
                              swiggy_slug | zomato_slug | operational_hours_swiggy |
                              operational_hours_zomato | should_be_live_swiggy |
                              should_be_live_zomato | active
  Sheet "Items Master": brand | location | city | platform | item_name | item_id | should_be_live
"""
import json
import os
import re
import sys


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower().strip()).strip("-")


def _sheets_service(service_account_json: dict):
    from google.oauth2 import service_account
    from googleapiclient.discovery import build

    creds = service_account.Credentials.from_service_account_info(
        service_account_json,
        scopes=["https://www.googleapis.com/auth/spreadsheets.readonly"],
    )
    return build("sheets", "v4", credentials=creds, cache_discovery=False)


def _read_sheet(service, sheet_id: str, tab_name: str) -> list[dict]:
    result = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=sheet_id, range=tab_name)
        .execute()
    )
    rows = result.get("values", [])
    if len(rows) < 2:
        return []
    headers = [h.strip().lower().replace(" ", "_") for h in rows[0]]
    return [dict(zip(headers, row)) for row in rows[1:] if any(row)]


def _parse_bool(val: str) -> bool:
    return str(val).strip().lower() in ("true", "yes", "1", "y")


def sync_restaurants(sheet_id: str, service_account_json: dict) -> dict:
    from storage.supabase import _get_client

    service = _sheets_service(service_account_json)
    rows = _read_sheet(service, sheet_id, "Restaurant Master")
    client = _get_client()

    existing = {
        (r["brand"], r["location_slug"], r["city_slug"]): r
        for r in client.table("restaurants").select("brand,location_slug,city_slug,active").execute().data
    }

    added = updated = deactivated = 0
    seen_keys = set()

    for row in rows:
        brand = row.get("brand", "").strip()
        location = row.get("location", "").strip()
        city = row.get("city", "").strip()
        if not brand or not location or not city:
            continue

        location_slug = slugify(location)
        city_slug = slugify(city)
        key = (brand, location_slug, city_slug)
        seen_keys.add(key)

        record = {
            "brand": brand,
            "location": location,
            "location_slug": location_slug,
            "city": city,
            "city_slug": city_slug,
            "swiggy_id": row.get("swiggy_id", "").strip() or None,
            "swiggy_slug": row.get("swiggy_slug", "").strip() or None,
            "zomato_slug": row.get("zomato_slug", "").strip() or None,
            "operational_hours_swiggy": row.get("operational_hours_swiggy", "").strip() or None,
            "operational_hours_zomato": row.get("operational_hours_zomato", "").strip() or None,
            "should_be_live_swiggy": _parse_bool(row.get("should_be_live_swiggy", "true")),
            "should_be_live_zomato": _parse_bool(row.get("should_be_live_zomato", "true")),
            "active": _parse_bool(row.get("active", "true")),
        }

        if key not in existing:
            client.table("restaurants").insert(record).execute()
            added += 1
        else:
            client.table("restaurants").update(record).eq("brand", brand).eq(
                "location_slug", location_slug
            ).eq("city_slug", city_slug).execute()
            updated += 1

    # Deactivation is intentional-only: set active=false in the sheet row itself.
    # Auto-deactivating DB rows not present in the sheet would wipe manually-added
    # restaurants that haven't been added to the sheet yet.

    stats = {"added": added, "updated": updated, "deactivated": 0}
    print(f"[SYNC] restaurants: {stats}", flush=True)
    return stats


def sync_expected_items(sheet_id: str, service_account_json: dict) -> dict:
    from storage.supabase import _get_client

    service = _sheets_service(service_account_json)
    rows = _read_sheet(service, sheet_id, "Items Master")
    client = _get_client()

    added = updated = 0

    for row in rows:
        brand = row.get("brand", "").strip()
        location = row.get("location", "").strip()
        city = row.get("city", "").strip()
        platform = row.get("platform", "").strip().lower()
        item_name = row.get("item_name", "").strip()
        if not brand or not location or not city or not platform or not item_name:
            continue

        location_slug = slugify(location)
        city_slug = slugify(city)
        item_id = row.get("item_id", "").strip() or None

        record = {
            "brand": brand,
            "location_slug": location_slug,
            "city_slug": city_slug,
            "platform": platform,
            "item_name": item_name,
            "item_id": item_id,
            "should_be_live": _parse_bool(row.get("should_be_live", "true")),
        }

        result = client.table("expected_items").upsert(
            record,
            on_conflict="brand,location_slug,city_slug,platform,item_id",
        ).execute()
        if result.data:
            added += 1

    stats = {"synced": added + updated}
    print(f"[SYNC] expected_items: {stats}", flush=True)
    return stats


if __name__ == "__main__":
    sheet_id = os.environ.get("GOOGLE_SHEET_ID")
    sa_json_raw = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")

    if not sheet_id or not sa_json_raw:
        print("[SYNC] GOOGLE_SHEET_ID or GOOGLE_SERVICE_ACCOUNT_JSON not set", flush=True)
        sys.exit(1)

    # Accept both raw JSON and base64-encoded JSON (matches expense-manager format)
    import base64
    try:
        sa_json = json.loads(sa_json_raw)
    except json.JSONDecodeError:
        try:
            sa_json = json.loads(base64.b64decode(sa_json_raw).decode("utf-8"))
        except Exception as e:
            print(f"[SYNC] Invalid GOOGLE_SERVICE_ACCOUNT_JSON (tried raw + base64): {e}", flush=True)
            sys.exit(1)

    try:
        sync_restaurants(sheet_id, sa_json)
        sync_expected_items(sheet_id, sa_json)
    except Exception as e:
        print(f"[SYNC] Failed: {e}", flush=True)
        sys.exit(1)
