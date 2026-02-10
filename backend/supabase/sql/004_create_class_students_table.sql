-- Create class_students enrollment table for student-class relationships
-- Run this in Supabase SQL editor if your classes table doesn't have a students column

create table if not exists public.class_students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique(class_id, student_id)
);

-- Index for fast lookups
create index if not exists idx_class_students_class on public.class_students(class_id);
create index if not exists idx_class_students_student on public.class_students(student_id);

-- Optional RLS (service role bypasses these)
-- alter table public.class_students enable row level security;
-- create policy "students can view their enrollments" on public.class_students
--   for select using (auth.uid() = student_id);
