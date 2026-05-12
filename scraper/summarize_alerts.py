"""
Post-matrix summarize job. Run after all shard jobs complete.

Checks how many restaurants went offline this cycle per platform.
If >PLATFORM_OUTAGE_THRESHOLD on a single platform, sends one aggregated
Slack alert (suppresses the per-restaurant flood during platform outages).
"""
import os
import sys
from datetime import datetime, timezone

PLATFORM_OUTAGE_THRESHOLD = int(os.environ.get("PLATFORM_OUTAGE_THRESHOLD", "5"))


def _cycle_at() -> datetime:
    now = datetime.now(timezone.utc)
    return now.replace(
        minute=(now.minute // 30) * 30,
        second=0,
        microsecond=0,
    )


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


if __name__ == "__main__":
    main()
