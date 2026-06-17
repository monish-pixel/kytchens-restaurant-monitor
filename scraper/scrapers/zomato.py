import httpx
import json
from datetime import datetime
from typing import Optional

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

    # res_status_text is the primary field: "Open now" / "Opens at X"
    # also check order_status for delivery-specific availability (e.g. restaurant
    # open but delivery paused). Both must be affirmative for is_open = True.
    status_text = basic.get("res_status_text", "")
    is_perm_closed = basic.get("is_perm_closed", False)
    is_temp_closed = basic.get("is_temp_closed", False)
    # order_status present on delivery pages: "accepting_orders" means live
    order_status = (data.get("page_data", {}).get("order", {})
                    .get("actionInfo", {}).get("status", ""))
    schedule_open = "open" in status_text.lower() and not is_perm_closed and not is_temp_closed
    # if order_status is present, require it to confirm delivery is active
    if order_status:
        is_open = schedule_open and order_status == "accepting_orders"
    else:
        is_open = schedule_open
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
