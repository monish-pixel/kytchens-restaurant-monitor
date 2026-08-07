import asyncio
import json
from datetime import datetime

try:
    from playwright.async_api import async_playwright
except ImportError:  # parse()/is_valid() work without playwright (local tests)
    async_playwright = None


async def fetch(restaurant_id: str, url_slug: str) -> dict:
    captured = {}
    captured_api_url = {}

    async def on_response(response):
        if "mapi/menu/pl" in response.url and response.status == 200:
            try:
                body = await response.json()
                if is_valid(body):
                    captured["data"] = body
                    captured_api_url["url"] = response.url
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

        url = f"https://www.swiggy.com/city/{url_slug}" if url_slug else f"https://www.swiggy.com/menu/{restaurant_id}"
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await asyncio.sleep(6)

        # Always re-fetch the API URL with explicit Pune lat/lng.
        # Swiggy computes open/closed server-side based on the lat/lng in the request,
        # not the client IP — so we must override to get the Pune customer's view.
        import re as _re
        api_url = captured_api_url.get("url", "")
        if not api_url and restaurant_id:
            # fallback: construct the mobile API URL directly
            api_url = (
                f"https://www.swiggy.com/mapi/menu/pl"
                f"?page-type=REGULAR_MENU&complete-menu=true"
                f"&lat=18.5204&lng=73.8567&restaurantId={restaurant_id}"
            )
        if api_url:
            api_url = _re.sub(r"lat=[^&]+", "lat=18.5204", api_url)
            api_url = _re.sub(r"lng=[^&]+", "lng=73.8567", api_url)
            try:
                resp = await page.request.get(api_url)
                if resp.ok:
                    body = await resp.json()
                    if is_valid(body):
                        captured["data"] = body
            except Exception:
                pass

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
    # "opened" is the explicit server-side field (1/True when accepting orders).
    # nextOpenTime without "opened" is an explicit closed-with-reopen-time.
    # Neither field populated (minimal availability object like
    # {"visibility": true, "restaurantClosedMeta": {}}) is AMBIGUOUS — guessing
    # "closed" here caused false OFFLINE alerts. is_open=None means UNKNOWN:
    # callers must not flip status, alert, or overwrite the last known state.
    if opened is not None:
        is_open = bool(opened)
    elif next_open is not None:
        is_open = False
    else:
        is_open = None

    import re as _re2
    try:
        rating = float(restaurant_info.get("avg_rating")) if restaurant_info.get("avg_rating") else None
    except (TypeError, ValueError):
        rating = None
    # totalRatingsString like "1.2K ratings" / "163 ratings" -> integer
    rating_count = None
    m = _re2.match(r"([\d.,]+)\s*([KkMm]?)", str(restaurant_info.get("total_ratings") or "").strip())
    if m:
        try:
            n = float(m.group(1).replace(",", ""))
            n *= {"k": 1e3, "m": 1e6}.get(m.group(2).lower(), 1)
            rating_count = int(n)
        except (TypeError, ValueError):
            rating_count = None

    return {
        "platform": "swiggy",
        "restaurant_id": restaurant_info.get("id", ""),
        "fetched_at": datetime.utcnow().isoformat(),
        "is_open": is_open,
        "next_open_message": avail.get("nextOpenTimeMessage"),
        "rating": rating,
        "rating_count": rating_count,
        "items": items,
        "item_count": len(items),
    }
