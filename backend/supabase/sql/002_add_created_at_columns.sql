-- Add created_at columns to commonly used tables if missing
-- Safe to run multiple times due to IF statements

-- classes
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes' and column_name = 'created_at'
  ) then
    alter table public.classes add column created_at timestamptz not null default now();
  end if;
end $$;

-- assignments
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'created_at'
  ) then
    alter table public.assignments add column created_at timestamptz not null default now();
  end if;
end $$;
