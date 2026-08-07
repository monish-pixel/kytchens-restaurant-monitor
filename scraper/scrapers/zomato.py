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

    # These are DELIVERY-ONLY cloud kitchens. res_status_text / timing.show_open_now
    # reflect DINE-IN ("Closed for dining" even at 2am while delivery is live), so
    # they wrongly reported every outlet closed. The real "accepting delivery orders"
    # signal is orderDetails.isServiceable (verified against live data 2026-08-08).
    status_text = basic.get("res_status_text", "")
    is_perm_closed = basic.get("is_perm_closed", False)
    is_temp_closed = basic.get("is_temp_closed", False)
    order_details = data.get("page_data", {}).get("orderDetails", {})
    is_serviceable = order_details.get("isServiceable")
    has_online_ordering = order_details.get("hasOnlineOrdering")

    if is_perm_closed or is_temp_closed:
        is_open = False
    elif is_serviceable is not None:
        # delivery live = the outlet is serviceable and online ordering is enabled
        is_open = bool(is_serviceable) and (has_online_ordering is not False)
    elif status_text:
        # fallback for pages without orderDetails: old text heuristic
        sl = status_text.lower()
        is_open = ("open now" in sl or "closes" in sl) and not is_perm_closed and not is_temp_closed
    else:
        # no signal at all → UNKNOWN; caller must not flip status or alert on it
        is_open = None
    timing_desc = timing.get("timing_desc", "")
    res_id = str(basic.get("res_id", ""))

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
        "items": items,
        "item_count": len(items),
    }
