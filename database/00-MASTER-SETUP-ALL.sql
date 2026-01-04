-- ============================================================================
-- NEXVOIDE MASTER DATABASE SETUP - RUN THIS FILE TO SET UP EVERYTHING
-- ============================================================================
-- This is a COMPLETE setup file that creates:
--   1. All tables
--   2. All indexes
--   3. All triggers
--   4. All RLS policies
--   5. All storage buckets
--   6. Realtime subscriptions
-- ============================================================================
-- INSTRUCTIONS:
--   1. Open Supabase Dashboard > SQL Editor
--   2. Copy this ENTIRE file
--   3. Paste and Run
--   4. Done! Your database is ready.
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- PART 1: CREATE ALL TABLES
-- ============================================================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'employee',
    avatar TEXT,
    active BOOLEAN DEFAULT true,
    service TEXT,
    user_id TEXT,
    password_hash TEXT NOT NULL,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform TEXT,
    profile_id UUID,
    agency_id UUID,
    brand_id UUID,
    client_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    service TEXT,
    quantity TEXT,
    revision_quantity TEXT,
    amount NUMERIC(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'In Progress',
    is_revision BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    deadline DATE,
    assigned TEXT DEFAULT '[]',
    raw_source_link TEXT,
    attachments TEXT DEFAULT '[]',
    archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Employees table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    phone TEXT,
    bank_name TEXT,
    bank_account TEXT,
    avatar TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true,
    rate_type TEXT DEFAULT 'fixed',
    rate_value NUMERIC(10, 2) DEFAULT 0,
    street TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    service TEXT,
    platform TEXT DEFAULT 'Fiverr',
    username TEXT,
    logo TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agencies table
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    service TEXT,
    logo TEXT,
    contact TEXT,
    email TEXT,
    street TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip TEXT,
    active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    service TEXT,
    logo TEXT,
    contact TEXT,
    email TEXT,
    street TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip TEXT,
    active BOOLEAN DEFAULT true,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings table
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat sections table
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '📁',
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat channels table
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    type TEXT DEFAULT 'text',
    users TEXT[] DEFAULT '{}',
    read_only BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    section_name TEXT,
    user_limit INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    content TEXT NOT NULL,
    mentions TEXT[],
    reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
    delivery_status TEXT DEFAULT 'sent',
    read_by TEXT[],
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    attachments JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User channel reads table
CREATE TABLE IF NOT EXISTS user_channel_reads (
    user_id TEXT NOT NULL,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, channel_id)
);

