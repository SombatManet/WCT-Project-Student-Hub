-- Create quizzes table compatible with admin routes and UI
-- Run this in Supabase SQL editor (project > SQL > New query)

-- Ensure required extensions
create extension if not exists pgcrypto;

create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  -- app supports both title/name; keep either or both
  title text null,
  name text null,
  description text null,
  class_id uuid not null,
  teacher_id uuid not null,
  questions jsonb not null default '[]'::jsonb,
  time_limit integer not null default 30,
  submissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- FK constraints (adjust if your table names differ)
alter table public.quizzes
  add constraint fk_quizzes_class
  foreign key (class_id) references public.classes(id) on delete cascade;

alter table public.quizzes
  add constraint fk_quizzes_teacher
  foreign key (teacher_id) references public.profiles(id) on delete set null;

-- Indexes for common lookups
create index if not exists idx_quizzes_class on public.quizzes(class_id);
create index if not exists idx_quizzes_teacher on public.quizzes(teacher_id);
create index if not exists idx_quizzes_created_at on public.quizzes(created_at);

-- Update updated_at automatically
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;

create trigger quizzes_set_updated_at
before update on public.quizzes
for each row execute function public.set_updated_at();

-- Optional: basic RLS setup (service role bypasses RLS)
-- alter table public.quizzes enable row level security;
-- create policy "read quizzes" on public.quizzes
--   for select using (true);
-- create policy "insert quizzes for teachers" on public.quizzes
--   for insert with check (auth.uid() = teacher_id);
-- create policy "update own quizzes" on public.quizzes
--   for update using (auth.uid() = teacher_id);
