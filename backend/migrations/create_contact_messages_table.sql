-- Create contact_messages table
CREATE TABLE IF NOT EXISTS contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_status ON contact_messages(status);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at ON contact_messages(created_at DESC);

-- Enable RLS
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert (public contact form)
DROP POLICY IF EXISTS "Allow public insert on contact_messages" ON contact_messages;
CREATE POLICY "Allow public insert on contact_messages"
  ON contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Policy: Only admins can view/update
DROP POLICY IF EXISTS "Allow admin read on contact_messages" ON contact_messages;
CREATE POLICY "Allow admin read on contact_messages"
  ON contact_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Allow admin update on contact_messages" ON contact_messages;
CREATE POLICY "Allow admin update on contact_messages"
  ON contact_messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS handle_updated_at_contact_messages ON contact_messages;
CREATE TRIGGER handle_updated_at_contact_messages
  BEFORE UPDATE ON contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();
