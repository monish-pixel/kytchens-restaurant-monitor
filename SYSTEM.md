# Kytchens Fleet Monitor — System Overview

A restaurant monitoring tool that tracks whether Kytchens brands are live on Swiggy and Zomato, compares menus across platforms, and alerts the team when something goes wrong.

**Live dashboard:** https://restaurant-monitor-dashboard.vercel.app  
**Code:** https://github.com/monish-pixel/kytchens-restaurant-monitor

---

## What it does

Every 30 minutes it checks every brand's Swiggy and Zomato listing and answers three questions:

1. **Is the store online?** — Is it accepting orders right now?
2. **Are all menu items consistent?** — Do both platforms have the same fixed menu items?
3. **What changed?** — Did any brand go offline, come back, or lose an item?

When a brand goes offline, a Slack alert fires within ~30 minutes.

---

## Brands currently monitored

| Brand | Location | City | Swiggy | Zomato |
|-------|----------|------|--------|--------|
| Bina | Kalyani Nagar | Pune | ✓ | ✓ |
| Cookie Cartel | Kalyani Nagar | Pune | ✓ | ✓ |
| Cookie Cartel | Marol | Mumbai | ✓ | — |
| Entisi | Kalyani Nagar | Pune | ✓ | ✓ |
| Ether | Kalyani Nagar | Pune | ✓ | ✓ |
| Noto | Kalyani Nagar | Pune | ✓ | — |
| Parsi Dairy Farm | Kalyani Nagar | Pune | ✓ | ✓ |
| Prasuma | Kalyani Nagar | Pune | ✓ | ✓ |
| Taatsu | Kalyani Nagar | Pune | ✓ | ✓ |

`—` means the brand isn't listed on that platform (or monitoring not yet configured).

---

## How it scrapes

### Trigger
An external cron service (cron-job.org) fires every 30 minutes and calls a Vercel API endpoint (`/api/trigger-scrape`), which in turn triggers a GitHub Actions workflow. This is more reliable than GitHub's built-in scheduler, which has known delays.

### What runs
GitHub Actions runs four jobs in sequence:

```
1. Sync Sheets   → reads Google Sheet → updates restaurant config in database
2. Split Shards  → divides restaurants into parallel batches
3. Scrape (×N)   → each batch scrapes Swiggy + Zomato simultaneously
4. Summarize     → aggregates results, sends alerts if needed
```

The scrape jobs run in parallel — each brand gets its own shard so all brands finish in roughly the same time regardless of how many there are.

### Swiggy scraping
Uses a headless Chromium browser (Playwright) to load the Swiggy mobile web page. The scraper intercepts the network call to Swiggy's mobile API (`mapi/menu/pl`) — this is the same API call the Swiggy mobile app makes. It then re-calls that API with explicit Pune coordinates (lat/lng) so the server returns the correct open/closed status for a Pune customer, not the US server's location.

### Zomato scraping
Uses a direct HTTP call (no browser needed) to Zomato's web route API, using an Android mobile User-Agent and Pune coordinates. This returns the same data a customer in Pune would see on the Zomato app.

### What gets stored
For every brand on every platform, each scrape stores:
- **Open/closed status** at that moment
- **Full menu** — every item with name, category, and stock status
- **Timestamp** of when it was checked

If the status hasn't changed since the last scrape, only the timestamp is updated (no duplicate rows).

---

## How location-level navigation works

The system is organised by **city → location → brand**. Each location gets a URL like:

```
/l/{city-slug}/{location-slug}
```

For example:
- `/l/pune/kalyani-nagar` → all brands at Kalyani Nagar, Pune
- `/l/mumbai/marol` → Cookie Cartel at Marol, Mumbai

The `city_slug` and `location_slug` are stored in the database alongside each brand. When you open a location page you see:
- Current status (ONLINE / OFFLINE) per brand per platform
- Time since last check
- Item counts and out-of-stock items
- 7-day uptime sparklines per brand
- Recent status changes (when did each brand last go online/offline)
- Active alerts with a dismiss button

The main dashboard (`/`) shows an overview of all locations grouped by city, with offline counts per platform.

