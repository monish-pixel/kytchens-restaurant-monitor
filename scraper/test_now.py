"""
Run: python3 test_now.py
Tests both Swiggy and Zomato right now, prints results. No DB needed.
"""
import asyncio
import json
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from scrapers import swiggy, zomato
import config


def print_result(parsed: dict):
    platform = parsed["platform"].upper()
    status = "🟢 OPEN" if parsed["is_open"] else "🔴 CLOSED"
    print(f"\n{'='*50}")
    print(f"  {platform}  {status}")
    print(f"{'='*50}")

    if parsed["platform"] == "swiggy":
        msg = parsed.get("next_open_message", "")
        if msg:
            print(f"  Next open: {msg}")
    else:
        print(f"  Timing: {parsed.get('timing_desc', '')}")

    items = parsed.get("items", [])
    print(f"  Total items: {len(items)}")

    # Group by category
    by_cat = {}
    for item in items:
        cat = item.get("category", "Other") or "Other"
        by_cat.setdefault(cat, []).append(item)

    for cat, cat_items in by_cat.items():
        print(f"\n  [{cat}]")
        for item in cat_items:
            veg = "🟢" if item.get("is_veg") else "🔴"
            stock = "✅" if item.get("in_stock") else "❌"
            enabled = "" if item.get("is_enabled", True) else " [DISABLED]"
            price = f" ₹{item['price']:.0f}" if item.get("price") else ""
            print(f"    {veg} {stock} {item['name']}{price}{enabled}")


async def test_swiggy():
    print("\nFetching Swiggy (takes ~10s via Playwright)...")
    raw = await swiggy.fetch(config.SWIGGY_RESTAURANT_ID, config.SWIGGY_URL_SLUG)
    if not swiggy.is_valid(raw):
        print("❌ Swiggy: invalid or empty response")
        return
    parsed = swiggy.parse(raw)
    print_result(parsed)
    with open("/tmp/swiggy_parsed.json", "w") as f:
        json.dump(parsed, f, indent=2)
    print(f"\n  [saved to /tmp/swiggy_parsed.json]")


def test_zomato():
    print("\nFetching Zomato (direct HTTP ~1s)...")
    raw = zomato.fetch(config.ZOMATO_RES_SLUG)
    if not zomato.is_valid(raw):
        print("❌ Zomato: invalid or empty response")
        return
    parsed = zomato.parse(raw)
    print_result(parsed)
    with open("/tmp/zomato_parsed.json", "w") as f:
        json.dump(parsed, f, indent=2)
    print(f"\n  [saved to /tmp/zomato_parsed.json]")


async def main():
    test_zomato()
    await test_swiggy()
    print("\nDone.")


asyncio.run(main())
