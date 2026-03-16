create table if not exists public.pm_programs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade unique,
  title text not null default 'Quarterly PM',
  frequency_months integer not null check (frequency_months > 0 and frequency_months <= 120),
  start_date date not null,
  next_due_at date not null,
  last_completed_at date,
  is_active boolean not null default true,
  instructions text,
  checklist_template jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.pm_logs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  pm_program_id uuid not null references public.pm_programs(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  due_at date not null,
  completed_at date,
  status text not null check (status in ('completed', 'skipped')),
  performed_by text,
  summary text,
  work_notes text,
  findings text,
  follow_up_required boolean not null default false,
  checklist_results jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists pm_programs_account_active_idx
on public.pm_programs (account_id, is_active, next_due_at);

create index if not exists pm_logs_program_due_idx
on public.pm_logs (pm_program_id, due_at desc);

create trigger set_pm_programs_updated_at
before update on public.pm_programs
for each row execute procedure public.set_updated_at();

create trigger set_pm_logs_updated_at
before update on public.pm_logs
for each row execute procedure public.set_updated_at();

alter table public.pm_programs enable row level security;
alter table public.pm_logs enable row level security;

create policy "pm programs account isolation"
on public.pm_programs
for all
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());

create policy "pm logs account isolation"
on public.pm_logs
for all
using (account_id = public.current_account_id())
with check (account_id = public.current_account_id());
