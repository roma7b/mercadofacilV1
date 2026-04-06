-- ============================================================
-- Live Chat Migration
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     text REFERENCES public.users(id) ON DELETE CASCADE, -- Can be NULL for bots if needed, but project uses NOT NULL for users
  mensagem    text NOT NULL,
  is_bot      boolean DEFAULT false,
  bot_name    text,
  created_at  timestamptz DEFAULT NOW() NOT NULL
);

-- Row Level Security
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can read chat messages' AND tablename = 'chat_messages') THEN
        CREATE POLICY "Anyone can read chat messages" ON public.chat_messages FOR SELECT USING (TRUE);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_chat_messages' AND tablename = 'chat_messages') THEN
        CREATE POLICY "service_role_all_chat_messages" ON public.chat_messages FOR ALL TO service_role USING (TRUE) WITH CHECK (TRUE);
    END IF;
END $$;
