BEGIN;

ALTER TABLE public.sections
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION public.rename_chat_section(
    requested_old_name TEXT,
    requested_new_name TEXT,
    requested_emoji TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    old_name TEXT := btrim(requested_old_name);
    new_name TEXT := btrim(requested_new_name);
BEGIN
    IF NOT public.current_user_manages_chat() THEN
        RAISE EXCEPTION 'Not authorized to manage chat sections'
            USING ERRCODE = '42501';
    END IF;

    IF old_name = '' OR new_name = '' THEN
        RAISE EXCEPTION 'Section names cannot be empty'
            USING ERRCODE = '22023';
    END IF;

    IF old_name <> new_name AND EXISTS (
        SELECT 1
        FROM public.sections AS section
        WHERE lower(btrim(section.name)) = lower(new_name)
          AND section.name <> old_name
    ) THEN
        RAISE EXCEPTION 'A section named "%" already exists', new_name
            USING ERRCODE = '23505';
    END IF;

    UPDATE public.sections AS section
    SET name = new_name,
        emoji = COALESCE(NULLIF(btrim(requested_emoji), ''), section.emoji)
    WHERE section.name = old_name;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Section "%" was not found', old_name
            USING ERRCODE = 'P0002';
    END IF;
END
$$;

REVOKE ALL ON FUNCTION public.rename_chat_section(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rename_chat_section(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.rename_chat_section(TEXT, TEXT, TEXT) TO authenticated;

COMMIT;
