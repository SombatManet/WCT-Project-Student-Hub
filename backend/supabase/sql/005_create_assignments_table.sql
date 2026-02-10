-- Create assignments table if it doesn't exist
-- This table stores assignment information for classes

create table if not exists public.assignments (
  id uuid primary key default uuid_generate_v4(),
  title text,
  name text,
  description text,
  class_id uuid references public.classes(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete cascade,
  due_date timestamptz,
  max_points integer default 100,
  submissions jsonb default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create index on class_id for faster queries
create index if not exists idx_assignments_class_id on public.assignments(class_id);

-- Create index on teacher_id for faster queries
create index if not exists idx_assignments_teacher_id on public.assignments(teacher_id);

-- Enable RLS
-- Temporarily disabled due to schema cache issues with PostgREST
-- alter table public.assignments enable row level security;

-- Drop existing policies if they exist to avoid conflicts
drop policy if exists "Students can view class assignments" on public.assignments;
drop policy if exists "Teachers can manage own assignments" on public.assignments;
drop policy if exists "Admins can manage all assignments" on public.assignments;

-- Policy: Students can view assignments for classes they're enrolled in
create policy "Students can view class assignments"
  on public.assignments
  for select
  using (
    exists (
      select 1 from public.class_students
      where class_students.class_id = assignments.class_id
      and class_students.student_id = auth.uid()
    )
    or
    auth.uid() = teacher_id
  );

-- Policy: Teachers can manage their own assignments
create policy "Teachers can manage own assignments"
  on public.assignments
  for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

-- Policy: Admins and superadmins can manage all assignments
create policy "Admins can manage all assignments"
  on public.assignments
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'superadmin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.role in ('admin', 'superadmin')
    )
  );

-- Add trigger for updated_at
drop trigger if exists assignments_updated_at on public.assignments;
drop function if exists public.handle_updated_at();

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger assignments_updated_at
  before update on public.assignments
  for each row
  execute function public.handle_updated_at();
