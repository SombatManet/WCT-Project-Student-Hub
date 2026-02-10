-- Create personal_messages table for direct messaging between users
CREATE TABLE IF NOT EXISTS personal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT no_self_message CHECK (sender_id != recipient_id)
);

-- Create indexes for performance
CREATE INDEX idx_personal_messages_sender_id ON personal_messages(sender_id);
CREATE INDEX idx_personal_messages_recipient_id ON personal_messages(recipient_id);
CREATE INDEX idx_personal_messages_created_at ON personal_messages(created_at DESC);
CREATE INDEX idx_personal_messages_conversation ON personal_messages(
  GREATEST(sender_id, recipient_id),
  LEAST(sender_id, recipient_id)
);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_personal_messages_updated_at ON personal_messages;
CREATE TRIGGER handle_personal_messages_updated_at
BEFORE UPDATE ON personal_messages
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- Enable RLS
ALTER TABLE personal_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can see their own messages (sent or received)
CREATE POLICY "Users can view their messages"
ON personal_messages
FOR SELECT
USING (
  auth.uid() = sender_id OR auth.uid() = recipient_id
);

-- Users can send messages
CREATE POLICY "Users can send messages"
ON personal_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Users can update their received messages (mark as read)
CREATE POLICY "Users can update their received messages"
ON personal_messages
FOR UPDATE
USING (auth.uid() = recipient_id)
WITH CHECK (auth.uid() = recipient_id);
