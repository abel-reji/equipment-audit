alter table public.assets
add column if not exists latitude double precision,
add column if not exists longitude double precision,
add column if not exists location_accuracy_meters double precision,
add column if not exists location_captured_at timestamptz;
