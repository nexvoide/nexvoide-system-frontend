BEGIN;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.users
        WHERE COALESCE(active, true) AND auth_user_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Cleanup blocked: active users without Supabase Auth links exist';
    END IF;

    IF EXISTS (SELECT 1 FROM public.messages WHERE author_id IS NULL) THEN
        RAISE EXCEPTION 'Cleanup blocked: messages without canonical authors exist';
    END IF;

    IF EXISTS (SELECT 1 FROM public.channels WHERE COALESCE(type, 'text') <> 'text') THEN
        RAISE EXCEPTION 'Cleanup blocked: voice or unknown channel types still exist';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.channels
        WHERE created_by IS NOT NULL
          AND (
              created_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
              OR NOT EXISTS (SELECT 1 FROM public.users WHERE id::TEXT = channels.created_by)
          )
    ) THEN
        RAISE EXCEPTION 'Cleanup blocked: channels.created_by contains non-canonical identities';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.user_channel_reads
        WHERE user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           OR NOT EXISTS (SELECT 1 FROM public.users WHERE id::TEXT = user_channel_reads.user_id)
    ) THEN
        RAISE EXCEPTION 'Cleanup blocked: read receipts contain non-canonical user identities';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.user_mentions
        WHERE user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           OR mentioned_by !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
           OR NOT EXISTS (SELECT 1 FROM public.users WHERE id::TEXT = user_mentions.user_id)
           OR NOT EXISTS (SELECT 1 FROM public.users WHERE id::TEXT = user_mentions.mentioned_by)
    ) THEN
        RAISE EXCEPTION 'Cleanup blocked: mentions contain non-canonical user identities';
    END IF;
END
$$;

DROP TRIGGER IF EXISTS protect_chat_message_identity ON public.messages;

CREATE OR REPLACE FUNCTION public.protect_chat_message_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    app_user_id UUID := public.current_app_user_id();
BEGIN
    IF app_user_id IS NULL THEN
        RAISE EXCEPTION 'Authenticated application user not found' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.author_id := app_user_id;
    ELSIF NOT public.current_user_manages_chat() AND (
        NEW.author_id IS DISTINCT FROM OLD.author_id
        OR NEW.channel_id IS DISTINCT FROM OLD.channel_id
        OR NEW.created_at IS DISTINCT FROM OLD.created_at
    ) THEN
        RAISE EXCEPTION 'Message identity fields are immutable' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END
$$;

REVOKE ALL ON FUNCTION public.protect_chat_message_identity() FROM PUBLIC;

CREATE TRIGGER protect_chat_message_identity
    BEFORE INSERT OR UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.protect_chat_message_identity();

CREATE OR REPLACE FUNCTION public.set_chat_channel_members(
    requested_channel_id TEXT,
    requested_user_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    app_user_id UUID := public.current_app_user_id();
BEGIN
    IF NOT public.current_user_manages_chat() THEN
        RAISE EXCEPTION 'Not authorized to manage channel membership' USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = requested_channel_id) THEN
        RAISE EXCEPTION 'Channel not found' USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
        SELECT requested.user_id
        FROM unnest(COALESCE(requested_user_ids, ARRAY[]::UUID[])) AS requested(user_id)
        LEFT JOIN public.users AS app_user ON app_user.id = requested.user_id
        WHERE app_user.id IS NULL OR NOT COALESCE(app_user.active, true)
    ) THEN
        RAISE EXCEPTION 'One or more requested users are invalid or inactive' USING ERRCODE = '22023';
    END IF;

    DELETE FROM public.channel_members WHERE channel_id = requested_channel_id;

    INSERT INTO public.channel_members (channel_id, user_id, created_by)
    SELECT requested_channel_id, requested.user_id, app_user_id
    FROM unnest(COALESCE(requested_user_ids, ARRAY[]::UUID[])) AS requested(user_id)
    ON CONFLICT (channel_id, user_id) DO NOTHING;
END
$$;

REVOKE ALL ON FUNCTION public.set_chat_channel_members(TEXT, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_chat_channel_members(TEXT, UUID[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_chat_channel_members(TEXT, UUID[]) TO authenticated;

DROP POLICY IF EXISTS "chat_reads_own" ON public.user_channel_reads;
DROP POLICY IF EXISTS "chat_mentions_select" ON public.user_mentions;
DROP POLICY IF EXISTS "chat_mentions_insert" ON public.user_mentions;
DROP POLICY IF EXISTS "chat_mentions_update" ON public.user_mentions;
DROP POLICY IF EXISTS "chat_mentions_delete" ON public.user_mentions;

ALTER TABLE public.channels
    ALTER COLUMN created_by TYPE UUID USING created_by::UUID;

ALTER TABLE public.user_channel_reads
    ALTER COLUMN user_id TYPE UUID USING user_id::UUID;

ALTER TABLE public.user_mentions
    ALTER COLUMN user_id TYPE UUID USING user_id::UUID,
    ALTER COLUMN mentioned_by TYPE UUID USING mentioned_by::UUID;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'channels_created_by_fkey') THEN
        ALTER TABLE public.channels ADD CONSTRAINT channels_created_by_fkey
            FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_channel_reads_user_id_fkey') THEN
        ALTER TABLE public.user_channel_reads ADD CONSTRAINT user_channel_reads_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_mentions_user_id_fkey') THEN
        ALTER TABLE public.user_mentions ADD CONSTRAINT user_mentions_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_mentions_mentioned_by_fkey') THEN
        ALTER TABLE public.user_mentions ADD CONSTRAINT user_mentions_mentioned_by_fkey
            FOREIGN KEY (mentioned_by) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END
$$;

ALTER TABLE public.messages
    ALTER COLUMN author_id SET NOT NULL,
    DROP COLUMN IF EXISTS user_id,
    DROP COLUMN IF EXISTS user_name,
    DROP COLUMN IF EXISTS user_avatar;

ALTER TABLE public.channels
    DROP COLUMN IF EXISTS users,
    DROP COLUMN IF EXISTS type,
    DROP COLUMN IF EXISTS user_limit;

ALTER TABLE public.users
    DROP COLUMN IF EXISTS password_hash;

CREATE POLICY "chat_reads_own" ON public.user_channel_reads FOR ALL TO authenticated
    USING (user_id = public.current_app_user_id() AND public.can_access_chat_channel(channel_id))
    WITH CHECK (user_id = public.current_app_user_id() AND public.can_access_chat_channel(channel_id));

CREATE POLICY "chat_mentions_select" ON public.user_mentions FOR SELECT TO authenticated
    USING (user_id = public.current_app_user_id() OR public.current_user_manages_chat());
CREATE POLICY "chat_mentions_insert" ON public.user_mentions FOR INSERT TO authenticated
    WITH CHECK (mentioned_by = public.current_app_user_id()
        AND public.can_access_chat_channel(channel_id));
CREATE POLICY "chat_mentions_update" ON public.user_mentions FOR UPDATE TO authenticated
    USING (user_id = public.current_app_user_id())
    WITH CHECK (user_id = public.current_app_user_id());
CREATE POLICY "chat_mentions_delete" ON public.user_mentions FOR DELETE TO authenticated
    USING (user_id = public.current_app_user_id()
        OR mentioned_by = public.current_app_user_id()
        OR public.current_user_manages_chat());

COMMIT;
