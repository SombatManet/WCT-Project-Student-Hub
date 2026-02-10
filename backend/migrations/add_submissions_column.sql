-- Add missing columns to assignments table
ALTER TABLE assignments 
ADD COLUMN IF NOT EXISTS submissions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add comments
COMMENT ON COLUMN assignments.submissions IS 'Array of submission objects containing student ID, file info, grades, and feedback';

-- Create index for better query performance on submissions
CREATE INDEX IF NOT EXISTS idx_assignments_submissions ON assignments USING GIN (submissions);

-- Drop existing trigger if it exists (idempotent)
DROP TRIGGER IF EXISTS handle_updated_at ON assignments;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
