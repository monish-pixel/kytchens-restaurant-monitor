import json
import os
from supabase import create_client

_client = None


def _get_client():
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_KEY"]
        _client = create_client(url, key)
    return _client


def save_snapshot(parsed: dict, raw: dict):
    client = _get_client()
    platform = parsed["platform"]
    restaurant_id = parsed["restaurant_id"]
    is_open = parsed.get("is_open")

    snap = client.table("snapshots").insert({
        "platform": platform,
        "restaurant_id": restaurant_id,
        "is_open": is_open,
        "fetch_method": parsed.get("fetch_method", "auto"),
        "fail_count": 0,
        "raw_json": raw,
    }).execute()

    snap_id = snap.data[0]["id"]

    items = parsed.get("items", [])
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

    _check_status_change(client, platform, restaurant_id, is_open)


def _check_status_change(client, platform, restaurant_id, is_open):
    prev = client.table("snapshots") \
        .select("is_open") \
        .eq("platform", platform) \
        .eq("restaurant_id", restaurant_id) \
        .order("fetched_at", desc=True) \
        .limit(2) \
        .execute()

    rows = prev.data
    if len(rows) >= 2 and rows[1]["is_open"] != is_open:
        client.table("status_changes").insert({
            "platform": platform,
            "prev_open": rows[1]["is_open"],
            "curr_open": is_open,
        }).execute()


def get_latest(platform: str, restaurant_id: str) -> dict | None:
    client = _get_client()
    result = client.table("snapshots") \
        .select("*, menu_items(*)") \
        .eq("platform", platform) \
        .eq("restaurant_id", restaurant_id) \
        .order("fetched_at", desc=True) \
        .limit(1) \
        .execute()
    return result.data[0] if result.data else None
