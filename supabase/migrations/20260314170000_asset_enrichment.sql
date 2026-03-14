alter table public.assets
add column if not exists model text,
add column if not exists serial text,
add column if not exists service_application text,
add column if not exists status text not null default 'unknown';

update public.assets
set status = 'unknown'
where status is null;

create table if not exists public.asset_drivers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  asset_id uuid not null unique references public.assets(id) on delete cascade,
  motor_oem text,
  motor_model text,
  hp text,
  rpm text,
  voltage text,
  frame text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.asset_couplings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  asset_id uuid not null unique references public.assets(id) on delete cascade,
  oem text,
  coupling_type text,
  size text,
  spacer text,
  notes text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_asset_drivers_updated_at
before update on public.asset_drivers
for each row execute procedure public.set_updated_at();

create trigger set_asset_couplings_updated_at
before update on public.asset_couplings
for each row execute procedure public.set_updated_at();

alter table public.asset_drivers enable row level security;
alter table public.asset_couplings enable row level security;

create policy "asset drivers account isolation"
on public.asset_drivers
for all
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

create policy "asset couplings account isolation"
on public.asset_couplings
for all
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());
