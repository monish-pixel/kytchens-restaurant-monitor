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


def just_past_close(location_slug: str, dt: datetime | None = None, window_minutes: int = 65) -> bool:
    """
    Return True if we're within window_minutes past the store's scheduled close time.
    Used to alert when a Pune store is still online after it should have closed.

    Schedules (IST):
      kharadi / baner / wakad  : closes midnight every day
      kalyani-nagar            : Mon–Thu closes midnight, Fri–Sun closes 3 am next day
    """
    if dt is None:
        dt = datetime.now(IST)
    hour, minute = dt.hour, dt.minute
    day = dt.weekday()  # 0=Mon, 1=Tue … 6=Sun
    total_minutes = hour * 60 + minute

    if location_slug in ("kharadi", "baner", "wakad"):
        # Closes midnight → window is [00:00, 01:04] on any day
        return total_minutes < window_minutes

    if location_slug == "kalyani-nagar":
        # Mon–Thu close at midnight → window is Tue–Fri (day 1–4) 00:00–01:04
        if day in (1, 2, 3, 4):
            return total_minutes < window_minutes
        # Fri–Sun close at 3 am → window is Sat–Mon (day 5,6,0) 03:00–04:04
        if day in (5, 6, 0):
            minutes_past_3am = total_minutes - 3 * 60
            return 0 <= minutes_past_3am < window_minutes

    return False
