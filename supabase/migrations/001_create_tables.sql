create table if not exists snapshots (
  id bigint generated always as identity primary key,
  platform text not null,
  restaurant_id text not null,
  fetched_at timestamptz default now(),
  fetch_method text default 'auto',
  is_open boolean,
  fail_count int default 0,
  raw_json jsonb
);

create index if not exists snapshots_platform_restaurant_fetched_idx
  on snapshots (platform, restaurant_id, fetched_at desc);

create table if not exists menu_items (
  id bigint generated always as identity primary key,
  snapshot_id bigint references snapshots(id) on delete cascade,
  category text,
  name text,
  item_id text,
  in_stock boolean,
  is_enabled boolean default true
);

create table if not exists status_changes (
  id bigint generated always as identity primary key,
  platform text not null,
  changed_at timestamptz default now(),
  prev_open boolean,
  curr_open boolean
);

create table if not exists alerts (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  platform text,
  alert_type text,
  details text,
  notified boolean default false
);

-- RLS (idempotent: alter is safe to re-run)
alter table snapshots enable row level security;
alter table menu_items enable row level security;
alter table status_changes enable row level security;
alter table alerts enable row level security;

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
end $$;
