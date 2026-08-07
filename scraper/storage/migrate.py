import os

_MIGRATION_SQL = """
create table if not exists snapshots (
  id bigint generated always as identity primary key,
  platform text not null,
  restaurant_id text not null,
  fetched_at timestamptz default now(),
  fetch_method text default 'auto',
  is_open boolean,
  fail_count int default 0,
  raw_json jsonb,
  brand text,
  location_slug text,
  city_slug text,
  menu_checksum text
);

create index if not exists snapshots_platform_restaurant_fetched_idx
  on snapshots (platform, restaurant_id, fetched_at desc);

create index if not exists snapshots_fleet_idx
  on snapshots (platform, restaurant_id, fetched_at desc);

create index if not exists snapshots_location_idx
  on snapshots (city_slug, location_slug, fetched_at desc);

create table if not exists menu_items (
  id bigint generated always as identity primary key,
  snapshot_id bigint references snapshots(id) on delete cascade,
  category text,
  name text,
  item_id text,
  in_stock boolean,
  is_enabled boolean default true
);

-- Self-heal: ensure the live menu_items FK actually cascades. A pre-existing table
-- created without cascade left orphaned menu_items when old snapshots were deleted;
-- with cascade, menu_items always holds only the latest scrape.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'menu_items_snapshot_id_fkey' and confdeltype = 'c'
  ) then
    alter table menu_items drop constraint if exists menu_items_snapshot_id_fkey;
    alter table menu_items add constraint menu_items_snapshot_id_fkey
      foreign key (snapshot_id) references snapshots(id) on delete cascade;
  end if;
end $$;

-- Ratings, day-wise: one row per (platform, outlet, day). Each scrape overwrites
-- TODAY's row; when the date rolls over, the previous day's row is frozen as history.
create table if not exists ratings (
  platform text not null,
  restaurant_id text not null,
  rating_date date not null,
  brand text,
  location_slug text,
  city_slug text,
  rating numeric,
  rating_count integer,
  updated_at timestamptz default now(),
  primary key (platform, restaurant_id, rating_date)
);
create index if not exists ratings_date_idx on ratings (rating_date desc);
alter table ratings enable row level security;
do $$
begin
  if not exists (select 1 from pg_policies where tablename='ratings' and policyname='public read ratings') then
    create policy "public read ratings" on ratings for select using (true);
  end if;
end $$;

create table if not exists status_changes (
  id bigint generated always as identity primary key,
  platform text not null,
  changed_at timestamptz default now(),
  prev_open boolean,
  curr_open boolean,
  restaurant_id text,
  brand text,
  location_slug text,
  city_slug text
);

create table if not exists alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  platform text,
  alert_type text,
  details text,
  notified boolean default false,
  restaurant_id text,
  brand text,
  location_slug text,
  city_slug text,
  acknowledged_at timestamptz,
  acknowledged_by text,
  check_cycle_at timestamptz
);

create index if not exists alerts_active_idx
  on alerts (restaurant_id, check_cycle_at desc)
  where acknowledged_at is null;

create table if not exists restaurants (
  id bigint generated always as identity primary key,
  brand text not null,
  location text not null,
  location_slug text not null,
  city text not null,
  city_slug text not null,
  swiggy_id text,
  swiggy_slug text,
  zomato_slug text,
  operational_hours_swiggy text,
  operational_hours_zomato text,
  should_be_live_swiggy boolean default true,
  should_be_live_zomato boolean default true,
  active boolean default true,
  synced_at timestamptz default now(),
  unique (brand, location_slug, city_slug)
);

create index if not exists restaurants_location_city_idx
  on restaurants (city_slug, location_slug);

create index if not exists restaurants_active_idx
  on restaurants (active) where active = true;

create table if not exists expected_items (
  id bigint generated always as identity primary key,
  brand text not null,
  location_slug text not null,
  city_slug text not null,
  platform text not null,
  item_name text not null,
  item_id text,
  should_be_live boolean default true,
  synced_at timestamptz default now(),
  unique (brand, location_slug, city_slug, platform, item_id)
);

alter table snapshots enable row level security;
alter table menu_items enable row level security;
alter table status_changes enable row level security;
alter table alerts enable row level security;
alter table restaurants enable row level security;
alter table expected_items enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='snapshots' and policyname='public read snapshots') then
    create policy "public read snapshots" on snapshots for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='menu_items' and policyname='public read menu_items') then
    create policy "public read menu_items" on menu_items for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='status_changes' and policyname='public read status_changes') then
    create policy "public read status_changes" on status_changes for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='alerts' and policyname='public read alerts') then
    create policy "public read alerts" on alerts for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restaurants' and policyname='public read restaurants') then
    create policy "public read restaurants" on restaurants for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='expected_items' and policyname='public read expected_items') then
    create policy "public read expected_items" on expected_items for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='snapshots' and policyname='service write snapshots') then
    create policy "service write snapshots" on snapshots for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='menu_items' and policyname='service write menu_items') then
    create policy "service write menu_items" on menu_items for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='status_changes' and policyname='service write status_changes') then
    create policy "service write status_changes" on status_changes for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='alerts' and policyname='service write alerts') then
    create policy "service write alerts" on alerts for all using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='restaurants' and policyname='service write restaurants') then
    create policy "service write restaurants" on restaurants for all using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='expected_items' and policyname='service write expected_items') then
    create policy "service write expected_items" on expected_items for all using (true);
  end if;
end $$;

-- Add new columns to existing tables if upgrading from v1 schema
alter table snapshots add column if not exists brand text;
alter table snapshots add column if not exists location_slug text;
alter table snapshots add column if not exists city_slug text;
alter table snapshots add column if not exists menu_checksum text;

alter table status_changes add column if not exists restaurant_id text;
alter table status_changes add column if not exists brand text;
alter table status_changes add column if not exists location_slug text;
alter table status_changes add column if not exists city_slug text;

alter table alerts add column if not exists restaurant_id text;
alter table alerts add column if not exists brand text;
alter table alerts add column if not exists location_slug text;
alter table alerts add column if not exists city_slug text;
alter table alerts add column if not exists acknowledged_at timestamptz;
alter table alerts add column if not exists acknowledged_by text;
alter table alerts add column if not exists check_cycle_at timestamptz;
"""


def run_migrations():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("[MIGRATE] DATABASE_URL not set — skipping migration", flush=True)
        return

    try:
        import psycopg2
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(_MIGRATION_SQL)
        conn.close()
        print("[MIGRATE] Tables ready", flush=True)
    except Exception as e:
        print(f"[MIGRATE] Skipped: {e}", flush=True)
