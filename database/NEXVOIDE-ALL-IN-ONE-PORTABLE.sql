-- ============================================================================
-- NEXVOIDE ALL-IN-ONE PORTABLE SQL
-- ============================================================================
-- Use this on a fresh Supabase/Postgres database.
-- This file merges:
--   - 00-MASTER-SETUP-ALL.sql (core schema, RLS, storage, realtime)
--   - 002-add-subscription-retainer-billing.sql (subscription/time/invoices)
--   - optional employee seed section
--
-- NOTE:
-- - Everything here is idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- - For safety, account-specific cleanup scripts with hardcoded keys are NOT
--   auto-included in executable form.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- CORE TABLES
-- ============================================================================

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
    archived_month_id UUID,
    pulled_forward BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    emoji TEXT DEFAULT '📁',
    "order" INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS user_channel_reads (
    user_id TEXT NOT NULL,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS user_online_status (
    user_id TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- MONTHLY CLOSING TABLES
-- ============================================================================

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

-- Postgres doesn't support "ADD CONSTRAINT IF NOT EXISTS", so we guard manually.
DO $$
BEGIN
  -- Clean up orphan archived_month_id values (existing data may reference missing months)
  -- so the FK can be added safely.
  UPDATE projects p
    SET archived_month_id = NULL
  WHERE p.archived_month_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM archived_months am WHERE am.id = p.archived_month_id
    );

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'projects_archived_month_fk'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_archived_month_fk
      FOREIGN KEY (archived_month_id) REFERENCES archived_months(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- SUBSCRIPTION + TIME TRACKING + INVOICING (Migration 002)
-- ============================================================================

ALTER TABLE projects ADD COLUMN IF NOT EXISTS billing_model TEXT DEFAULT 'project';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS monthly_included_hours NUMERIC(10, 2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS monthly_base_price NUMERIC(12, 2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS extra_hour_rate NUMERIC(12, 2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS employee_extra_hour_rate_pkr NUMERIC(12, 2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS employee_monthly_base_payout_pkr NUMERIC(12, 2);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS subscription_start_date DATE;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS subscription_end_date DATE;

CREATE TABLE IF NOT EXISTS time_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    hours NUMERIC(10, 2) NOT NULL DEFAULT 0,
    is_overtime BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_key TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
    status TEXT DEFAULT 'draft',
    subtotal NUMERIC(12, 2) DEFAULT 0,
    total NUMERIC(12, 2) DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(customer_key, period_year, period_month)
);

CREATE TABLE IF NOT EXISTS invoice_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 0,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(12, 2) NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES (core + subscription)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived) WHERE archived = false;
CREATE INDEX IF NOT EXISTS idx_projects_billing_model ON projects(billing_model);
CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel_created ON messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_months_year_month ON archived_months(year, month);
CREATE INDEX IF NOT EXISTS idx_archived_projects_month_id ON archived_projects(archived_month_id);
CREATE INDEX IF NOT EXISTS idx_projects_archived_month_id ON projects(archived_month_id) WHERE archived_month_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_projects_pulled_forward ON projects(pulled_forward) WHERE pulled_forward = true;
CREATE INDEX IF NOT EXISTS idx_time_entries_project_date ON time_entries(project_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON time_entries(employee_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
DROP TRIGGER IF EXISTS update_employees_updated_at ON employees;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_agencies_updated_at ON agencies;
DROP TRIGGER IF EXISTS update_brands_updated_at ON brands;
DROP TRIGGER IF EXISTS update_settings_updated_at ON settings;
DROP TRIGGER IF EXISTS update_channels_updated_at ON channels;
DROP TRIGGER IF EXISTS update_sections_updated_at ON sections;
DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
DROP TRIGGER IF EXISTS update_user_online_status_updated_at ON user_online_status;
DROP TRIGGER IF EXISTS update_archived_months_updated_at ON archived_months;
DROP TRIGGER IF EXISTS update_archived_projects_updated_at ON archived_projects;
DROP TRIGGER IF EXISTS update_finance_snapshots_updated_at ON monthly_finance_snapshots;
DROP TRIGGER IF EXISTS update_time_entries_updated_at ON time_entries;
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
DROP TRIGGER IF EXISTS update_invoice_items_updated_at ON invoice_items;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_brands_updated_at BEFORE UPDATE ON brands FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_messages_updated_at BEFORE UPDATE ON messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_online_status_updated_at BEFORE UPDATE ON user_online_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_archived_months_updated_at BEFORE UPDATE ON archived_months FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_archived_projects_updated_at BEFORE UPDATE ON archived_projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_finance_snapshots_updated_at BEFORE UPDATE ON monthly_finance_snapshots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_time_entries_updated_at BEFORE UPDATE ON time_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoice_items_updated_at BEFORE UPDATE ON invoice_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- RLS + OPEN POLICIES
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
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- Simple "allow all" policies (same approach used in project SQL)
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','projects','employees','profiles','agencies','brands','settings',
    'activity_logs','channels','sections','messages','user_channel_reads',
    'user_online_status','archived_months','archived_projects',
    'project_pull_forwards','monthly_finance_snapshots',
    'time_entries','invoices','invoice_items'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON %I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON %I', t, t);
    EXECUTE format('CREATE POLICY "%s_select" ON %I FOR SELECT USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_insert" ON %I FOR INSERT WITH CHECK (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_update" ON %I FOR UPDATE USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_delete" ON %I FOR DELETE USING (true)', t, t);
  END LOOP;
END $$;

-- ============================================================================
-- REALTIME
-- ============================================================================
-- Make publication adds idempotent (skip if already present)
DO $$
DECLARE
  v_pubname TEXT := 'supabase_realtime';
  relid OID;
BEGIN
  -- channels
  SELECT 'public.channels'::regclass INTO relid;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = v_pubname AND pr.prrelid = relid
  ) THEN
    EXECUTE format('ALTER PUBLICATION %I ADD TABLE public.channels', v_pubname);
  END IF;

  -- sections
  SELECT 'public.sections'::regclass INTO relid;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = v_pubname AND pr.prrelid = relid
  ) THEN
    EXECUTE format('ALTER PUBLICATION %I ADD TABLE public.sections', v_pubname);
  END IF;

  -- messages
  SELECT 'public.messages'::regclass INTO relid;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = v_pubname AND pr.prrelid = relid
  ) THEN
    EXECUTE format('ALTER PUBLICATION %I ADD TABLE public.messages', v_pubname);
  END IF;

  -- user_online_status
  SELECT 'public.user_online_status'::regclass INTO relid;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = v_pubname AND pr.prrelid = relid
  ) THEN
    EXECUTE format('ALTER PUBLICATION %I ADD TABLE public.user_online_status', v_pubname);
  END IF;

  -- user_channel_reads
  SELECT 'public.user_channel_reads'::regclass INTO relid;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_rel pr
    JOIN pg_publication p ON p.oid = pr.prpubid
    WHERE p.pubname = v_pubname AND pr.prrelid = relid
  ) THEN
    EXECUTE format('ALTER PUBLICATION %I ADD TABLE public.user_channel_reads', v_pubname);
  END IF;
END $$;

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'project-attachments',
    'project-attachments',
    true,
    52428800,
    ARRAY['image/*', 'video/*', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-files',
    'chat-files',
    true,
    52428800,
    ARRAY['image/*', 'video/*', 'application/pdf', 'application/zip', 'application/x-zip-compressed', 'text/*', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 52428800;

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
-- DEFAULT DATA
-- ============================================================================

-- settings.value may be TEXT in some schemas or JSON/JSONB in others.
-- Insert defaults in a type-safe way.
DO $$
DECLARE
  value_type TEXT;
BEGIN
  SELECT data_type
    INTO value_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'settings'
    AND column_name = 'value'
  LIMIT 1;

  IF value_type IN ('json', 'jsonb') THEN
    -- Store JSON strings for currency/rate
    INSERT INTO settings (key, value) VALUES
      ('currency', '"USD"'::jsonb),
      ('rate', '"280"'::jsonb)
    ON CONFLICT (key) DO NOTHING;
  ELSE
    INSERT INTO settings (key, value) VALUES
      ('currency', 'USD'),
      ('rate', '280')
    ON CONFLICT (key) DO NOTHING;
  END IF;
END $$;

INSERT INTO sections (name, emoji, "order") VALUES
    ('Video Editing', '🎬', 0),
    ('Graphic Designing', '🎨', 1)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- OPTIONAL: EMPLOYEE SEED DATA
-- Uncomment if you want seed records from insert-employees-data.sql
-- ============================================================================
/*
-- Paste your INSERT INTO employees (...) VALUES ... here if needed.
*/

-- ============================================================================
-- OPTIONAL: STORAGE CLEANUP CRON TEMPLATE (NO HARDCODED KEYS)
-- ============================================================================
/*
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
SELECT cron.unschedule('cleanup-storage-daily');
SELECT cron.schedule(
  'cleanup-storage-daily',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/cleanup-storage',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
*/

-- ============================================================================
-- DONE
-- ============================================================================
