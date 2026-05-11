import os


def send_alert(platform: str, direction: str, parsed: dict):
    msg = f"[Kytchens] {platform.upper()} {direction}\nItems: {parsed.get('item_count', '?')}"
    if parsed.get("next_open_message"):
        msg += f"\n{parsed['next_open_message']}"
    elif parsed.get("timing_desc"):
        msg += f"\n{parsed['timing_desc']}"

    _write_to_db(platform, direction, msg)
    _try_whatsapp(msg)


def send_scraper_alert(platform: str, fail_count: int):
    msg = f"[Kytchens] {platform.upper()} scraper has failed {fail_count} times in a row. Check logs."
    _write_to_db(platform, "scraper_failing", msg)
    _try_whatsapp(msg)


def _write_to_db(platform: str, alert_type: str, details: str):
    try:
        from storage.supabase import _get_client
        client = _get_client()
        client.table("alerts").insert({
            "platform": platform,
            "alert_type": alert_type,
            "details": details,
            "notified": False,
        }).execute()
        client.table("alerts").update({"notified": True}) \
            .eq("platform", platform) \
            .eq("notified", False) \
            .execute()
    except Exception as e:
        print(f"[ALERT DB] {e}")


def _try_whatsapp(msg: str):
    sid = os.environ.get("TWILIO_SID")
    token = os.environ.get("TWILIO_TOKEN")
    from_num = os.environ.get("TWILIO_FROM")
    to_num = os.environ.get("ALERT_PHONE")

    if not all([sid, token, from_num, to_num]):
        return

    try:
        from twilio.rest import Client
        client = Client(sid, token)
        client.messages.create(
            body=msg,
            from_=f"whatsapp:{from_num}",
            to=f"whatsapp:{to_num}",
        )
    except Exception as e:
        print(f"[WHATSAPP] {e}")
