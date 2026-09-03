BEGIN;

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_channel_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_mentions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.channels, public.sections, public.messages,
    public.channel_members, public.user_channel_reads, public.user_mentions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels, public.sections,
    public.messages, public.channel_members, public.user_channel_reads,
    public.user_mentions TO authenticated;

DROP POLICY IF EXISTS "Allow all operations" ON public.channels;
DROP POLICY IF EXISTS "channels_select" ON public.channels;
DROP POLICY IF EXISTS "channels_insert" ON public.channels;
DROP POLICY IF EXISTS "channels_update" ON public.channels;
DROP POLICY IF EXISTS "channels_delete" ON public.channels;
DROP POLICY IF EXISTS "Channels are viewable by everyone" ON public.channels;
DROP POLICY IF EXISTS "Channels are insertable by authenticated users" ON public.channels;
DROP POLICY IF EXISTS "Channels are updatable by authenticated users" ON public.channels;
DROP POLICY IF EXISTS "Channels are deletable by authenticated users" ON public.channels;
DROP POLICY IF EXISTS "chat_channels_select" ON public.channels;
DROP POLICY IF EXISTS "chat_channels_insert" ON public.channels;
DROP POLICY IF EXISTS "chat_channels_update" ON public.channels;
DROP POLICY IF EXISTS "chat_channels_delete" ON public.channels;

CREATE POLICY "chat_channels_select" ON public.channels FOR SELECT TO authenticated
    USING (public.can_access_chat_channel(id));
CREATE POLICY "chat_channels_insert" ON public.channels FOR INSERT TO authenticated
    WITH CHECK (public.current_user_manages_chat());
CREATE POLICY "chat_channels_update" ON public.channels FOR UPDATE TO authenticated
    USING (public.current_user_manages_chat()) WITH CHECK (public.current_user_manages_chat());
CREATE POLICY "chat_channels_delete" ON public.channels FOR DELETE TO authenticated
    USING (public.current_user_manages_chat());

DROP POLICY IF EXISTS "Allow all operations" ON public.sections;
DROP POLICY IF EXISTS "sections_select" ON public.sections;
DROP POLICY IF EXISTS "sections_insert" ON public.sections;
DROP POLICY IF EXISTS "sections_update" ON public.sections;
DROP POLICY IF EXISTS "sections_delete" ON public.sections;
DROP POLICY IF EXISTS "Sections are viewable by everyone" ON public.sections;
DROP POLICY IF EXISTS "Sections are insertable by authenticated users" ON public.sections;
DROP POLICY IF EXISTS "Sections are updatable by authenticated users" ON public.sections;
DROP POLICY IF EXISTS "Sections are deletable by authenticated users" ON public.sections;
DROP POLICY IF EXISTS "chat_sections_select" ON public.sections;
DROP POLICY IF EXISTS "chat_sections_insert" ON public.sections;
DROP POLICY IF EXISTS "chat_sections_update" ON public.sections;
DROP POLICY IF EXISTS "chat_sections_delete" ON public.sections;

CREATE POLICY "chat_sections_select" ON public.sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_sections_insert" ON public.sections FOR INSERT TO authenticated
    WITH CHECK (public.current_user_manages_chat());
CREATE POLICY "chat_sections_update" ON public.sections FOR UPDATE TO authenticated
    USING (public.current_user_manages_chat()) WITH CHECK (public.current_user_manages_chat());
CREATE POLICY "chat_sections_delete" ON public.sections FOR DELETE TO authenticated
    USING (public.current_user_manages_chat());

CREATE OR REPLACE FUNCTION public.protect_chat_message_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    app_user public.users%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    SELECT * INTO app_user
    FROM public.users
    WHERE auth_user_id = auth.uid() AND COALESCE(active, true)
    LIMIT 1;
    IF app_user.id IS NULL THEN
        RAISE EXCEPTION 'Authenticated application user not found' USING ERRCODE = '42501';
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.author_id := app_user.id;
        NEW.user_id := app_user.id::TEXT;
        NEW.user_name := COALESCE(NULLIF(app_user.name, ''), app_user.username);
        NEW.user_avatar := app_user.avatar;
    ELSIF NOT public.current_user_manages_chat() THEN
        IF NEW.author_id IS DISTINCT FROM OLD.author_id
           OR NEW.channel_id IS DISTINCT FROM OLD.channel_id
           OR NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.user_name IS DISTINCT FROM OLD.user_name
           OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Message identity fields are immutable' USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.protect_chat_message_identity() FROM PUBLIC;

