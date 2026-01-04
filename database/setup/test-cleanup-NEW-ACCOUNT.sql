-- ============================================================================
-- Quick Test: Cleanup Storage Function (New Account)
-- ============================================================================
-- Run this SQL to test the cleanup function immediately
-- ============================================================================

-- Enable pg_net extension (required for HTTP requests)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Test the function
SELECT net.http_post(
  url := 'https://znctjutqpuoimbxqseu.supabase.co/functions/v1/cleanup-storage',
  headers := jsonb_build_object(
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpuY3RqdXRxcHVvaW1ieHF4c2V1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjM2MzE2NywiZXhwIjoyMDc3OTM5MTY3fQ.eMFr8cNhXFujGUQWxs5asDtN_khizs38JaJ7dHl6ngQ',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
) AS request_id;

-- ============================================================================
-- What to expect:
-- - You'll get a request_id back (this is normal)
-- - Check the Edge Functions logs to see the cleanup results
-- - Go to: Supabase Dashboard > Edge Functions > cleanup-storage > Logs
-- ============================================================================

