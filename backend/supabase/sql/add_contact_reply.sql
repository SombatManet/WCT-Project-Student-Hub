-- Add reply fields to contact_messages table
ALTER TABLE contact_messages
ADD COLUMN IF NOT EXISTS admin_reply TEXT,
ADD COLUMN IF NOT EXISTS replied_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_replied_at ON contact_messages(replied_at);

-- Add comment
COMMENT ON COLUMN contact_messages.admin_reply IS 'Admin reply to the contact message';
COMMENT ON COLUMN contact_messages.replied_by IS 'ID of admin who replied';
COMMENT ON COLUMN contact_messages.replied_at IS 'Timestamp when reply was sent';
