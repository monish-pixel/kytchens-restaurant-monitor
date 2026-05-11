import httpx
import json
from datetime import datetime
from typing import Optional

ZOMATO_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-IN,en-US;q=0.9,en;q=0.8",
    "Referer": "https://www.zomato.com/pune",
    "x-zomato-csrft": "1",
}


def fetch(res_slug: str) -> dict:
    url = f"https://www.zomato.com/webroutes/getPage?page_url=/{res_slug}/order"
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

    is_open = timing.get("show_open_now", False)
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
