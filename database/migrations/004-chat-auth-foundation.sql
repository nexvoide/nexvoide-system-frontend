BEGIN;

ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.channel_members (
    channel_id TEXT NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    PRIMARY KEY (channel_id, user_id)
);

ALTER TABLE public.messages
    ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES public.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user_id ON public.channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON public.messages(author_id);

INSERT INTO public.channel_members (channel_id, user_id)
SELECT DISTINCT channel.id, app_user.id
FROM public.channels AS channel
CROSS JOIN LATERAL unnest(COALESCE(channel.users, ARRAY[]::TEXT[])) AS member(value)
INNER JOIN public.users AS app_user
    ON lower(btrim(member.value)) IN (
        lower(app_user.id::TEXT),
        lower(COALESCE(app_user.username, '')),
        lower(COALESCE(app_user.user_id, ''))
    )
ON CONFLICT (channel_id, user_id) DO NOTHING;

UPDATE public.messages AS message
SET author_id = app_user.id
FROM public.users AS app_user
WHERE message.author_id IS NULL
  AND lower(btrim(message.user_id)) IN (
      lower(app_user.id::TEXT),
      lower(COALESCE(app_user.username, '')),
      lower(COALESCE(app_user.user_id, ''))
  );

CREATE OR REPLACE FUNCTION public.current_app_user_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT app_user.id
    FROM public.users AS app_user
    WHERE app_user.auth_user_id = auth.uid()
      AND COALESCE(app_user.active, true)
    LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_user_manages_chat()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT COALESCE(
        EXISTS (
            SELECT 1
            FROM public.users AS app_user
            WHERE app_user.auth_user_id = auth.uid()
              AND COALESCE(app_user.active, true)
              AND (
                  lower(btrim(app_user.role)) IN ('admin', 'administrator', 'manager')
                  OR lower(app_user.role) LIKE '%"admin"%'
                  OR lower(app_user.role) LIKE '%"administrator"%'
                  OR lower(app_user.role) LIKE '%"manager"%'
              )
        ),
        false
    )
$$;

CREATE OR REPLACE FUNCTION public.can_access_chat_channel(requested_channel_id TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT public.current_user_manages_chat()
        OR EXISTS (
            SELECT 1
            FROM public.channel_members AS membership
            WHERE membership.channel_id = requested_channel_id
              AND membership.user_id = public.current_app_user_id()
        )
$$;

CREATE OR REPLACE FUNCTION public.set_chat_channel_members(
    requested_channel_id TEXT,
    requested_user_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NOT public.current_user_manages_chat() THEN
        RAISE EXCEPTION 'Not authorized to manage channel membership'
            USING ERRCODE = '42501';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.channels WHERE id = requested_channel_id) THEN
        RAISE EXCEPTION 'Channel not found' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.channel_members
    WHERE channel_id = requested_channel_id;

    INSERT INTO public.channel_members (channel_id, user_id, created_by)
    SELECT requested_channel_id, requested.requested_user_id, public.current_app_user_id()
    FROM unnest(COALESCE(requested_user_ids, ARRAY[]::UUID[])) AS requested(requested_user_id)
    INNER JOIN public.users AS app_user ON app_user.id = requested.requested_user_id
    ON CONFLICT (channel_id, user_id) DO NOTHING;

    UPDATE public.channels
    SET users = ARRAY(
        SELECT member.user_id::TEXT
        FROM public.channel_members AS member
        WHERE member.channel_id = requested_channel_id
        ORDER BY member.user_id
    )
    WHERE id = requested_channel_id;
END
$$;

REVOKE ALL ON FUNCTION public.current_app_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_user_manages_chat() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_access_chat_channel(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_chat_channel_members(TEXT, UUID[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.current_app_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_manages_chat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_chat_channel(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_chat_channel_members(TEXT, UUID[]) TO authenticated;

COMMIT;
