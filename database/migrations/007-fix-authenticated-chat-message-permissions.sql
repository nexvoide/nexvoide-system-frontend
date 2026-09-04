BEGIN;

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.messages FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.messages TO authenticated;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_manages_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_channel(TEXT) TO authenticated;

DROP POLICY IF EXISTS "chat_messages_select" ON public.messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON public.messages;
DROP POLICY IF EXISTS "chat_messages_update" ON public.messages;
DROP POLICY IF EXISTS "chat_messages_delete" ON public.messages;

CREATE POLICY "chat_messages_select"
    ON public.messages
    FOR SELECT
    TO authenticated
    USING (public.can_access_chat_channel(channel_id));

CREATE POLICY "chat_messages_insert"
    ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
        public.can_access_chat_channel(channel_id)
        AND author_id = public.current_app_user_id()
    );

CREATE POLICY "chat_messages_update"
    ON public.messages
    FOR UPDATE
    TO authenticated
    USING (
        author_id = public.current_app_user_id()
        OR public.current_user_manages_chat()
    )
    WITH CHECK (
        public.can_access_chat_channel(channel_id)
        AND (
            author_id = public.current_app_user_id()
            OR public.current_user_manages_chat()
        )
    );

CREATE POLICY "chat_messages_delete"
    ON public.messages
    FOR DELETE
    TO authenticated
    USING (
        author_id = public.current_app_user_id()
        OR public.current_user_manages_chat()
    );

COMMIT;
