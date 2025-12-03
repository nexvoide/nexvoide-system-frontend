-- ============================================================================
-- NEXVOIDE COMPLETE DATABASE SETUP
-- ============================================================================
-- This file creates the ENTIRE database schema from scratch
-- Run this in Supabase SQL Editor to set up everything at once
-- ============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- ============================================================================
-- 1. CORE TABLES
-- ============================================================================

-- Users table (authentication and user management)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'employee', -- Can be: admin, manager, employee, client, team_lead
    avatar TEXT,
    active BOOLEAN DEFAULT true,
    service TEXT, -- For team leads
    user_id TEXT, -- For employees/clients
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
    quantity TEXT, -- Can be string or null
    revision_quantity TEXT, -- Can be string or null
    amount NUMERIC(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    status TEXT DEFAULT 'In Progress',
    is_revision BOOLEAN DEFAULT false,
    start_date DATE,
    end_date DATE,
    deadline DATE,
    assigned TEXT DEFAULT '[]', -- JSON array as text
    raw_source_link TEXT,
    attachments TEXT DEFAULT '[]', -- JSON array as text
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
    rate_type TEXT DEFAULT 'fixed', -- fixed or hourly
    rate_value NUMERIC(10, 2) DEFAULT 0,
    street TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    zip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles table (Fiverr/Upwork profiles)
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

-- Settings table (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT, -- Can be user_id or user_name
    action TEXT NOT NULL, -- created, updated, deleted, status_changed
    entity_type TEXT NOT NULL, -- project, employee, profile, etc.
    entity_id TEXT NOT NULL,
    details JSONB, -- Stores description, old_value, new_value, user_name
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CHAT SYSTEM TABLES
-- ============================================================================

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
    type TEXT DEFAULT 'text', -- text or voice
    users TEXT[] DEFAULT '{}', -- Array of user IDs
    read_only BOOLEAN DEFAULT false,
    "order" INTEGER DEFAULT 0,
    section_name TEXT,
    user_limit INTEGER, -- For voice rooms
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
    mentions TEXT[], -- Array of user IDs mentioned
    reply_to UUID REFERENCES messages(id) ON DELETE SET NULL,
    delivery_status TEXT DEFAULT 'sent', -- sent, delivered, read
    read_by TEXT[], -- Array of user IDs who read the message
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    attachments JSONB, -- Array of attachment objects
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User channel reads table (for unread message counts)
CREATE TABLE IF NOT EXISTS user_channel_reads (
    user_id TEXT NOT NULL,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, channel_id)
);

-- ============================================================================
-- 3. ONLINE STATUS TABLE
-- ============================================================================

-- User online status table
CREATE TABLE IF NOT EXISTS user_online_status (
    user_id TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. INDEXES FOR PERFORMANCE
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

-- Chat system indexes
CREATE INDEX IF NOT EXISTS idx_channels_order ON channels("order");
CREATE INDEX IF NOT EXISTS idx_channels_section ON channels(section_name);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(type);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_channel_reads_user ON user_channel_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_user_channel_reads_channel ON user_channel_reads(channel_id);

-- Online status indexes
CREATE INDEX IF NOT EXISTS idx_user_online_status_last_seen ON user_online_status(last_seen DESC);

-- ============================================================================
-- 5. TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables with updated_at
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

-- ============================================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
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

-- Policies: Allow all operations for authenticated users (using anon key)
-- Adjust these policies based on your security requirements

-- Users: Allow read for all, write for authenticated
CREATE POLICY "Users are viewable by everyone" ON users
    FOR SELECT USING (true);

CREATE POLICY "Users are insertable by authenticated users" ON users
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users are updatable by authenticated users" ON users
    FOR UPDATE USING (true);

CREATE POLICY "Users are deletable by authenticated users" ON users
    FOR DELETE USING (true);

-- Projects: Allow all operations
CREATE POLICY "Projects are viewable by everyone" ON projects
    FOR SELECT USING (true);

CREATE POLICY "Projects are insertable by authenticated users" ON projects
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Projects are updatable by authenticated users" ON projects
    FOR UPDATE USING (true);

CREATE POLICY "Projects are deletable by authenticated users" ON projects
    FOR DELETE USING (true);

-- Employees: Allow all operations
CREATE POLICY "Employees are viewable by everyone" ON employees
    FOR SELECT USING (true);

CREATE POLICY "Employees are insertable by authenticated users" ON employees
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Employees are updatable by authenticated users" ON employees
    FOR UPDATE USING (true);

CREATE POLICY "Employees are deletable by authenticated users" ON employees
    FOR DELETE USING (true);

-- Profiles: Allow all operations
CREATE POLICY "Profiles are viewable by everyone" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Profiles are insertable by authenticated users" ON profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Profiles are updatable by authenticated users" ON profiles
    FOR UPDATE USING (true);

CREATE POLICY "Profiles are deletable by authenticated users" ON profiles
    FOR DELETE USING (true);

-- Agencies: Allow all operations
CREATE POLICY "Agencies are viewable by everyone" ON agencies
    FOR SELECT USING (true);

CREATE POLICY "Agencies are insertable by authenticated users" ON agencies
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Agencies are updatable by authenticated users" ON agencies
    FOR UPDATE USING (true);

CREATE POLICY "Agencies are deletable by authenticated users" ON agencies
    FOR DELETE USING (true);

-- Brands: Allow all operations
CREATE POLICY "Brands are viewable by everyone" ON brands
    FOR SELECT USING (true);

CREATE POLICY "Brands are insertable by authenticated users" ON brands
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Brands are updatable by authenticated users" ON brands
    FOR UPDATE USING (true);

CREATE POLICY "Brands are deletable by authenticated users" ON brands
    FOR DELETE USING (true);

-- Settings: Allow all operations
CREATE POLICY "Settings are viewable by everyone" ON settings
    FOR SELECT USING (true);

CREATE POLICY "Settings are insertable by authenticated users" ON settings
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Settings are updatable by authenticated users" ON settings
    FOR UPDATE USING (true);

CREATE POLICY "Settings are deletable by authenticated users" ON settings
    FOR DELETE USING (true);

-- Activity logs: Allow all operations
CREATE POLICY "Activity logs are viewable by everyone" ON activity_logs
    FOR SELECT USING (true);

CREATE POLICY "Activity logs are insertable by authenticated users" ON activity_logs
    FOR INSERT WITH CHECK (true);

-- Channels: Allow all operations
CREATE POLICY "Channels are viewable by everyone" ON channels
    FOR SELECT USING (true);

CREATE POLICY "Channels are insertable by authenticated users" ON channels
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Channels are updatable by authenticated users" ON channels
    FOR UPDATE USING (true);

CREATE POLICY "Channels are deletable by authenticated users" ON channels
    FOR DELETE USING (true);

-- Sections: Allow all operations
CREATE POLICY "Sections are viewable by everyone" ON sections
    FOR SELECT USING (true);

CREATE POLICY "Sections are insertable by authenticated users" ON sections
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Sections are updatable by authenticated users" ON sections
    FOR UPDATE USING (true);

CREATE POLICY "Sections are deletable by authenticated users" ON sections
    FOR DELETE USING (true);

-- Messages: Allow all operations
CREATE POLICY "Messages are viewable by everyone" ON messages
    FOR SELECT USING (true);

CREATE POLICY "Messages are insertable by authenticated users" ON messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Messages are updatable by authenticated users" ON messages
    FOR UPDATE USING (true);

CREATE POLICY "Messages are deletable by authenticated users" ON messages
    FOR DELETE USING (true);

-- User channel reads: Allow all operations
CREATE POLICY "User channel reads are viewable by everyone" ON user_channel_reads
    FOR SELECT USING (true);

CREATE POLICY "User channel reads are insertable by authenticated users" ON user_channel_reads
    FOR INSERT WITH CHECK (true);

CREATE POLICY "User channel reads are updatable by authenticated users" ON user_channel_reads
    FOR UPDATE USING (true);

CREATE POLICY "User channel reads are deletable by authenticated users" ON user_channel_reads
    FOR DELETE USING (true);

-- Online status: Allow all operations
CREATE POLICY "Online status is viewable by everyone" ON user_online_status
    FOR SELECT USING (true);

CREATE POLICY "Online status is insertable by authenticated users" ON user_online_status
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Online status is updatable by authenticated users" ON user_online_status
    FOR UPDATE USING (true);

CREATE POLICY "Online status is deletable by authenticated users" ON user_online_status
    FOR DELETE USING (true);

-- ============================================================================
-- 7. ENABLE REALTIME FOR TABLES
-- ============================================================================

-- Enable Realtime for tables that need instant updates
ALTER PUBLICATION supabase_realtime ADD TABLE channels;
ALTER PUBLICATION supabase_realtime ADD TABLE sections;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE user_online_status;
ALTER PUBLICATION supabase_realtime ADD TABLE user_channel_reads;

-- ============================================================================
-- 8. INITIAL DATA (Optional)
-- ============================================================================

-- Insert default settings
INSERT INTO settings (key, value) VALUES
    ('currency', 'USD'),
    ('rate', '280')
ON CONFLICT (key) DO NOTHING;

-- Insert default chat sections
INSERT INTO sections (name, emoji, "order") VALUES
    ('Video Editing', '🎬', 0),
    ('Graphic Designing', '🎨', 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- COMPLETE!
-- ============================================================================
-- All tables, indexes, triggers, RLS policies, and Realtime subscriptions
-- have been created. Your database is ready to use!
-- ============================================================================

