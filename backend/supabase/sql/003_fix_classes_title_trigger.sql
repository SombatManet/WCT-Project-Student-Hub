-- Fix the classes trigger that references NEW.title when column doesn't exist
-- This script will add the title column if missing, or update the trigger

-- Step 1: Add title column if it doesn't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'classes' and column_name = 'title'
  ) then
    alter table public.classes add column title text;
  end if;
end $$;

-- Step 2: Replace the trigger to use COALESCE (handles both title and name)
-- This finds and drops the existing trigger if it exists
drop trigger if exists on_classes_insert on public.classes;
drop function if exists public.handle_classes_insert() cascade;

-- Step 3: Create a new trigger that handles title/name gracefully
create or replace function public.handle_classes_insert()
returns trigger language plpgsql as $$
begin
  -- Set title from incoming value, or use name as fallback
  if new.title is null and new.name is not null then
    new.title := new.name;
  end if;
  return new;
end; $$;

create trigger on_classes_insert
before insert on public.classes
for each row execute function public.handle_classes_insert();

-- Step 4: Backfill missing titles from name column for existing rows
update public.classes set title = name where title is null and name is not null;
update public.classes set title = 'Untitled Class' where title is null;