DROP TRIGGER IF EXISTS protect_chat_message_identity ON public.messages;
CREATE TRIGGER protect_chat_message_identity
    BEFORE INSERT OR UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.protect_chat_message_identity();

DROP POLICY IF EXISTS "Allow all operations" ON public.messages;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "messages_update" ON public.messages;
DROP POLICY IF EXISTS "messages_delete" ON public.messages;
DROP POLICY IF EXISTS "Messages are viewable by everyone" ON public.messages;
DROP POLICY IF EXISTS "Messages are insertable by authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Messages are updatable by authenticated users" ON public.messages;
DROP POLICY IF EXISTS "Messages are deletable by authenticated users" ON public.messages;
DROP POLICY IF EXISTS "chat_messages_select" ON public.messages;
DROP POLICY IF EXISTS "chat_messages_insert" ON public.messages;
DROP POLICY IF EXISTS "chat_messages_update" ON public.messages;
DROP POLICY IF EXISTS "chat_messages_delete" ON public.messages;

CREATE POLICY "chat_messages_select" ON public.messages FOR SELECT TO authenticated
    USING (public.can_access_chat_channel(channel_id));
CREATE POLICY "chat_messages_insert" ON public.messages FOR INSERT TO authenticated
    WITH CHECK (public.can_access_chat_channel(channel_id) AND author_id = public.current_app_user_id());
CREATE POLICY "chat_messages_update" ON public.messages FOR UPDATE TO authenticated
    USING (author_id = public.current_app_user_id() OR public.current_user_manages_chat())
    WITH CHECK (public.can_access_chat_channel(channel_id)
        AND (author_id = public.current_app_user_id() OR public.current_user_manages_chat()));
CREATE POLICY "chat_messages_delete" ON public.messages FOR DELETE TO authenticated
    USING (author_id = public.current_app_user_id() OR public.current_user_manages_chat());

