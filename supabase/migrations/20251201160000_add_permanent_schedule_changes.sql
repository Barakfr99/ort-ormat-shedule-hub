create table if not exists public.permanent_schedule_changes (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  day_of_week text not null,
  hour_number integer not null check (hour_number >= 1 and hour_number <= 8),
  subject text not null,
  teacher text not null default '',
  room text not null default '',
  created_at timestamptz default now()
);

alter table public.permanent_schedule_changes
  add constraint permanent_schedule_day_check
  check (day_of_week in ('ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'));

create unique index if not exists permanent_schedule_changes_student_day_hour_idx
  on public.permanent_schedule_changes (student_id, day_of_week, hour_number);

alter table public.permanent_schedule_changes enable row level security;

create policy if not exists "Allow all operations on permanent changes"
  on public.permanent_schedule_changes
  for all
  using (true)
  with check (true);

