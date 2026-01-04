# Storage Cleanup Edge Function

Automatically deletes files from Supabase Storage that are older than 3 days (72 hours).

## Features

- ✅ Recursively finds files in all folders/subdirectories
- ✅ Detects file age from `created_at` metadata or filename timestamp
- ✅ Deletes files older than 72 hours (configurable)
- ✅ Handles batch deletion for large numbers of files
- ✅ Detailed logging for debugging
- ✅ Works with any Supabase Storage bucket

## Configuration

Edit these constants in `index.ts` if needed:

```typescript
const STORAGE_BUCKET = 'project-attachments'  // Change to your bucket name
const DELETE_AFTER_HOURS = 72                 // Change to desired hours (default: 3 days)
```

## Setup Instructions

### Step 1: Deploy the Edge Function

**Option A: Using Supabase CLI**
```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy
supabase functions deploy cleanup-storage
```

**Option B: Using Supabase Dashboard**
1. Go to Supabase Dashboard > Edge Functions
2. Click "Create a new function"
3. Name it: `cleanup-storage`
4. Copy the code from `index.ts`
5. Click "Deploy"

### Step 2: Set Up Environment Variables

The function needs these environment variables (automatically set by Supabase):
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your service role key

These are automatically available in Edge Functions, but you can verify in:
- Dashboard > Edge Functions > cleanup-storage > Settings > Secrets

### Step 3: Set Up Automatic Execution (Cron Job)

1. Open `database/setup/cleanup-storage-TEMPLATE.sql`
2. Replace placeholders:
   - `YOUR_PROJECT_REF` → Your project reference (from dashboard URL)
   - `YOUR_SERVICE_ROLE_KEY` → Your service role key (Settings > API)
3. Run the SQL in Supabase SQL Editor

The cron job will run daily at 2 AM UTC. Modify the schedule in the SQL if needed.

## Testing

### Manual Test via SQL:
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

### Manual Test via curl:
```bash
curl -X POST https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-storage \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Monitoring

Check logs in:
- Supabase Dashboard > Edge Functions > cleanup-storage > Logs

You'll see detailed information about:
- Files found and checked
- Files deleted
- Any errors

## Customization

### Change Bucket Name
Edit line 22 in `index.ts`:
```typescript
const STORAGE_BUCKET = 'your-bucket-name'
```

### Change Delete Time
Edit line 23 in `index.ts`:
```typescript
const DELETE_AFTER_HOURS = 48  // 2 days instead of 3
```

### Change Schedule
Edit the cron schedule in the SQL file:
```sql
'0 2 * * *'  -- Daily at 2 AM UTC (current)
'0 */6 * * *'  -- Every 6 hours
'0 0 * * 0'  -- Every Sunday at midnight
```

## Troubleshooting

**Files not being deleted?**
- Check logs to see why (age calculation, permissions, etc.)
- Verify bucket name matches
- Check file age is actually > 72 hours

**Cron job not running?**
- Verify cron job is active: `SELECT * FROM cron.job WHERE jobname = 'cleanup-storage-daily';`
- Check that `pg_cron` and `pg_net` extensions are enabled
- Verify service role key is correct

**Permission errors?**
- Ensure service role key has storage access
- Check bucket RLS policies allow deletion

