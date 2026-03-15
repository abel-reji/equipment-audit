alter table public.sites
add column if not exists last_used_at timestamptz;