---

## Dashboard sections

### Store Live (`/`)
Real-time view of all brands. Shows ONLINE / OFFLINE per platform. Brands with issues float to the top. Click any location to drill in.

### Menu Check (`/menu-check`)
Compares the fixed menu across Swiggy and Zomato for each brand. Flags items that exist on one platform but not the other. **"Recommended", "Bestseller", and "Most Ordered" categories are excluded** — those are platform-curated and will always differ.

### Reports (`/reports`)
7-day downtime history. Shows when each brand went offline, when it came back, and how long it was down. Filter by Swiggy or Zomato.

---

## Alerts

When a brand goes offline, a **Slack message** fires: which brand, which platform, went offline or came back online.

A **health check endpoint** (`/api/health`) returns 200 when data is fresh and 503 if the scraper hasn't run in 90+ minutes. UptimeRobot monitors this endpoint every 5 minutes and sends a Slack alert if it goes down — this is the "dead man's switch" that catches the scraper itself failing.

---

## Data flow

```
Google Sheet
    │
    ▼ (every 30 min)
sync_sheets.py ──→ Supabase: restaurants table
                        │
                        ▼
             split_shards.py ──→ parallel scrape jobs
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
                   swiggy.py              zomato.py
                  (Playwright +          (httpx + Android
                   mobile API)            UA + Pune coords)
                          │                     │
                          └──────────┬──────────┘
                                     ▼
                              Supabase:
                              snapshots table      ← open/closed per cycle
                              menu_items table     ← full item list per cycle
                              status_changes table ← when status flipped
                              alerts table         ← Slack alert queue
                                     │
                                     ▼
                          Next.js dashboard
                          (Vercel, updates every 30 min)
```

---

## Database (Supabase)

| Table | What's in it |
|-------|-------------|
| `restaurants` | Master list of brands — name, location, city, Swiggy ID, Zomato slug |
| `snapshots` | One row per brand per platform per scrape cycle — open/closed status + timestamp |
| `menu_items` | Every menu item from every snapshot — name, category, in-stock |
| `status_changes` | Record of every time a brand flipped from online→offline or offline→online |
| `alerts` | Alert log — each Slack notification that was sent |

---

## How to add a new brand

### Option 1 — Google Sheet (preferred)
Add a new row to the Kytchens monitoring Google Sheet with: brand name, location, city, Swiggy URL or ID, Zomato URL slug. The sheet syncs to the database automatically on the next scrape run.

### Option 2 — Direct database insert
Run a SQL insert into the `restaurants` table in Supabase with the fields: `brand`, `location`, `location_slug`, `city`, `city_slug`, `swiggy_id`, `swiggy_slug`, `zomato_slug`, `should_be_live_swiggy`, `should_be_live_zomato`, `active = true`.

The brand will appear on the dashboard after the next scrape cycle (~30 minutes).

**To find the Swiggy ID:** look at the Swiggy restaurant URL — the number after `rest` is the ID. Example: `https://www.swiggy.com/city/mumbai/cookie-cartel-marol-sakinaka-rest1203979` → ID is `1203979`.

**To find the Zomato slug:** take everything after `zomato.com/` in the restaurant URL, up to `/order`. Example: `https://www.zomato.com/pune/cookie-cartel-wadgaon-sheri/order` → slug is `pune/cookie-cartel-wadgaon-sheri`.

---

## Tech stack

| Component | Technology |
|-----------|-----------|
| Scraper | Python, Playwright (headless Chrome), httpx |
| Schedule | cron-job.org → GitHub Actions |
| Database | Supabase (PostgreSQL) |
| Dashboard | Next.js (App Router), Tailwind CSS |
| Hosting | Vercel (dashboard), GitHub Actions (scraper) |
| Alerts | Slack webhook |
| Health monitoring | UptimeRobot |

---

## Key numbers

- Scrape frequency: every 30 minutes
- Brands monitored: 9 (across Pune and Mumbai)
- Platforms: Swiggy, Zomato
- Alert latency: within 30 minutes of a brand going offline
- Health check frequency: every 5 minutes (UptimeRobot)
