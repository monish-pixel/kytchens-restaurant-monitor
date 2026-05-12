import asyncio
import random
from datetime import datetime

import config
from scrapers import swiggy, zomato

fail_counts = {"swiggy": 0, "zomato": 0}
last_status = {"swiggy": None, "zomato": None}


def log(msg):
    print(f"[{datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')}] {msg}", flush=True)


def save_snapshot(parsed: dict, raw: dict, restaurant: dict | None = None):
    try:
        from storage.supabase import save_snapshot as db_save
        db_save(parsed, raw, restaurant)
    except Exception as e:
        log(f"[DB ERROR] {e}")


def check_and_alert(parsed: dict, restaurant: dict | None = None):
    platform = parsed["platform"]
    is_open = parsed.get("is_open")
    restaurant_id = parsed.get("restaurant_id", "")

    prev = last_status.get(platform)
    if prev is None:
        try:
            from storage.supabase import get_latest
            snap = get_latest(platform, restaurant_id)
            prev = snap["is_open"] if snap else None
        except Exception:
            pass

    if prev is not None and prev != is_open:
        direction = "CAME ONLINE" if is_open else "WENT OFFLINE"
        log(f"[ALERT] {platform.upper()} {direction}")
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

    last_status[platform] = is_open


async def poll_swiggy():
    platform = "swiggy"
    log(f"Polling Swiggy (restaurant {config.SWIGGY_RESTAURANT_ID})...")
    try:
        raw = await swiggy.fetch(config.SWIGGY_RESTAURANT_ID, config.SWIGGY_URL_SLUG)
        if not swiggy.is_valid(raw):
            raise ValueError("invalid response shape")
        parsed = swiggy.parse(raw)
        fail_counts[platform] = 0
        status = "OPEN" if parsed["is_open"] else f"CLOSED ({parsed.get('next_open_message', '')})"
        log(f"[Swiggy] {status} | {parsed['item_count']} items")
        check_and_alert(parsed)
        save_snapshot(parsed, raw)
    except Exception as e:
        fail_counts[platform] += 1
        log(f"[Swiggy FAIL #{fail_counts[platform]}] {e}")
        if fail_counts[platform] >= config.MAX_CONSECUTIVE_FAILURES:
            log(f"[ALERT] Swiggy scraper failing for {fail_counts[platform]} cycles")
            try:
                from alerts.notify import send_scraper_alert
                send_scraper_alert(platform, fail_counts[platform])
            except Exception as ae:
                log(f"[ALERT ERROR] {ae}")


def poll_zomato():
    platform = "zomato"
    log(f"Polling Zomato ({config.ZOMATO_RES_SLUG})...")
    try:
        raw = zomato.fetch(config.ZOMATO_RES_SLUG)
        if not zomato.is_valid(raw):
            raise ValueError("invalid response shape")
        parsed = zomato.parse(raw)
        fail_counts[platform] = 0
        status = "OPEN" if parsed["is_open"] else f"CLOSED ({parsed.get('timing_desc', '')})"
        log(f"[Zomato] {status} | {parsed['item_count']} items")
        check_and_alert(parsed)
        save_snapshot(parsed, raw)
    except Exception as e:
        fail_counts[platform] += 1
        log(f"[Zomato FAIL #{fail_counts[platform]}] {e}")
        if fail_counts[platform] >= config.MAX_CONSECUTIVE_FAILURES:
            log(f"[ALERT] Zomato scraper failing for {fail_counts[platform]} cycles")
            try:
                from alerts.notify import send_scraper_alert
                send_scraper_alert(platform, fail_counts[platform])
            except Exception as ae:
                log(f"[ALERT ERROR] {ae}")


async def run_cycle():
    poll_zomato()
    await asyncio.sleep(2)
    await poll_swiggy()


async def main():
    log("Kytchens Restaurant Monitor starting...")
    log(f"Swiggy ID: {config.SWIGGY_RESTAURANT_ID} | Zomato: {config.ZOMATO_RES_SLUG}")
    log(f"Poll interval: {config.POLL_INTERVAL_SECONDS}s ±90s jitter")

    try:
        from storage.migrate import run_migrations
        run_migrations()
    except Exception as e:
        log(f"[MIGRATE ERROR] {e} — continuing anyway")

    while True:
        try:
            await run_cycle()
        except Exception as e:
            log(f"[CYCLE ERROR] {e}")

        jitter = random.randint(-90, 90)
        sleep_for = config.POLL_INTERVAL_SECONDS + jitter
        log(f"Next poll in {sleep_for}s")
        await asyncio.sleep(sleep_for)


if __name__ == "__main__":
    asyncio.run(main())
