# Supabase SQL Migrations (Project WCT)

This folder contains SQL snippets to fix schema gaps reported by the app.

## Migration Files (Run in Order)

### 001_create_quizzes.sql
Creates the `quizzes` table.

### 002_add_created_at_columns.sql
Adds `created_at` columns to classes and assignments tables.

### 003_fix_classes_title_trigger.sql
Fixes the classes table trigger to handle title/name gracefully.

### 004_create_class_students_table.sql
Creates the `class_students` enrollment junction table.

### 005_create_assignments_table.sql
Creates the `assignments` table with proper schema and RLS policies.

## How to Run Migrations

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** > **New query**.
3. Paste the contents of the migration file and click **Run**.
4. Verify the changes under **Table Editor**.

## Notes
- All tables use `id` as primary key (not `_id`).
- The backend uses the service role key which bypasses RLS, but policies are included for completeness.
- Triggers handle `updated_at` columns automatically.
- Foreign keys reference `public.classes(id)` and `public.profiles(id)`.

## Troubleshooting
If you see schema errors:
1. Check which migration hasn't been run yet.
2. Run migrations in order (001, 002, 003, etc.).
3. Check server logs for detailed error messages.
4. Verify table names and column names match in the Supabase dashboard.