CREATE OR REPLACE FUNCTION public.mark_chat_message_read(requested_message_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    app_user_id UUID := public.current_app_user_id();
    message_channel_id TEXT;
BEGIN
    IF app_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;
    SELECT channel_id INTO message_channel_id FROM public.messages WHERE id = requested_message_id;
    IF message_channel_id IS NULL THEN
        RAISE EXCEPTION 'Message not found' USING ERRCODE = 'P0002';
    END IF;
    IF NOT public.can_access_chat_channel(message_channel_id) THEN
        RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
    END IF;
    UPDATE public.messages
    SET read_by = CASE
            WHEN COALESCE(read_by, '[]'::JSONB) @> jsonb_build_array(app_user_id::TEXT)
                THEN COALESCE(read_by, '[]'::JSONB)
            ELSE COALESCE(read_by, '[]'::JSONB) || jsonb_build_array(app_user_id::TEXT)
        END,
        delivery_status = 'read'
    WHERE id = requested_message_id;
END
$$;
REVOKE ALL ON FUNCTION public.mark_chat_message_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_chat_message_read(UUID) TO authenticated;

DROP POLICY IF EXISTS "chat_members_select" ON public.channel_members;
DROP POLICY IF EXISTS "chat_members_insert" ON public.channel_members;
DROP POLICY IF EXISTS "chat_members_update" ON public.channel_members;
DROP POLICY IF EXISTS "chat_members_delete" ON public.channel_members;
CREATE POLICY "chat_members_select" ON public.channel_members FOR SELECT TO authenticated
    USING (user_id = public.current_app_user_id() OR public.current_user_manages_chat());
CREATE POLICY "chat_members_insert" ON public.channel_members FOR INSERT TO authenticated
    WITH CHECK (public.current_user_manages_chat());
CREATE POLICY "chat_members_update" ON public.channel_members FOR UPDATE TO authenticated
    USING (public.current_user_manages_chat()) WITH CHECK (public.current_user_manages_chat());
CREATE POLICY "chat_members_delete" ON public.channel_members FOR DELETE TO authenticated
    USING (public.current_user_manages_chat());

DROP POLICY IF EXISTS "Allow all operations" ON public.user_channel_reads;
DROP POLICY IF EXISTS "user_channel_reads_select" ON public.user_channel_reads;
DROP POLICY IF EXISTS "user_channel_reads_insert" ON public.user_channel_reads;
DROP POLICY IF EXISTS "user_channel_reads_update" ON public.user_channel_reads;
DROP POLICY IF EXISTS "user_channel_reads_delete" ON public.user_channel_reads;
DROP POLICY IF EXISTS "chat_reads_own" ON public.user_channel_reads;
CREATE POLICY "chat_reads_own" ON public.user_channel_reads FOR ALL TO authenticated
    USING (user_id = public.current_app_user_id()::TEXT AND public.can_access_chat_channel(channel_id))
    WITH CHECK (user_id = public.current_app_user_id()::TEXT AND public.can_access_chat_channel(channel_id));

DROP POLICY IF EXISTS "Allow all operations" ON public.user_mentions;
DROP POLICY IF EXISTS "chat_mentions_select" ON public.user_mentions;
DROP POLICY IF EXISTS "chat_mentions_insert" ON public.user_mentions;
DROP POLICY IF EXISTS "chat_mentions_update" ON public.user_mentions;
DROP POLICY IF EXISTS "chat_mentions_delete" ON public.user_mentions;
CREATE POLICY "chat_mentions_select" ON public.user_mentions FOR SELECT TO authenticated
    USING (user_id = public.current_app_user_id()::TEXT OR public.current_user_manages_chat());
CREATE POLICY "chat_mentions_insert" ON public.user_mentions FOR INSERT TO authenticated
    WITH CHECK (mentioned_by = public.current_app_user_id()::TEXT
        AND public.can_access_chat_channel(channel_id));
CREATE POLICY "chat_mentions_update" ON public.user_mentions FOR UPDATE TO authenticated
    USING (user_id = public.current_app_user_id()::TEXT)
    WITH CHECK (user_id = public.current_app_user_id()::TEXT);
CREATE POLICY "chat_mentions_delete" ON public.user_mentions FOR DELETE TO authenticated
    USING (user_id = public.current_app_user_id()::TEXT
        OR mentioned_by = public.current_app_user_id()::TEXT
        OR public.current_user_manages_chat());

CREATE OR REPLACE FUNCTION public.can_access_chat_file(object_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT CASE
        WHEN split_part(object_name, '/', 1) = 'channels'
            THEN public.can_access_chat_channel(split_part(object_name, '/', 2))
        ELSE EXISTS (
            SELECT 1 FROM public.messages AS message
            WHERE public.can_access_chat_channel(message.channel_id)
              AND EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(COALESCE(message.attachments, '[]'::JSONB)) AS attachment(value)
                  WHERE attachment.value->>'path' = object_name
              )
        )
    END
$$;
REVOKE ALL ON FUNCTION public.can_access_chat_file(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_chat_file(TEXT) TO authenticated;

UPDATE storage.buckets SET public = false WHERE id = 'chat-files';
DROP POLICY IF EXISTS "Allow public deletes from chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public uploads to chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for chat-files" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_update" ON storage.objects;
DROP POLICY IF EXISTS "chat_files_delete" ON storage.objects;

CREATE POLICY "chat_files_select" ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'chat-files' AND public.can_access_chat_file(name));
CREATE POLICY "chat_files_insert" ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'chat-files'
        AND split_part(name, '/', 1) = 'channels'
        AND public.can_access_chat_channel(split_part(name, '/', 2))
        AND split_part(name, '/', 3) = public.current_app_user_id()::TEXT);
CREATE POLICY "chat_files_update" ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'chat-files'
        AND (split_part(name, '/', 3) = public.current_app_user_id()::TEXT
            OR public.current_user_manages_chat()))
    WITH CHECK (bucket_id = 'chat-files' AND public.can_access_chat_file(name));
CREATE POLICY "chat_files_delete" ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'chat-files'
        AND (split_part(name, '/', 3) = public.current_app_user_id()::TEXT
            OR public.current_user_manages_chat()));

COMMIT;
