-- Version 2: exam planner, settings, Canvas feed. Run once in Supabase: SQL Editor > New query > paste > Run.

-- The one user of this app (used by the Canvas sync job, which runs without a login)
create or replace function public.first_user() returns uuid
language sql stable security definer set search_path = public, auth
as $$ select id from auth.users order by created_at limit 1 $$;

-- Exam planner: what you'll study on which day
create table if not exists study_plan (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users on delete cascade,
  date        date not null,
  course      text,
  topic       text,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists study_plan_date_idx on study_plan (date);

-- Small per-user settings (e.g. exam period start/end)
create table if not exists settings (
  user_id  uuid not null default auth.uid() references auth.users on delete cascade,
  key      text not null,
  value    text,
  primary key (user_id, key)
);

-- Assignments seen in your Canvas calendar feed
create table if not exists canvas_items (
  uid          text primary key,
  user_id      uuid not null default public.first_user() references auth.users on delete cascade,
  title        text not null,
  course       text,
  url          text,
  due_at       timestamptz,
  all_day      boolean not null default false,
  seen         boolean not null default false,
  task_id      uuid,
  first_seen   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table study_plan   enable row level security;
alter table settings     enable row level security;
alter table canvas_items enable row level security;

drop policy if exists "own study"    on study_plan;
drop policy if exists "own settings" on settings;
drop policy if exists "own canvas"   on canvas_items;
create policy "own study"    on study_plan   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own settings" on settings     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own canvas"   on canvas_items for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on study_plan, settings to authenticated;
grant select, update on canvas_items to authenticated;
grant all on study_plan, settings, canvas_items to service_role;
grant execute on function public.first_user() to service_role;
