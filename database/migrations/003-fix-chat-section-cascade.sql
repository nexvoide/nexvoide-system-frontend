BEGIN;

DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT usage.constraint_name
        FROM information_schema.key_column_usage AS usage
        INNER JOIN information_schema.table_constraints AS constraint_info
            ON constraint_info.constraint_schema = usage.constraint_schema
           AND constraint_info.table_name = usage.table_name
           AND constraint_info.constraint_name = usage.constraint_name
        WHERE usage.table_schema = 'public'
          AND usage.table_name = 'channels'
          AND usage.column_name = 'section_name'
          AND constraint_info.constraint_type = 'FOREIGN KEY'
    LOOP
        EXECUTE format(
            'ALTER TABLE public.channels DROP CONSTRAINT %I',
            constraint_record.constraint_name
        );
    END LOOP;
END
$$;

ALTER TABLE public.channels
    ADD CONSTRAINT channels_section_name_fkey
    FOREIGN KEY (section_name)
    REFERENCES public.sections(name)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

COMMIT;
