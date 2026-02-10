-- Add avatar_url column to profiles table for profile images
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment
COMMENT ON COLUMN profiles.avatar_url IS 'URL or path to user profile image';
