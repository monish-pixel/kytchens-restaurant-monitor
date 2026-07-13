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
    swiggy_slug = (restaurant.get("swiggy_slug") or "").strip()
    if not swiggy_id:
        return

    label = f"{restaurant.get('brand')} @ {restaurant.get('location')} [swiggy]"
    delays = [5, 10]
    for attempt in range(3):
        try:
            raw = await swiggy.fetch(swiggy_id, swiggy_slug)
            if not swiggy.is_valid(raw):
                raise ValueError("invalid response shape")
            parsed = swiggy.parse(raw)
            parsed["restaurant_id"] = swiggy_id
            parsed = _apply_schedule_override(parsed, restaurant)
            status = "OPEN" if parsed["is_open"] else f"CLOSED ({parsed.get('next_open_message', '')})"
            log(f"[Swiggy] {label} — {status} | {parsed['item_count']} items")
            _alert(parsed, restaurant)
            _save(parsed, raw, restaurant)
            _check_close_time(parsed, restaurant)
            return
        except Exception as e:
            if attempt < 2:
                log(f"[Swiggy RETRY {attempt+1}] {label} — {e}")
                await asyncio.sleep(delays[attempt])
            else:
                log(f"[Swiggy FAIL] {label} — {e}")


def _apply_schedule_override(parsed: dict, restaurant: dict) -> dict:
    """If platform says open but it's outside scheduled Pune hours, trust the schedule."""
    if not parsed.get("is_open"):
        return parsed
    if restaurant.get("city_slug") != "pune":
        return parsed
    try:
        from alerts.store_hours import is_within_store_hours
        if not is_within_store_hours(restaurant.get("location_slug", "")):
            log(f"[SCHEDULE] {restaurant.get('brand')} overridden to CLOSED (outside hours)")
            return {**parsed, "is_open": False}
    except Exception:
        pass
    return parsed


def poll_zomato_for(restaurant: dict):
    zomato_slug = (restaurant.get("zomato_slug") or "").strip()
    if not zomato_slug:
        return

    label = f"{restaurant.get('brand')} @ {restaurant.get('location')} [zomato]"
    delays = [5, 10]
    for attempt in range(3):
        try:
            raw = zomato.fetch(zomato_slug)
            if not zomato.is_valid(raw):
                raise ValueError("invalid response shape")
            parsed = zomato.parse(raw)
            parsed["restaurant_id"] = zomato_slug
            parsed = _apply_schedule_override(parsed, restaurant)
            status = "OPEN" if parsed["is_open"] else f"CLOSED ({parsed.get('timing_desc', '')})"
            log(f"[Zomato] {label} — {status} | {parsed['item_count']} items")
            _alert(parsed, restaurant)
            _save(parsed, raw, restaurant)
            _check_close_time(parsed, restaurant)
            return
        except Exception as e:
            if attempt < 2:
                log(f"[Zomato RETRY {attempt+1}] {label} — {e}")
                import time; time.sleep(delays[attempt])
            else:
                log(f"[Zomato FAIL] {label} — {e}")


def _check_close_time(parsed: dict, restaurant: dict):
    """Email when a Pune store is still online within 65 min of scheduled close."""
    if not parsed.get("is_open"):
        return
    if restaurant.get("city_slug") != "pune":
        return
    try:
        from alerts.store_hours import just_past_close
        if just_past_close(restaurant.get("location_slug", "")):
            from alerts.notify import send_store_open_after_close_alert
            send_store_open_after_close_alert(parsed.get("platform", ""), restaurant)
    except Exception as e:
        log(f"[CLOSE ALERT] {e}")


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
