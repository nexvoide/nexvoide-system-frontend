-- ============================================================================
-- Storage Cleanup Scheduler - READY TO RUN
-- ============================================================================
-- This file is ready to execute - just run it in Supabase SQL Editor
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
    url := 'https://znctjutqpuoimbxqseu.supabase.co/functions/v1/cleanup-storage',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuY3RqdXRxcHVvaW1ieHF4c2V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM2MzE2NywiZXhwIjoyMDc3OTM5MTY3fQ.eMFr8cNhXFujGUQWxs5asDtN_khizs38JaJ7dHl6ngQ',
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
-- ✅ SUCCESS!
-- ============================================================================
-- If you see "ACTIVE - Will run automatically!" above, you're all set!
-- 
-- The cleanup function will now run automatically:
-- - Every day at 2 AM UTC
-- - Deletes files older than 72 hours (3 days)
-- - No manual intervention needed
-- ============================================================================

