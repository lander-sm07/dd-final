-- Run this once in Supabase: SQL Editor > New query > paste > Run.

create table if not exists courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  name        text not null,
  color       text not null default '#6CC4FF',
  canvas_url  text,
  site_url    text,
  sort        int  not null default 0,
  created_at  timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists tasks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users on delete cascade,
  title           text not null,
  course          text,
  kind            text not null default 'deadline' check (kind in ('deadline','exam','todo')),
  due_date        date,
  due_time        time,
  status          text not null default 'todo' check (status in ('todo','working','done')),
  starred         boolean not null default false,
  notes           text,
  reminders_sent  text[] not null default '{}',
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);
create index if not exists tasks_due_idx on tasks (due_date);

create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

-- Used only by the reminder job (service key), e.g. "last morning digest sent".
create table if not exists meta (
  key   text primary key,
  value text
);

-- Security: you can only see/edit your own rows. The reminder job uses the
-- service key, which bypasses these rules.
alter table courses enable row level security;
alter table tasks   enable row level security;
alter table notes   enable row level security;
alter table meta    enable row level security;  -- no policies = not reachable from the website

drop policy if exists "own courses" on courses;
drop policy if exists "own tasks"   on tasks;
drop policy if exists "own notes"   on notes;
create policy "own courses" on courses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own tasks"   on tasks   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own notes"   on notes   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
