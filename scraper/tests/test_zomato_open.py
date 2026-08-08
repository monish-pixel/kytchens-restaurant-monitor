"""Zomato open/closed rule — guards both false-negative failure modes.

Neither res_status_text nor isServiceable is reliable alone:
  - res_status_text says "Closed for dining" for delivery-only kitchens at night
    while delivery is live (the original all-offline bug).
  - isServiceable comes back False for outlets outside the unauthenticated
    serviceability radius (e.g. Kharadi) even while open (the Kharadi bug,
    2026-08-08). Online if EITHER positive signal holds.
"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "scrapers"))
from zomato import parse


def _data(status=None, serv=None, online=None, temp=False, perm=False):
    return {"page_data": {
        "sections": {"SECTION_BASIC_INFO": {
            "res_status_text": status, "is_temp_closed": temp, "is_perm_closed": perm,
            "timing": {}, "res_id": "x", "rating_new": {}}},
        "order": {"menuList": {"menus": []}},
        "orderDetails": {"isServiceable": serv, "hasOnlineOrdering": online}}}


def test_open_now_but_not_serviceable_is_online():
    # Kharadi bug: open clock, delivery not serviceable from city-centre point.
    assert parse(_data("Open now", serv=False, online=True))["is_open"] is True


def test_closed_for_dining_but_serviceable_is_online():
    # Night bug: delivery live, dine-in closed.
    assert parse(_data("Closed for dining", serv=True, online=True))["is_open"] is True


def test_both_signals_closed_is_offline():
    assert parse(_data("Closed", serv=False, online=True))["is_open"] is False


def test_temp_closed_overrides_open_clock():
    assert parse(_data("Open now", serv=True, online=True, temp=True))["is_open"] is False


def test_online_ordering_disabled_is_offline():
    assert parse(_data("Open now", serv=True, online=False))["is_open"] is False


def test_no_signal_is_unknown():
    assert parse(_data(None, serv=None, online=None))["is_open"] is None
