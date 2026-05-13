import hashlib
import json
import os
from datetime import datetime, timezone

from supabase import create_client

_client = None


def _get_client():
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
        _client = create_client(url, key)
    return _client


def _compute_menu_checksum(items: list) -> str:
    sorted_items = sorted(items, key=lambda x: x.get("item_id") or "")
    payload = json.dumps(
        [{"id": i.get("item_id"), "stock": i.get("in_stock")} for i in sorted_items],
        sort_keys=True,
    )
    return hashlib.md5(payload.encode()).hexdigest()


def save_snapshot(parsed: dict, raw: dict, restaurant: dict | None = None) -> bool:
    """
    Change-only write. Returns True if snapshot was written, False if skipped.
    Skips write when is_open and menu_checksum are unchanged from previous snapshot.
    """
    client = _get_client()
    platform = parsed["platform"]
    restaurant_id = parsed["restaurant_id"]
    is_open = parsed.get("is_open")

    if is_open is None:
        return False

    items = parsed.get("items", [])
    new_checksum = _compute_menu_checksum(items)

    prev = get_latest(platform, restaurant_id)
    if prev is not None:
        if prev.get("is_open") == is_open and prev.get("menu_checksum") == new_checksum:
            client.table("snapshots").update(
                {"fetched_at": datetime.utcnow().isoformat()}
            ).eq("id", prev["id"]).execute()
            return False

    brand = (restaurant or {}).get("brand") or parsed.get("brand")
    location_slug = (restaurant or {}).get("location_slug") or parsed.get("location_slug")
    city_slug = (restaurant or {}).get("city_slug") or parsed.get("city_slug")

    snap = client.table("snapshots").insert({
        "platform": platform,
        "restaurant_id": restaurant_id,
        "is_open": is_open,
        "fetch_method": parsed.get("fetch_method", "auto"),
        "fail_count": 0,
        "raw_json": raw if raw else None,
        "brand": brand,
        "location_slug": location_slug,
        "city_slug": city_slug,
        "menu_checksum": new_checksum,
    }).execute()

    snap_id = snap.data[0]["id"]

    if items:
        client.table("menu_items").insert([
            {
                "snapshot_id": snap_id,
                "category": item.get("category"),
                "name": item.get("name"),
                "item_id": item.get("id"),
                "in_stock": item.get("in_stock"),
                "is_enabled": item.get("is_enabled", True),
            }
            for item in items
        ]).execute()

    return True


def write_status_change(platform: str, restaurant_id: str, prev_open: bool, curr_open: bool,
                        restaurant: dict | None = None) -> None:
    client = _get_client()
    r = restaurant or {}
    client.table("status_changes").insert({
        "platform": platform,
        "prev_open": prev_open,
        "curr_open": curr_open,
        "restaurant_id": restaurant_id,
        "brand": r.get("brand"),
        "location_slug": r.get("location_slug"),
        "city_slug": r.get("city_slug"),
    }).execute()


def write_alert(platform: str, alert_type: str, details: str,
                restaurant: dict | None = None) -> None:
    client = _get_client()
    r = restaurant or {}
    now = datetime.now(timezone.utc)
    cycle_at = now.replace(
        minute=(now.minute // 30) * 30,
        second=0,
        microsecond=0,
    )
    client.table("alerts").insert({
        "platform": platform,
        "alert_type": alert_type,
        "details": details,
        "notified": False,
        "restaurant_id": r.get("swiggy_id") or r.get("zomato_slug"),
        "brand": r.get("brand"),
        "location_slug": r.get("location_slug"),
        "city_slug": r.get("city_slug"),
        "check_cycle_at": cycle_at.isoformat(),
    }).execute()


def mark_alert_notified(alert_id: int) -> None:
    client = _get_client()
    client.table("alerts").update({"notified": True}).eq("id", alert_id).execute()


def get_latest(platform: str, restaurant_id: str) -> dict | None:
    client = _get_client()
    result = client.table("snapshots") \
        .select("id, is_open, menu_checksum, fetched_at") \
        .eq("platform", platform) \
        .eq("restaurant_id", restaurant_id) \
        .order("fetched_at", desc=True) \
        .limit(1) \
        .execute()
    return result.data[0] if result.data else None


def count_offline_this_cycle(platform: str, cycle_at: datetime) -> int:
    client = _get_client()
    result = client.table("snapshots") \
        .select("id", count="exact") \
        .eq("platform", platform) \
        .eq("is_open", False) \
        .gte("fetched_at", cycle_at.isoformat()) \
        .execute()
    return result.count or 0
