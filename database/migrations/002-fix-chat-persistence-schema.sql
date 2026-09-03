BEGIN;

ALTER TABLE public.channels
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_by TEXT;

DO $$
DECLARE
    has_section BOOLEAN;
    has_section_name BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'channels'
          AND column_name = 'section'
    ) INTO has_section;

    SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'channels'
          AND column_name = 'section_name'
    ) INTO has_section_name;

    IF has_section AND NOT has_section_name THEN
        ALTER TABLE public.channels RENAME COLUMN section TO section_name;
    ELSIF has_section AND has_section_name THEN
        UPDATE public.channels
        SET section_name = COALESCE(NULLIF(btrim(section_name), ''), section)
        WHERE section_name IS NULL OR btrim(section_name) = '';
    ELSIF NOT has_section_name THEN
        ALTER TABLE public.channels ADD COLUMN section_name TEXT;
    END IF;
END
$$;

DELETE FROM public.sections duplicate
USING public.sections canonical
WHERE duplicate.name = canonical.name
  AND duplicate.ctid > canonical.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS sections_name_key
    ON public.sections (name);

INSERT INTO public.sections (name, emoji, "order")
SELECT DISTINCT channel.section_name, '📁', 0
FROM public.channels channel
LEFT JOIN public.sections section ON section.name = channel.section_name
WHERE channel.section_name IS NOT NULL
  AND btrim(channel.section_name) <> ''
  AND section.name IS NULL
ON CONFLICT (name) DO NOTHING;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'channels_section_name_fkey'
          AND conrelid = 'public.channels'::regclass
    ) THEN
        ALTER TABLE public.channels
            ADD CONSTRAINT channels_section_name_fkey
            FOREIGN KEY (section_name)
            REFERENCES public.sections(name)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END
$$;

COMMIT;
