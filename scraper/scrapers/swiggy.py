import asyncio
import json
from datetime import datetime
from playwright.async_api import async_playwright


async def fetch(restaurant_id: str, url_slug: str) -> dict:
    captured = {}

    async def on_response(response):
        if "mapi/menu/pl" in response.url and response.status == 200:
            try:
                body = await response.json()
                if is_valid(body):
                    captured["data"] = body
            except Exception:
                pass

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-blink-features=AutomationControlled",
                  "--single-process", "--disable-dev-shm-usage"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
            viewport={"width": 390, "height": 844},
            locale="en-IN",
            timezone_id="Asia/Kolkata",
            geolocation={"latitude": 18.5204, "longitude": 73.8567},
            permissions=["geolocation"],
        )
        await context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined});"
        )
        page = await context.new_page()
        page.on("response", on_response)

        url = f"https://www.swiggy.com/city/{url_slug}"
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(6)
        await browser.close()

    return captured.get("data", {})


def is_valid(data: dict) -> bool:
    try:
        cards = data["data"]["cards"]
        return isinstance(cards, list) and len(cards) > 0
    except (KeyError, TypeError):
        return False


def parse(data: dict) -> dict:
    cards = data.get("data", {}).get("cards", [])

    restaurant_info = {}
    items = []

    def walk(obj, current_category=None):
        if not isinstance(obj, dict):
            if isinstance(obj, list):
                for i in obj:
                    walk(i, current_category)
            return

        t = obj.get("@type", "")

        if "Restaurant" in t:
            info = obj.get("info", {})
            if info.get("name"):
                restaurant_info.update({
                    "name": info.get("name"),
                    "id": str(info.get("id", "")),
                    "availability": info.get("availability", {}),
                    "avg_rating": info.get("avgRating"),
                    "total_ratings": info.get("totalRatingsString"),
                })

        if "ItemCategory" in t or "NestedItemCategory" in t:
            cat = obj.get("title", current_category)
            for v in obj.values():
                walk(v, cat)
            return

        if "Dish" in t:
            info = obj.get("info", {})
            items.append({
                "name": info.get("name", ""),
                "id": str(info.get("id", "")),
                "category": current_category,
                "in_stock": info.get("inStock") == 1,
                "is_enabled": info.get("isEnabled", True),
                "is_veg": info.get("isVeg") == 1,
                "price": info.get("price", 0) / 100 if info.get("price") else None,
            })
            return

        for v in obj.values():
            walk(v, current_category)

    for card in cards:
        walk(card)

    avail = restaurant_info.get("availability", {})
    next_open = avail.get("nextOpenTime")
    opened = avail.get("opened")
    # "opened" is the explicit server-side field (True when accepting orders).
    # Fall back to nextOpenTime absence check for older response shapes.
    if opened is not None:
        is_open = bool(opened)
    else:
        is_open = next_open is None

    return {
        "platform": "swiggy",
        "restaurant_id": restaurant_info.get("id", ""),
        "fetched_at": datetime.utcnow().isoformat(),
        "is_open": is_open,
        "next_open_message": avail.get("nextOpenTimeMessage"),
        "items": items,
        "item_count": len(items),
    }
