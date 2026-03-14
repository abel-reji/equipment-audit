create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  client_uid text not null,
  name text not null,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (account_id, client_uid)
);

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  client_uid text not null,
  name text not null,
  address text,
  area_unit text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (account_id, client_uid)
);

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  client_uid text not null,
  temporary_identifier text,
  equipment_tag text,
  equipment_type text not null,
  manufacturer text,
  quick_note text,
  capture_status text not null default 'queued',
  captured_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (account_id, client_uid)
);

create table if not exists public.asset_photos (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  client_uid text not null,
  local_draft_id text,
  photo_type text not null,
  storage_path text not null,
  captured_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (account_id, client_uid)
);

create or replace function public.current_account_id()
returns uuid
language sql
stable
as $$
  select id from public.accounts where auth_user_id = auth.uid()
$$;

create trigger set_accounts_updated_at
before update on public.accounts
for each row execute procedure public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute procedure public.set_updated_at();

create trigger set_sites_updated_at
before update on public.sites
for each row execute procedure public.set_updated_at();

create trigger set_assets_updated_at
before update on public.assets
for each row execute procedure public.set_updated_at();

create trigger set_asset_photos_updated_at
before update on public.asset_photos
for each row execute procedure public.set_updated_at();

alter table public.accounts enable row level security;
alter table public.customers enable row level security;
alter table public.sites enable row level security;
alter table public.assets enable row level security;
alter table public.asset_photos enable row level security;

create policy "accounts owner can read"
on public.accounts
for select
using (auth.uid() = auth_user_id);

create policy "accounts owner can insert"
on public.accounts
for insert
with check (auth.uid() = auth_user_id);

create policy "accounts owner can update"
on public.accounts
for update
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

create policy "customers account isolation"
on public.customers
for all
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

create policy "sites account isolation"
on public.sites
for all
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

create policy "assets account isolation"
on public.assets
for all
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

create policy "asset photos account isolation"
on public.asset_photos
for all
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

insert into storage.buckets (id, name, public)
values ('asset-photos', 'asset-photos', false)
on conflict (id) do nothing;

create policy "authenticated users can read own photo objects"
on storage.objects
for select
using (
  bucket_id = 'asset-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "authenticated users can upload own photo objects"
on storage.objects
for insert
with check (
  bucket_id = 'asset-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "authenticated users can update own photo objects"
on storage.objects
for update
using (
  bucket_id = 'asset-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'asset-photos'
  and auth.role() = 'authenticated'
  and (storage.foldername(name))[1] = auth.uid()::text
);

