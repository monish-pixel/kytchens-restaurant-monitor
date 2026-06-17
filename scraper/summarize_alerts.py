"""
Post-matrix summarize job. Run after all shard jobs complete.

Checks how many restaurants went offline this cycle per platform.
If >PLATFORM_OUTAGE_THRESHOLD on a single platform, sends one aggregated
Slack alert (suppresses the per-restaurant flood during platform outages).

Also auto-expires stale alerts older than 4 hours.
"""
import os
import sys
from datetime import datetime, timezone, timedelta

PLATFORM_OUTAGE_THRESHOLD = int(os.environ.get("PLATFORM_OUTAGE_THRESHOLD", "5"))
ALERT_AUTO_EXPIRE_HOURS = 4


def _cycle_at() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(
        minute=(now.minute // 30) * 30,
        second=0,
        microsecond=0,
    )


def _auto_expire_alerts():
    """Mark alerts older than ALERT_AUTO_EXPIRE_HOURS as acknowledged."""
    try:
        from storage.supabase import _get_client
        client = _get_client()
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=ALERT_AUTO_EXPIRE_HOURS)).isoformat()
        result = client.table("alerts") \
            .update({"acknowledged_at": datetime.now(timezone.utc).isoformat()}) \
            .is_("acknowledged_at", "null") \
            .lt("created_at", cutoff) \
            .execute()
        count = len(result.data) if result.data else 0
        if count > 0:
            print(f"[SUMMARIZE] Auto-expired {count} alerts older than {ALERT_AUTO_EXPIRE_HOURS}h", flush=True)
    except Exception as e:
        print(f"[SUMMARIZE ERROR] auto-expire alerts: {e}", flush=True)


def main():
    from storage.supabase import count_offline_this_cycle
    from alerts.notify import send_platform_outage_alert

    cycle = _cycle_at()
    print(f"[SUMMARIZE] cycle_at={cycle.isoformat()}", flush=True)

    for platform in ("swiggy", "zomato"):
        try:
            offline = count_offline_this_cycle(platform, cycle)
            print(f"[SUMMARIZE] {platform}: {offline} offline this cycle", flush=True)
            if offline >= PLATFORM_OUTAGE_THRESHOLD:
                send_platform_outage_alert(platform, offline)
        except Exception as e:
            print(f"[SUMMARIZE ERROR] {platform}: {e}", flush=True)

    _auto_expire_alerts()


if __name__ == "__main__":
    main()
