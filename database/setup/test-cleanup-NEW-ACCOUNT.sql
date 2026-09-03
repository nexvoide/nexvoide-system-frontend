-- Requires matching CLEANUP_SECRET values in the Edge Function and Vault.
-- Never place a service-role key in this file.

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
) AS request_id;
