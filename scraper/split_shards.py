"""
Query active restaurants from Supabase, validate count, split into shards,
and emit a GitHub Actions matrix JSON to GITHUB_OUTPUT.

Usage (in GH Actions):
  python split_shards.py >> $GITHUB_OUTPUT
"""
import json
import os
import sys


MIN_EXPECTED_RESTAURANTS = int(os.environ.get("MIN_EXPECTED_RESTAURANTS", "5"))
MAX_SHARDS = 20


def split_into_shards(restaurants: list, max_shards: int) -> list[list]:
    n = min(len(restaurants), max_shards)
    shards = [[] for _ in range(n)]
    for i, r in enumerate(restaurants):
        shards[i % n].append(r)
    return [s for s in shards if s]


def main():
    from storage.supabase import _get_client
    client = _get_client()

    result = client.table("restaurants").select(
        "id,brand,location,location_slug,city,city_slug,"
        "swiggy_id,swiggy_slug,zomato_slug,"
        "operational_hours_swiggy,operational_hours_zomato,"
        "should_be_live_swiggy,should_be_live_zomato"
    ).eq("active", True).execute()

    restaurants = result.data or []
    count = len(restaurants)

    if count < MIN_EXPECTED_RESTAURANTS:
        print(
            f"[CRITICAL] Only {count} active restaurants found "
            f"(expected >= {MIN_EXPECTED_RESTAURANTS}). "
            "Possible Supabase outage or empty config — aborting scrape.",
            flush=True,
        )
        sys.exit(1)

    print(f"[SPLIT] {count} active restaurants → splitting into shards", flush=True)

    shards = split_into_shards(restaurants, MAX_SHARDS)
    num_shards = len(shards)
    print(f"[SPLIT] {num_shards} shards", flush=True)

    matrix = {
        "include": [
            {
                "shard_index": i,
                "restaurants": json.dumps(shard),
            }
            for i, shard in enumerate(shards)
        ]
    }

    print(f"matrix={json.dumps(matrix)}")


if __name__ == "__main__":
    main()
