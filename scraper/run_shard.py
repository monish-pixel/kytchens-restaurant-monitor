"""
GH Actions matrix entry point. Receives a JSON-serialised list of restaurant
dicts via the SHARD_RESTAURANTS env var (set by the matrix job), then polls
each restaurant on both Swiggy and Zomato.

Usage:
  SHARD_RESTAURANTS='[{...}, ...]' python run_shard.py
"""
import asyncio
import json
import os
import random
from datetime import datetime

import config
from scrapers import swiggy, zomato


def log(msg: str):
    print(f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def _save(parsed: dict, raw: dict, restaurant: dict):
    try:
        from storage.supabase import save_snapshot
        save_snapshot(parsed, raw, restaurant)
    except Exception as e:
        log(f"[DB ERROR] {e}")


def _alert(parsed: dict, restaurant: dict):
    platform = parsed["platform"]
    is_open = parsed.get("is_open")
    restaurant_id = parsed.get("restaurant_id", "")

    prev = None
    try:
        from storage.supabase import get_latest
        snap = get_latest(platform, restaurant_id)
        prev = snap["is_open"] if snap else None
    except Exception:
        pass

    if prev is not None and prev != is_open:
        direction = "CAME ONLINE" if is_open else "WENT OFFLINE"
        label = f"{restaurant.get('brand', '')} @ {restaurant.get('location', '')}"
        log(f"[ALERT] {platform.upper()} {label} {direction}")
        try:
            from storage.supabase import write_status_change
            write_status_change(platform, restaurant_id, prev, is_open, restaurant)
        except Exception as e:
            log(f"[STATUS_CHANGE ERROR] {e}")
        try:
            from alerts.notify import send_alert
            send_alert(platform, direction, parsed, restaurant)
        except Exception as e:
            log(f"[ALERT ERROR] {e}")


async def poll_swiggy_for(restaurant: dict):
    swiggy_id = restaurant.get("swiggy_id", "").strip()
    swiggy_slug = restaurant.get("swiggy_slug", "").strip()
    if not swiggy_id:
        return

    label = f"{restaurant.get('brand')} @ {restaurant.get('location')} [swiggy]"
    try:
        raw = await swiggy.fetch(swiggy_id, swiggy_slug)
        if not swiggy.is_valid(raw):
            raise ValueError("invalid response shape")
        parsed = swiggy.parse(raw)
        parsed["restaurant_id"] = swiggy_id
        status = "OPEN" if parsed["is_open"] else f"CLOSED ({parsed.get('next_open_message', '')})"
        log(f"[Swiggy] {label} — {status} | {parsed['item_count']} items")
        _alert(parsed, restaurant)
        _save(parsed, raw, restaurant)
    except Exception as e:
        log(f"[Swiggy FAIL] {label} — {e}")


def poll_zomato_for(restaurant: dict):
    zomato_slug = restaurant.get("zomato_slug", "").strip()
    if not zomato_slug:
        return

    label = f"{restaurant.get('brand')} @ {restaurant.get('location')} [zomato]"
    try:
        raw = zomato.fetch(zomato_slug)
        if not zomato.is_valid(raw):
            raise ValueError("invalid response shape")
        parsed = zomato.parse(raw)
        parsed["restaurant_id"] = zomato_slug
        status = "OPEN" if parsed["is_open"] else f"CLOSED ({parsed.get('timing_desc', '')})"
        log(f"[Zomato] {label} — {status} | {parsed['item_count']} items")
        _alert(parsed, restaurant)
        _save(parsed, raw, restaurant)
    except Exception as e:
        log(f"[Zomato FAIL] {label} — {e}")


async def poll_restaurant(restaurant: dict):
    poll_zomato_for(restaurant)
    await asyncio.sleep(random.uniform(1, 3))
    await poll_swiggy_for(restaurant)


async def main():
    raw_shard = os.environ.get("SHARD_RESTAURANTS")
    if not raw_shard:
        print("[SHARD] SHARD_RESTAURANTS not set", flush=True)
        raise SystemExit(1)

    try:
        restaurants = json.loads(raw_shard)
    except json.JSONDecodeError as e:
        print(f"[SHARD] Invalid SHARD_RESTAURANTS JSON: {e}", flush=True)
        raise SystemExit(1)

    log(f"[SHARD] Polling {len(restaurants)} restaurants")

    for restaurant in restaurants:
        await poll_restaurant(restaurant)
        await asyncio.sleep(random.uniform(2, 5))

    log("[SHARD] Done")


if __name__ == "__main__":
    asyncio.run(main())