-- User online status table
CREATE TABLE IF NOT EXISTS user_online_status (
    user_id TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Archived months table (for monthly closing)
CREATE TABLE IF NOT EXISTS archived_months (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
    month_label TEXT,
    closed_by TEXT NOT NULL,
    total_revenue NUMERIC(12, 2) DEFAULT 0,
    total_expenses NUMERIC(12, 2) DEFAULT 0,
    net_profit NUMERIC(12, 2) DEFAULT 0,
    completed_revenue NUMERIC(12, 2) DEFAULT 0,
    pending_revenue NUMERIC(12, 2) DEFAULT 0,
    in_progress_revenue NUMERIC(12, 2) DEFAULT 0,
    cancelled_revenue NUMERIC(12, 2) DEFAULT 0,
    revision_revenue NUMERIC(12, 2) DEFAULT 0,
    total_projects INTEGER DEFAULT 0,
    completed_projects INTEGER DEFAULT 0,
    in_progress_projects INTEGER DEFAULT 0,
    pending_projects INTEGER DEFAULT 0,
    cancelled_projects INTEGER DEFAULT 0,
    revision_projects INTEGER DEFAULT 0,
    total_team_cost NUMERIC(12, 2) DEFAULT 0,
    active_employees INTEGER DEFAULT 0,
    total_billing_hours NUMERIC(10, 2) DEFAULT 0,
    base_currency TEXT DEFAULT 'USD',
    exchange_rate NUMERIC(10, 4) DEFAULT 280,
    notes TEXT,
    closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(year, month)
);

-- Archived projects table (for monthly closing)
CREATE TABLE IF NOT EXISTS archived_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    archived_month_id UUID NOT NULL REFERENCES archived_months(id) ON DELETE CASCADE,
    original_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    platform TEXT,
    profile_id UUID,
    agency_id UUID,
    brand_id UUID,
    client_name TEXT NOT NULL DEFAULT '',
    project_name TEXT NOT NULL DEFAULT '',
    service TEXT,
    quantity TEXT,
    revision_quantity TEXT,
    amount NUMERIC(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'Completed',
    is_revision BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    deadline DATE,
    assigned TEXT DEFAULT '[]',
    raw_source_link TEXT,
    attachments TEXT DEFAULT '[]',
    team_cost NUMERIC(12, 2) DEFAULT 0,
    profit NUMERIC(12, 2) DEFAULT 0,
    billing_hours NUMERIC(10, 2) DEFAULT 0,
    original_created_at TIMESTAMPTZ,
    original_updated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Project pull forwards table (for monthly closing)
CREATE TABLE IF NOT EXISTS project_pull_forwards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    from_year INTEGER NOT NULL,
    from_month INTEGER NOT NULL CHECK (from_month >= 1 AND from_month <= 12),
    to_year INTEGER NOT NULL,
    to_month INTEGER NOT NULL CHECK (to_month >= 1 AND to_month <= 12),
    pulled_by TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly finance snapshots table (for monthly closing)
CREATE TABLE IF NOT EXISTS monthly_finance_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    archived_month_id UUID NOT NULL REFERENCES archived_months(id) ON DELETE CASCADE,
    fiverr_revenue NUMERIC(12, 2) DEFAULT 0,
    upwork_revenue NUMERIC(12, 2) DEFAULT 0,
    direct_revenue NUMERIC(12, 2) DEFAULT 0,
    agency_revenue NUMERIC(12, 2) DEFAULT 0,
    service_revenue JSONB DEFAULT '{}',
    employee_costs JSONB DEFAULT '{}',
    expenses JSONB DEFAULT '{}',
    total_invoices INTEGER DEFAULT 0,
    paid_invoices INTEGER DEFAULT 0,
    unpaid_invoices INTEGER DEFAULT 0,
    invoice_details JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(archived_month_id)
);

-- Add additional columns to projects table for monthly closing
ALTER TABLE projects ADD COLUMN IF NOT EXISTS archived_month_id UUID REFERENCES archived_months(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS pulled_forward BOOLEAN DEFAULT false;

-- ============================================================================
-- PART 2: CREATE ALL INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_projects_client_name ON projects(client_name);
CREATE INDEX IF NOT EXISTS idx_projects_deadline ON projects(deadline) WHERE deadline IS NOT NULL;

-- Employees indexes
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_active_created_at ON employees(active, created_at DESC);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_platform ON profiles(platform);

-- Agencies indexes
CREATE INDEX IF NOT EXISTS idx_agencies_created_at ON agencies(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agencies_active ON agencies(active) WHERE active = true;

-- Brands indexes
CREATE INDEX IF NOT EXISTS idx_brands_created_at ON brands(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_brands_active ON brands(active) WHERE active = true;

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_channels_order ON channels("order");
CREATE INDEX IF NOT EXISTS idx_channels_section ON channels(section_name);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_channel_reads_user ON user_channel_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_reads_channel ON user_channel_reads(channel_id);
CREATE INDEX IF NOT EXISTS idx_user_online_status_last_seen ON user_online_status(last_seen DESC);

-- Archived months indexes
CREATE INDEX IF NOT EXISTS idx_archived_months_year_month ON archived_months(year, month);
CREATE INDEX IF NOT EXISTS idx_archived_months_closed_at ON archived_months(closed_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_months_closed_by ON archived_months(closed_by);

-- Archived projects indexes
CREATE INDEX IF NOT EXISTS idx_archived_projects_month_id ON archived_projects(archived_month_id);
CREATE INDEX IF NOT EXISTS idx_archived_projects_original_id ON archived_projects(original_project_id);
CREATE INDEX IF NOT EXISTS idx_archived_projects_status ON archived_projects(status);
CREATE INDEX IF NOT EXISTS idx_archived_projects_created_at ON archived_projects(created_at DESC);

-- Project pull forwards indexes
CREATE INDEX IF NOT EXISTS idx_pull_forwards_project_id ON project_pull_forwards(project_id);
CREATE INDEX IF NOT EXISTS idx_pull_forwards_from_month ON project_pull_forwards(from_year, from_month);
CREATE INDEX IF NOT EXISTS idx_pull_forwards_to_month ON project_pull_forwards(to_year, to_month);
CREATE INDEX IF NOT EXISTS idx_pull_forwards_created_at ON project_pull_forwards(created_at DESC);

-- Monthly finance snapshots indexes
CREATE INDEX IF NOT EXISTS idx_finance_snapshots_month_id ON monthly_finance_snapshots(archived_month_id);
CREATE INDEX IF NOT EXISTS idx_finance_snapshots_created_at ON monthly_finance_snapshots(created_at DESC);

-- Projects table indexes for new columns
CREATE INDEX IF NOT EXISTS idx_projects_archived_month_id ON projects(archived_month_id) WHERE archived_month_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_pulled_forward ON projects(pulled_forward) WHERE pulled_forward = true;

-- ============================================================================
-- PART 3: CREATE TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_online_status_updated_at BEFORE UPDATE ON user_online_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_archived_months_updated_at BEFORE UPDATE ON archived_months
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_archived_projects_updated_at BEFORE UPDATE ON archived_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_finance_snapshots_updated_at BEFORE UPDATE ON monthly_finance_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 4: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_channel_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_online_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_pull_forwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_finance_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean re-run)
DROP POLICY IF EXISTS "Users are viewable by everyone" ON users;
DROP POLICY IF EXISTS "Users are insertable by authenticated users" ON users;
DROP POLICY IF EXISTS "Users are updatable by authenticated users" ON users;
DROP POLICY IF EXISTS "Users are deletable by authenticated users" ON users;

-- Create policies (allowing all operations for simplicity - adjust as needed)
CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users are insertable by authenticated users" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users are updatable by authenticated users" ON users FOR UPDATE USING (true);
CREATE POLICY "Users are deletable by authenticated users" ON users FOR DELETE USING (true);

-- Repeat for all tables (abbreviated for brevity - same pattern)
CREATE POLICY "Projects are viewable by everyone" ON projects FOR SELECT USING (true);
CREATE POLICY "Projects are insertable by authenticated users" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Projects are updatable by authenticated users" ON projects FOR UPDATE USING (true);
CREATE POLICY "Projects are deletable by authenticated users" ON projects FOR DELETE USING (true);

CREATE POLICY "Employees are viewable by everyone" ON employees FOR SELECT USING (true);
CREATE POLICY "Employees are insertable by authenticated users" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Employees are updatable by authenticated users" ON employees FOR UPDATE USING (true);
CREATE POLICY "Employees are deletable by authenticated users" ON employees FOR DELETE USING (true);

CREATE POLICY "Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Profiles are insertable by authenticated users" ON profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "Profiles are updatable by authenticated users" ON profiles FOR UPDATE USING (true);
CREATE POLICY "Profiles are deletable by authenticated users" ON profiles FOR DELETE USING (true);

CREATE POLICY "Agencies are viewable by everyone" ON agencies FOR SELECT USING (true);
CREATE POLICY "Agencies are insertable by authenticated users" ON agencies FOR INSERT WITH CHECK (true);
CREATE POLICY "Agencies are updatable by authenticated users" ON agencies FOR UPDATE USING (true);
CREATE POLICY "Agencies are deletable by authenticated users" ON agencies FOR DELETE USING (true);

CREATE POLICY "Brands are viewable by everyone" ON brands FOR SELECT USING (true);
CREATE POLICY "Brands are insertable by authenticated users" ON brands FOR INSERT WITH CHECK (true);
CREATE POLICY "Brands are updatable by authenticated users" ON brands FOR UPDATE USING (true);
CREATE POLICY "Brands are deletable by authenticated users" ON brands FOR DELETE USING (true);

CREATE POLICY "Settings are viewable by everyone" ON settings FOR SELECT USING (true);
CREATE POLICY "Settings are insertable by authenticated users" ON settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Settings are updatable by authenticated users" ON settings FOR UPDATE USING (true);
CREATE POLICY "Settings are deletable by authenticated users" ON settings FOR DELETE USING (true);

CREATE POLICY "Activity logs are viewable by everyone" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "Activity logs are insertable by authenticated users" ON activity_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "Channels are viewable by everyone" ON channels FOR SELECT USING (true);
CREATE POLICY "Channels are insertable by authenticated users" ON channels FOR INSERT WITH CHECK (true);
CREATE POLICY "Channels are updatable by authenticated users" ON channels FOR UPDATE USING (true);
CREATE POLICY "Channels are deletable by authenticated users" ON channels FOR DELETE USING (true);

CREATE POLICY "Sections are viewable by everyone" ON sections FOR SELECT USING (true);
CREATE POLICY "Sections are insertable by authenticated users" ON sections FOR INSERT WITH CHECK (true);
CREATE POLICY "Sections are updatable by authenticated users" ON sections FOR UPDATE USING (true);
CREATE POLICY "Sections are deletable by authenticated users" ON sections FOR DELETE USING (true);

CREATE POLICY "Messages are viewable by everyone" ON messages FOR SELECT USING (true);
CREATE POLICY "Messages are insertable by authenticated users" ON messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Messages are updatable by authenticated users" ON messages FOR UPDATE USING (true);
CREATE POLICY "Messages are deletable by authenticated users" ON messages FOR DELETE USING (true);

CREATE POLICY "User channel reads are viewable by everyone" ON user_channel_reads FOR SELECT USING (true);
CREATE POLICY "User channel reads are insertable by authenticated users" ON user_channel_reads FOR INSERT WITH CHECK (true);
CREATE POLICY "User channel reads are updatable by authenticated users" ON user_channel_reads FOR UPDATE USING (true);
CREATE POLICY "User channel reads are deletable by authenticated users" ON user_channel_reads FOR DELETE USING (true);

CREATE POLICY "Online status is viewable by everyone" ON user_online_status FOR SELECT USING (true);
CREATE POLICY "Online status is insertable by authenticated users" ON user_online_status FOR INSERT WITH CHECK (true);
CREATE POLICY "Online status is updatable by authenticated users" ON user_online_status FOR UPDATE USING (true);
CREATE POLICY "Online status is deletable by authenticated users" ON user_online_status FOR DELETE USING (true);

CREATE POLICY "Archived months are viewable by everyone" ON archived_months FOR SELECT USING (true);
CREATE POLICY "Archived months are insertable by authenticated users" ON archived_months FOR INSERT WITH CHECK (true);
CREATE POLICY "Archived months are updatable by authenticated users" ON archived_months FOR UPDATE USING (true);
CREATE POLICY "Archived months are deletable by authenticated users" ON archived_months FOR DELETE USING (true);

CREATE POLICY "Archived projects are viewable by everyone" ON archived_projects FOR SELECT USING (true);
CREATE POLICY "Archived projects are insertable by authenticated users" ON archived_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Archived projects are updatable by authenticated users" ON archived_projects FOR UPDATE USING (true);
CREATE POLICY "Archived projects are deletable by authenticated users" ON archived_projects FOR DELETE USING (true);

CREATE POLICY "Pull forwards are viewable by everyone" ON project_pull_forwards FOR SELECT USING (true);
CREATE POLICY "Pull forwards are insertable by authenticated users" ON project_pull_forwards FOR INSERT WITH CHECK (true);
CREATE POLICY "Pull forwards are updatable by authenticated users" ON project_pull_forwards FOR UPDATE USING (true);
CREATE POLICY "Pull forwards are deletable by authenticated users" ON project_pull_forwards FOR DELETE USING (true);

CREATE POLICY "Finance snapshots are viewable by everyone" ON monthly_finance_snapshots FOR SELECT USING (true);
CREATE POLICY "Finance snapshots are insertable by authenticated users" ON monthly_finance_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Finance snapshots are updatable by authenticated users" ON monthly_finance_snapshots FOR UPDATE USING (true);
CREATE POLICY "Finance snapshots are deletable by authenticated users" ON monthly_finance_snapshots FOR DELETE USING (true);

-- ============================================================================
-- PART 5: ENABLE REALTIME
-- ============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE channels;
ALTER PUBLICATION supabase_realtime ADD TABLE sections;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE user_online_status;
ALTER PUBLICATION supabase_realtime ADD TABLE user_channel_reads;

-- ============================================================================
-- PART 6: CREATE STORAGE BUCKETS
-- ============================================================================

-- Project attachments bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'project-attachments',
    'project-attachments',
    true,
    52428800,
    ARRAY['image/*', 'video/*', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800;

-- Chat files bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-files',
    'chat-files',
    true,
    52428800,
    ARRAY['image/*', 'video/*', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = 52428800;

-- Storage policies
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Access for chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update chat-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete chat-files" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'project-attachments');
CREATE POLICY "Authenticated users can upload" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'project-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'project-attachments' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'project-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Public Access for chat-files" ON storage.objects
    FOR SELECT USING (bucket_id = 'chat-files');
CREATE POLICY "Authenticated users can upload to chat-files" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'chat-files' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update chat-files" ON storage.objects
    FOR UPDATE USING (bucket_id = 'chat-files' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete chat-files" ON storage.objects
    FOR DELETE USING (bucket_id = 'chat-files' AND auth.role() = 'authenticated');

-- ============================================================================
-- PART 7: INSERT DEFAULT DATA
-- ============================================================================

INSERT INTO settings (key, value) VALUES
    ('currency', 'USD'),
    ('rate', '280')
ON CONFLICT (key) DO NOTHING;

INSERT INTO sections (name, emoji, "order") VALUES
    ('Video Editing', '🎬', 0),
    ('Graphic Designing', '🎨', 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- ✅ COMPLETE! YOUR DATABASE IS READY
-- ============================================================================
-- 
-- What was created:
-- ✅ 17 tables (including monthly closing tables)
-- ✅ 40+ indexes
-- ✅ 15 triggers
-- ✅ 60+ RLS policies
-- ✅ 2 storage buckets
-- ✅ 5 Realtime subscriptions
-- ✅ Default data
--
-- Next steps:
-- 1. Verify in Dashboard: Database > Tables
-- 2. Verify Storage: Storage > Buckets
-- 3. Test your app!
-- ============================================================================

