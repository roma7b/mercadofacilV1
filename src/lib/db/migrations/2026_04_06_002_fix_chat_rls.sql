-- Fix RLS for chat_messages
ALTER TABLE IF EXISTS chat_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to be clean
DROP POLICY IF EXISTS "Public messages are viewable by everyone" ON chat_messages;
DROP POLICY IF EXISTS "Users can create messages" ON chat_messages;
DROP POLICY IF EXISTS "Public messages are insertable by everyone" ON chat_messages;

-- Create new robust policies
-- Allow everyone (anonymous too) to READ messages
CREATE POLICY "Public messages are viewable by everyone" 
ON chat_messages FOR SELECT 
USING (true);

-- Allow everyone (logged or not, depending on your business rule, but let's allow everyone to keep it 'live' and testable)
-- Real messages from users will have user_id, bots will have is_bot = true.
CREATE POLICY "Public messages are insertable by everyone" 
ON chat_messages FOR INSERT 
WITH CHECK (true);

-- Ensure users table also allows public select of usernames (needed for join)
-- This might already exist but just in case
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users' AND schemaname = 'public') THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Public usernames are viewable by everyone" ON public.users;
        CREATE POLICY "Public usernames are viewable by everyone" ON public.users FOR SELECT USING (true);
    END IF;
END $$;
