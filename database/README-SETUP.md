# Database Setup Guide

This directory contains complete SQL migration files to set up your Supabase database from scratch.

## 📁 Files

### 1. `supabase-complete-setup.sql`
**Main setup file** - Creates everything:
- ✅ All tables (users, projects, employees, profiles, agencies, brands, settings, activity_logs, channels, sections, messages, user_channel_reads, user_online_status)
- ✅ All indexes for performance
- ✅ Triggers for `updated_at` timestamps
- ✅ Row Level Security (RLS) policies
- ✅ Realtime subscriptions
- ✅ Initial default data

### 2. `supabase-storage-setup.sql`
**Storage setup file** - Creates storage buckets:
- ✅ `project-attachments` bucket (for project files)
- ✅ `chat-files` bucket (for chat attachments)
- ✅ Storage policies for public access and authenticated uploads

## 🚀 Quick Start

### Step 1: Run Main Setup
1. Open your Supabase Dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `supabase-complete-setup.sql`
5. Click **Run** (or press Cmd/Ctrl + Enter)
6. Wait for all queries to complete (should take 10-30 seconds)

### Step 2: Run Storage Setup
1. In the same SQL Editor
2. Create a **New Query**
3. Copy and paste the entire contents of `supabase-storage-setup.sql`
4. Click **Run**
5. Verify buckets were created in **Storage** section

### Step 3: Verify Setup
Run this query to verify everything was created:

```sql
-- Check all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check all indexes exist
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;

-- Check storage buckets
SELECT id, name, public 
FROM storage.buckets;
```

## 📊 What Gets Created

### Tables (13 total)
1. `users` - User authentication and profiles
2. `projects` - Project management
3. `employees` - Employee records
4. `profiles` - Fiverr/Upwork profiles
5. `agencies` - Agency information
6. `brands` - Brand information
7. `settings` - Key-value settings
8. `activity_logs` - Audit trail
9. `channels` - Chat channels
10. `sections` - Chat sections
11. `messages` - Chat messages
12. `user_channel_reads` - Unread message tracking
13. `user_online_status` - Online user tracking

### Indexes (30+)
- Performance indexes on all frequently queried columns
- Composite indexes for common query patterns
- Partial indexes for filtered queries

### Storage Buckets (2)
- `project-attachments` - Project files (50MB limit)
- `chat-files` - Chat attachments (50MB limit)

### Realtime Subscriptions
- Enabled for: `channels`, `sections`, `messages`, `user_online_status`, `user_channel_reads`

## 🔄 Re-running Setup

If you need to recreate the database:

**Option 1: Drop and Recreate (DESTRUCTIVE)**
```sql
-- WARNING: This deletes ALL data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```
Then run `supabase-complete-setup.sql` again.

**Option 2: Safe Re-run**
The SQL files use `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, so you can safely re-run them. Existing data will be preserved.

## 🛠️ Troubleshooting

### Error: "relation already exists"
- This is normal if tables already exist
- The `IF NOT EXISTS` clauses prevent errors
- You can safely ignore these warnings

### Error: "permission denied"
- Make sure you're using the Supabase Dashboard SQL Editor
- You need admin/owner permissions on the project

### Storage buckets not created
- Storage buckets might need to be created via Dashboard UI
- Go to **Storage** > **New bucket** and create manually using the specs in `supabase-storage-setup.sql`

### Realtime not working
- Make sure you ran the `ALTER PUBLICATION` commands
- Check that tables are added to `supabase_realtime` publication
- Verify in Dashboard: **Database** > **Replication**

## 📝 Notes

- All tables use UUID primary keys
- All tables have `created_at` and `updated_at` timestamps
- `updated_at` is automatically maintained by triggers
- RLS policies allow all operations (adjust based on your security needs)
- Storage buckets are public for easy access (adjust if needed)

## ✅ After Setup

1. Verify tables in Dashboard: **Database** > **Tables**
2. Verify indexes: Run the verification query above
3. Verify storage: **Storage** > Check buckets exist
4. Verify Realtime: **Database** > **Replication** > Check tables are listed
5. Test your app - everything should work!

---

**Need help?** Check the main README.md or open an issue.

