# Storage Cleanup Setup Guide

Complete setup guide for automatic file cleanup on any Supabase account.

## Files Included

1. **`supabase/functions/cleanup-storage/index.ts`** - Edge function code (ready to use)
2. **`database/setup/cleanup-storage-TEMPLATE.sql`** - SQL template with placeholders

## Quick Setup (5 minutes)

### 1. Deploy Edge Function

**Via CLI:**
```bash
cd supabase/functions/cleanup-storage
supabase functions deploy cleanup-storage
```

**Via Dashboard:**
- Go to Edge Functions > Create function
- Name: `cleanup-storage`
- Copy code from `index.ts`
- Deploy

### 2. Get Your Credentials

- **Project Reference**: Found in dashboard URL: `https://YOUR_PROJECT_REF.supabase.co`
- **Service Role Key**: Settings > API > `service_role` key (starts with `eyJ...`)

### 3. Set Up Cron Job

1. Open `database/setup/cleanup-storage-TEMPLATE.sql`
2. Replace:
   - `YOUR_PROJECT_REF` → Your project reference
   - `YOUR_SERVICE_ROLE_KEY` → Your service role key
3. Run in Supabase SQL Editor

### 4. Verify

Run this SQL to check:
```sql
SELECT * FROM cron.job WHERE jobname = 'cleanup-storage-daily';
```

You should see `active: true` if it's set up correctly.

## Configuration Options

### Change Bucket Name
Edit `index.ts` line 22:
```typescript
const STORAGE_BUCKET = 'your-bucket-name'
```

### Change Delete Time (default: 72 hours = 3 days)
Edit `index.ts` line 23:
```typescript
const DELETE_AFTER_HOURS = 48  // 2 days
```

### Change Schedule (default: Daily at 2 AM UTC)
Edit the SQL file, change `'0 2 * * *'` to:
- `'0 */6 * * *'` - Every 6 hours
- `'0 0 * * 0'` - Every Sunday
- `'*/30 * * * *'` - Every 30 minutes (for testing)

## Testing

Test manually:
```sql
SELECT net.http_post(
  url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-storage',
  headers := jsonb_build_object(
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
    'Content-Type', 'application/json'
  ),
  body := '{}'::jsonb
);
```

## What It Does

- ✅ Finds all files in storage bucket (including subfolders)
- ✅ Checks file age (from metadata or filename)
- ✅ Deletes files older than configured hours
- ✅ Runs automatically on schedule
- ✅ Logs everything for monitoring

## Support

Check logs in: Edge Functions > cleanup-storage > Logs

