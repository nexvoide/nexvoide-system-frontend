-- ============================================================================
-- Storage Cleanup Scheduler - TEMPLATE (For Other Supabase Accounts)
-- ============================================================================
-- Copy this file and replace the placeholders with your own values
-- ============================================================================
-- 
-- INSTRUCTIONS:
-- 1. Replace YOUR_PROJECT_REF with your Supabase project reference
--    (found in your dashboard URL: https://YOUR_PROJECT_REF.supabase.co)
--    OR in Edge Functions > Secrets section
-- 
-- 2. Replace YOUR_SERVICE_ROLE_KEY with your service role key
--    (found in Supabase Dashboard > Settings > API > service_role key)
--    ⚠️ Keep this key secret - it has admin access!
-- 
-- 3. Run this SQL in Supabase SQL Editor
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove any existing cron job (if it exists)
SELECT cron.unschedule('cleanup-storage-daily');

-- Create the cron job to run automatically
-- Schedule: Daily at 2 AM UTC (modify '0 2 * * *' if you want different time)
SELECT cron.schedule(
  'cleanup-storage-daily',                    -- Job name
  '0 2 * * *',                                -- Schedule: Daily at 2 AM UTC
  $$                                           -- Job command
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

-- Verify the cron job is set up correctly
SELECT 
  jobid,
  jobname,
  schedule,
  active,
  CASE 
    WHEN active = true THEN '✅ ACTIVE - Will run automatically!'
    ELSE '❌ INACTIVE - Needs to be enabled'
  END AS status
FROM cron.job 
WHERE jobname = 'cleanup-storage-daily';

-- ============================================================================
-- SCHEDULE OPTIONS (modify '0 2 * * *' above):
-- ============================================================================
-- '0 2 * * *'     = Daily at 2 AM UTC (default)
-- '0 */6 * * *'   = Every 6 hours
-- '0 0 * * 0'     = Every Sunday at midnight
-- '0 0 1 * *'     = First day of every month at midnight
-- '*/30 * * * *'  = Every 30 minutes (for testing)
-- 
-- Cron format: minute hour day month weekday
-- ============================================================================

