-- ============================================================================
-- Storage Cleanup Scheduler Setup
-- ============================================================================
-- This sets up a daily cron job to automatically delete expired files
-- from the project-attachments bucket (files older than 72 hours / 3 days)
-- ============================================================================
-- INSTRUCTIONS:
-- 1. Deploy the edge function first:
--    supabase functions deploy cleanup-storage
-- 
-- 2. Run this SQL in Supabase SQL Editor
-- 
-- 3. Replace YOUR_PROJECT_REF with your Supabase project reference
--    (found in your Supabase Dashboard URL: https://YOUR_PROJECT_REF.supabase.co)
--    OR in Edge Functions > Secrets section (look for SUPABASE_URL or project reference)
-- 
-- 4. Replace YOUR_SERVICE_ROLE_KEY with your service role key
--    IMPORTANT: This is NOT in Edge Functions secrets!
--    Find it here: Supabase Dashboard > Settings (gear icon) > API
--    Look for "Project API keys" section > "service_role" key (starts with eyJ...)
--    ⚠️ Keep this key secret - it has admin access!
-- ============================================================================

-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the cleanup function to run daily at 2 AM UTC
-- Adjust the schedule as needed (cron format: minute hour day month weekday)
SELECT cron.schedule(
  'cleanup-storage-daily',
  '0 2 * * *', -- Daily at 2 AM UTC
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-storage',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- To check if the cron job is scheduled:
-- SELECT * FROM cron.job WHERE jobname = 'cleanup-storage-daily';

-- To manually trigger the cleanup (for testing):
-- SELECT net.http_post(
--   url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-storage',
--   headers := jsonb_build_object(
--     'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
--     'Content-Type', 'application/json'
--   ),
--   body := '{}'::jsonb
-- );

-- To remove the cron job (if needed):
-- SELECT cron.unschedule('cleanup-storage-daily');

-- ============================================================================
-- ALTERNATIVE: Using Supabase Cron Jobs (Recommended for newer projects)
-- ============================================================================
-- If pg_cron doesn't work, use Supabase's built-in cron jobs:
-- 
-- 1. Go to Supabase Dashboard > Database > Cron Jobs
-- 2. Click "New Cron Job"
-- 3. Set:
--    - Name: cleanup-storage-daily
--    - Schedule: 0 2 * * * (daily at 2 AM UTC)
--    - SQL:
--      SELECT net.http_post(
--        url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-storage',
--        headers := jsonb_build_object(
--          'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
--          'Content-Type', 'application/json'
--        ),
--        body := '{}'::jsonb
--      );
-- ============================================================================

