-- Run each statement separately in Supabase SQL Editor.
-- Before running, create matching CLEANUP_SECRET values in:
-- 1. Edge Function secrets
-- 2. Vault secret named cleanup_function_secret

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
    existing_job_id BIGINT;
BEGIN
    FOR existing_job_id IN
        SELECT jobid FROM cron.job
        WHERE jobname IN ('cleanup-storage-daily', 'cleanup-storage-every-6-hours')
    LOOP
        PERFORM cron.unschedule(existing_job_id);
    END LOOP;
END
$$;

SELECT cron.schedule(
    'cleanup-storage-every-6-hours',
    '0 */6 * * *',
    $schedule$
    SELECT net.http_post(
        url := 'https://znctjutqpuoimbxqxseu.supabase.co/functions/v1/cleanup-storage',
        headers := jsonb_build_object(
            'x-cleanup-secret', (
                SELECT decrypted_secret
                FROM vault.decrypted_secrets
                WHERE name = 'cleanup_function_secret'
                LIMIT 1
            ),
            'Content-Type', 'application/json'
        ),
        body := '{}'::jsonb
    );
    $schedule$
);

SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE jobname = 'cleanup-storage-every-6-hours';
