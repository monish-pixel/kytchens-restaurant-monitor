import json
import os
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scrapers import swiggy, zomato

FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIXTURE_DIR, name)) as f:
        return json.load(f)


# --- Swiggy ---

def test_swiggy_is_valid():
    data = load("swiggy_menu.json")
    assert swiggy.is_valid(data)


def test_swiggy_is_valid_rejects_empty():
    assert not swiggy.is_valid({})
    assert not swiggy.is_valid({"data": {"cards": []}})


def test_swiggy_parse_returns_closed():
    data = load("swiggy_menu.json")
    parsed = swiggy.parse(data)
    assert parsed["platform"] == "swiggy"
    assert parsed["is_open"] is False  # fixture captured at midnight, restaurant closed
    assert parsed["item_count"] > 0
    assert parsed["next_open_message"] is not None


def test_swiggy_parse_items_have_required_fields():
    data = load("swiggy_menu.json")
    parsed = swiggy.parse(data)
    for item in parsed["items"]:
        assert "name" in item
        assert "category" in item
        assert "in_stock" in item
        assert "is_veg" in item


# --- Zomato ---

def test_zomato_is_valid():
    data = load("zomato_menu.json")
    assert zomato.is_valid(data)


def test_zomato_is_valid_rejects_empty():
    assert not zomato.is_valid({})
    assert not zomato.is_valid({"page_data": {}})


def test_zomato_parse_returns_open():
    data = load("zomato_menu.json")
    parsed = zomato.parse(data)
    assert parsed["platform"] == "zomato"
    # fixture has res_status_text="Open now" — correct field, not show_open_now (UTC-broken)
    assert parsed["is_open"] is True
    assert parsed["item_count"] > 0
    assert parsed["timing_desc"] != ""


def test_zomato_parse_items_have_required_fields():
    data = load("zomato_menu.json")
    parsed = zomato.parse(data)
    for item in parsed["items"]:
        assert "name" in item
        assert "category" in item
        assert "in_stock" in item
        assert "is_veg" in item


def test_zomato_items_all_enabled_when_open():
    data = load("zomato_menu.json")
    parsed = zomato.parse(data)
    # No item should have dish-not-available in this fixture
    disabled = [i for i in parsed["items"] if not i.get("is_enabled", True)]
    assert len(disabled) == 0, f"Unexpected disabled items: {disabled}"


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    passed = failed = 0
    for t in tests:
        try:
            t()
            print(f"  ✅ {t.__name__}")
            passed += 1
        except Exception as e:
            print(f"  ❌ {t.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
