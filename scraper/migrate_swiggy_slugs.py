"""One-time migration: set swiggy_slug for the 7 new Kalyani Nagar brands."""
import os
import sys
from supabase import create_client

url = os.environ["SUPABASE_URL"]
key = os.environ["SUPABASE_KEY"]
client = create_client(url, key)

SLUGS = [
    (2, "pune/taatsu-japanese-baked-tarts-wadgaon-sheri-rest1287859"),
    (3, "pune/binas-fresh-batch-ice-cream-wadgaon-sheri-rest1328577"),
    (4, "pune/ether-atelier-chocolate-wadgaon-sheri-rest1312195"),
    (5, "pune/noto-ice-creams-desserts-kalyani-nagar-rest572995"),
    (6, "pune/parsi-dairy-farm-wadgaon-sheri-rest1299590"),
    (7, "pune/entisi-chocolatier-koregaon-park-rest1315195"),
    (8, "pune/cookie-cartel-wadgaon-sheri-rest1338243"),
]

for rid, slug in SLUGS:
    result = client.table("restaurants").update({"swiggy_slug": slug}).eq("id", rid).execute()
    print(f"[MIGRATE] id={rid} swiggy_slug={slug} -> {len(result.data)} row(s)", flush=True)

print("[MIGRATE] Done", flush=True)
