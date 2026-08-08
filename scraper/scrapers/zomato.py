import json
from datetime import datetime
from typing import Optional

try:
    import httpx
except ImportError:  # parse()/is_valid() work without httpx (local tests)
    httpx = None

# Mobile Android User-Agent mirrors what the Zomato app sends.
# The web route returns delivery-aware open/closed when called with a mobile
# UA and explicit Pune coordinates — avoids IP-geolocation drift from US servers.
ZOMATO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en;q=0.9",
    "Referer": "https://www.zomato.com/pune",
    "x-zomato-csrft": "1",
    "x-city-info": "pune",
}

# Pune coordinates — passed as query params so the server computes
# delivery availability for a Pune customer, not the scraper's US IP.
PUNE_LAT = "18.5204"
PUNE_LNG = "73.8567"


def fetch(res_slug: str) -> dict:
    url = (
        f"https://www.zomato.com/webroutes/getPage"
        f"?page_url=/{res_slug}/order"
        f"&lat={PUNE_LAT}&lng={PUNE_LNG}"
    )
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        resp = client.get(url, headers=ZOMATO_HEADERS)
    resp.raise_for_status()
    return resp.json()


def is_valid(data: dict) -> bool:
    try:
        data["page_data"]["order"]["menuList"]["menus"]
        return True
    except (KeyError, TypeError):
        return False


def parse(data: dict) -> dict:
    sections = data["page_data"]["sections"]
    basic = sections.get("SECTION_BASIC_INFO", {})
    timing = basic.get("timing", {})
    order = data["page_data"]["order"]

    # Two independent "open" signals, each a false-negative on its OWN:
    #   - res_status_text follows the restaurant clock but reads "Closed for dining"
    #     for delivery-only kitchens even at 2am while delivery is live.
    #   - orderDetails.isServiceable is delivery availability to the *query* location;
    #     it comes back False for outlets outside the unauthenticated serviceability
    #     radius (e.g. Kharadi) even while the outlet is open and taking orders.
    # So: online if EITHER positive signal holds; offline only when both say closed
    # (or the outlet is explicitly temp/perm closed). Verified live 2026-08-08 —
    # Bina & Parsi Kharadi were "Open now" + hasOnlineOrdering yet isServiceable False.
    status_text = basic.get("res_status_text", "")
    is_perm_closed = basic.get("is_perm_closed", False)
    is_temp_closed = basic.get("is_temp_closed", False)
    order_details = data.get("page_data", {}).get("orderDetails", {})
    is_serviceable = order_details.get("isServiceable")
    has_online_ordering = order_details.get("hasOnlineOrdering")

    if is_perm_closed or is_temp_closed:
        is_open = False
    elif status_text or is_serviceable is not None:
        sl = (status_text or "").lower()
        open_by_clock = "open now" in sl or "closes" in sl
        is_open = (open_by_clock or is_serviceable is True) and (has_online_ordering is not False)
    else:
        # no signal at all → UNKNOWN; caller must not flip status or alert on it
        is_open = None
    timing_desc = timing.get("timing_desc", "")
    res_id = str(basic.get("res_id", ""))

    # Delivery rating + review count (e.g. 4.1 from "163 Delivery Reviews")
    delivery = basic.get("rating_new", {}).get("ratings", {}).get("DELIVERY", {})
    try:
        rating = float(delivery.get("rating") or delivery.get("ratingV2")) if delivery.get("rating") or delivery.get("ratingV2") else None
    except (TypeError, ValueError):
        rating = None
    try:
        rating_count = int(str(delivery.get("reviewCount", "")).replace(",", "")) or None
    except (TypeError, ValueError):
        rating_count = None

    items = []
    menus = order.get("menuList", {}).get("menus", [])
    for menu_block in menus:
        menu = menu_block.get("menu", {})
        menu_name = menu.get("name", "")
        for cat_block in menu.get("categories", []):
            cat = cat_block.get("category", {})
            cat_name = cat.get("name", "") or menu_name
            for item_block in cat.get("items", []):
                item = item_block.get("item", {})
                tag_slugs = item.get("tag_slugs", [])
                in_stock = "delivery-enabled" in tag_slugs
                is_enabled = "dish-not-available" not in tag_slugs
                items.append({
                    "name": item.get("name", ""),
                    "id": item.get("id", ""),
                    "category": cat_name,
                    "in_stock": in_stock,
                    "is_enabled": is_enabled,
                    "is_veg": "veg" in item.get("dietary_slugs", []),
                })

    return {
        "platform": "zomato",
        "restaurant_id": res_id,
        "fetched_at": datetime.utcnow().isoformat(),
        "is_open": is_open,
        "timing_desc": timing_desc,
        "rating": rating,
        "rating_count": rating_count,
        "items": items,
        "item_count": len(items),
    }
