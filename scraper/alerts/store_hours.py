"""Business hours logic for Pune kitchens (IST-aware)."""
from datetime import datetime, timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

# Pune locations that have defined schedules
_KNOWN_PUNE = {"kharadi", "baner", "wakad", "kalyani-nagar"}


def is_within_store_hours(location_slug: str, dt: datetime | None = None) -> bool:
    """
    Return True if a Pune store at location_slug should currently be open.
    dt should be an IST-aware datetime; defaults to now(IST).

    Schedules (all times IST):
      kharadi / baner / wakad  : 11 am – 12 am (midnight) every day
      kalyani-nagar            : Mon–Thu 9 am – 12 am, Fri–Sun 9 am – 3 am next day
    """
    if dt is None:
        dt = datetime.now(IST)

    hour = dt.hour
    day = dt.weekday()  # 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun

    if location_slug in ("kharadi", "baner", "wakad"):
        # Open 11:00–23:59 (closes at midnight, no late-night extension)
        return 11 <= hour < 24

    if location_slug == "kalyani-nagar":
        if hour < 3:
            # 00:00–02:59 — open only if yesterday was Fri/Sat/Sun (extended-hours night)
            prev_day = (day - 1) % 7
            return prev_day in (4, 5, 6)  # Fri=4, Sat=5, Sun=6
        if hour < 9:
            return False  # 03:00–08:59 always closed
        return True  # 09:00+ open on all days

    # Unknown Pune location — notify anyway (fail open)
    return True
