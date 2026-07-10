import json
import os
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))


def send_alert(platform: str, direction: str, parsed: dict, restaurant: dict | None = None):
    r = restaurant or {}
    brand = r.get("brand") or parsed.get("brand", "")
    location = r.get("location") or parsed.get("location", "")
    label = f"{brand} @ {location}" if brand and location else platform.upper()

    msg = f"[Kytchens] {label} — {direction} on {platform.upper()}"
    if parsed.get("next_open_message"):
        msg += f"\n{parsed['next_open_message']}"
    elif parsed.get("timing_desc"):
        msg += f"\n{parsed['timing_desc']}"

    alert_id = _write_to_db(platform, direction, msg, restaurant)
    success = _try_slack(msg)
    if alert_id and success:
        from storage.supabase import mark_alert_notified
        mark_alert_notified(alert_id)

    # Email for Pune stores going offline during store hours
    if direction == "WENT OFFLINE" and r.get("city_slug") == "pune":
        _maybe_send_email(platform, label, r.get("location_slug", ""))


def _maybe_send_email(platform: str, label: str, location_slug: str):
    try:
        from alerts.store_hours import is_within_store_hours
        if not is_within_store_hours(location_slug):
            return
        now_ist = datetime.now(IST)
        time_str = now_ist.strftime("%d %b %Y, %I:%M %p IST")
        subject = f"[Kytchens Alert] OFFLINE: {label} on {platform.upper()}"
        body = (
            f"{label} has gone OFFLINE on {platform.upper()}.\n\n"
            f"Time: {time_str}\n\n"
            f"Check the fleet monitor for details."
        )
        from alerts.gmail import send_gmail
        send_gmail(subject, body)
    except Exception as e:
        print(f"[EMAIL ALERT] {e}")


def send_scraper_alert(platform: str, fail_count: int, restaurant: dict | None = None):
    r = restaurant or {}
    brand = r.get("brand", platform.upper())
    msg = f"[Kytchens] {brand} {platform.upper()} scraper has failed {fail_count} times in a row. Check logs."
    alert_id = _write_to_db(platform, "scraper_failing", msg, restaurant)
    success = _try_slack(msg)
    if alert_id and success:
        from storage.supabase import mark_alert_notified
        mark_alert_notified(alert_id)


def send_platform_outage_alert(platform: str, offline_count: int):
    msg = (
        f":warning: *Platform alert:* {offline_count} {platform.upper()} restaurants offline this cycle "
        f"— possible platform outage. Check {platform.capitalize()} status."
    )
    _try_slack(msg)


def _write_to_db(platform: str, alert_type: str, details: str,
                 restaurant: dict | None = None) -> int | None:
    try:
        from storage.supabase import write_alert
        write_alert(platform, alert_type, details, restaurant)
        return None
    except Exception as e:
        print(f"[ALERT DB] {e}")
        return None


def _try_slack(msg: str) -> bool:
    webhook = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook:
        return False
    try:
        import httpx
        resp = httpx.post(
            webhook,
            json={"text": msg},
            timeout=10,
        )
        return resp.status_code == 200
    except Exception as e:
        print(f"[SLACK] {e}")
        return False
