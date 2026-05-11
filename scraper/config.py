import os

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

SWIGGY_RESTAURANT_ID = os.environ.get("SWIGGY_RESTAURANT_ID", "1287409")
SWIGGY_LAT = os.environ.get("SWIGGY_LAT", "18.52110")
SWIGGY_LNG = os.environ.get("SWIGGY_LNG", "73.85020")
SWIGGY_URL_SLUG = os.environ.get(
    "SWIGGY_URL_SLUG",
    "pune/prasuma-momo-kitchen-wadgaon-sheri-kalyani-nagar-rest1287409"
)

ZOMATO_RES_SLUG = os.environ.get(
    "ZOMATO_RES_SLUG",
    "pune/prasuma-momo-kitchen-wadgaon-sheri"
)

ALERT_PHONE = os.environ.get("ALERT_PHONE", "")  # WhatsApp number e.g. +919876543210
ALERT_EMAIL = os.environ.get("ALERT_EMAIL", "")
TWILIO_SID = os.environ.get("TWILIO_SID", "")
TWILIO_TOKEN = os.environ.get("TWILIO_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM", "")

POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "600"))
MAX_CONSECUTIVE_FAILURES = int(os.environ.get("MAX_CONSECUTIVE_FAILURES", "5"))
