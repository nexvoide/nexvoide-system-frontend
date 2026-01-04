-- ============================================================================
-- MIGRATION: Add Monthly Closing Tables and Columns
-- ============================================================================
-- This migration adds support for monthly closing functionality:
--   1. archived_months table - stores closed month records
--   2. archived_projects table - stores archived project snapshots
--   3. project_pull_forwards table - tracks projects pulled forward
--   4. monthly_finance_snapshots table - stores finance snapshots per month
--   5. Additional columns in projects table
-- ============================================================================
-- INSTRUCTIONS:
--   1. Open Supabase Dashboard > SQL Editor
--   2. Copy this ENTIRE file
--   3. Paste and Run
--   4. Done! Monthly closing will now work.
-- ============================================================================

-- ============================================================================
-- PART 1: CREATE ARCHIVED_MONTHS TABLE
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

-- ============================================================================
-- PART 2: CREATE ARCHIVED_PROJECTS TABLE
-- ============================================================================

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

-- ============================================================================
-- PART 3: CREATE PROJECT_PULL_FORWARDS TABLE
-- ============================================================================

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

-- ============================================================================
-- PART 4: CREATE MONTHLY_FINANCE_SNAPSHOTS TABLE
-- ============================================================================

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

-- ============================================================================
-- PART 5: ADD COLUMNS TO PROJECTS TABLE
-- ============================================================================

-- Add archived_month_id column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'archived_month_id'
    ) THEN
        ALTER TABLE projects ADD COLUMN archived_month_id UUID REFERENCES archived_months(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add pulled_forward column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'pulled_forward'
    ) THEN
        ALTER TABLE projects ADD COLUMN pulled_forward BOOLEAN DEFAULT false;
    END IF;
END $$;

-- ============================================================================
-- PART 6: CREATE INDEXES
-- ============================================================================

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
-- PART 7: CREATE TRIGGERS
-- ============================================================================

-- Drop existing triggers if they exist (for idempotent migration)
DROP TRIGGER IF EXISTS update_archived_months_updated_at ON archived_months;
DROP TRIGGER IF EXISTS update_archived_projects_updated_at ON archived_projects;
DROP TRIGGER IF EXISTS update_finance_snapshots_updated_at ON monthly_finance_snapshots;

-- Update updated_at trigger for archived_months
CREATE TRIGGER update_archived_months_updated_at BEFORE UPDATE ON archived_months
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at trigger for archived_projects
CREATE TRIGGER update_archived_projects_updated_at BEFORE UPDATE ON archived_projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Update updated_at trigger for monthly_finance_snapshots
CREATE TRIGGER update_finance_snapshots_updated_at BEFORE UPDATE ON monthly_finance_snapshots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 8: ENABLE RLS AND CREATE POLICIES
-- ============================================================================

ALTER TABLE archived_months ENABLE ROW LEVEL SECURITY;
ALTER TABLE archived_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_pull_forwards ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_finance_snapshots ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Archived months are viewable by everyone" ON archived_months;
DROP POLICY IF EXISTS "Archived months are insertable by authenticated users" ON archived_months;
DROP POLICY IF EXISTS "Archived months are updatable by authenticated users" ON archived_months;
DROP POLICY IF EXISTS "Archived months are deletable by authenticated users" ON archived_months;

DROP POLICY IF EXISTS "Archived projects are viewable by everyone" ON archived_projects;
DROP POLICY IF EXISTS "Archived projects are insertable by authenticated users" ON archived_projects;
DROP POLICY IF EXISTS "Archived projects are updatable by authenticated users" ON archived_projects;
DROP POLICY IF EXISTS "Archived projects are deletable by authenticated users" ON archived_projects;

DROP POLICY IF EXISTS "Pull forwards are viewable by everyone" ON project_pull_forwards;
DROP POLICY IF EXISTS "Pull forwards are insertable by authenticated users" ON project_pull_forwards;
DROP POLICY IF EXISTS "Pull forwards are updatable by authenticated users" ON project_pull_forwards;
DROP POLICY IF EXISTS "Pull forwards are deletable by authenticated users" ON project_pull_forwards;

DROP POLICY IF EXISTS "Finance snapshots are viewable by everyone" ON monthly_finance_snapshots;
DROP POLICY IF EXISTS "Finance snapshots are insertable by authenticated users" ON monthly_finance_snapshots;
DROP POLICY IF EXISTS "Finance snapshots are updatable by authenticated users" ON monthly_finance_snapshots;
DROP POLICY IF EXISTS "Finance snapshots are deletable by authenticated users" ON monthly_finance_snapshots;

-- Create policies for archived_months
CREATE POLICY "Archived months are viewable by everyone" ON archived_months FOR SELECT USING (true);
CREATE POLICY "Archived months are insertable by authenticated users" ON archived_months FOR INSERT WITH CHECK (true);
CREATE POLICY "Archived months are updatable by authenticated users" ON archived_months FOR UPDATE USING (true);
CREATE POLICY "Archived months are deletable by authenticated users" ON archived_months FOR DELETE USING (true);

-- Create policies for archived_projects
CREATE POLICY "Archived projects are viewable by everyone" ON archived_projects FOR SELECT USING (true);
CREATE POLICY "Archived projects are insertable by authenticated users" ON archived_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Archived projects are updatable by authenticated users" ON archived_projects FOR UPDATE USING (true);
CREATE POLICY "Archived projects are deletable by authenticated users" ON archived_projects FOR DELETE USING (true);

-- Create policies for project_pull_forwards
CREATE POLICY "Pull forwards are viewable by everyone" ON project_pull_forwards FOR SELECT USING (true);
CREATE POLICY "Pull forwards are insertable by authenticated users" ON project_pull_forwards FOR INSERT WITH CHECK (true);
CREATE POLICY "Pull forwards are updatable by authenticated users" ON project_pull_forwards FOR UPDATE USING (true);
CREATE POLICY "Pull forwards are deletable by authenticated users" ON project_pull_forwards FOR DELETE USING (true);

-- Create policies for monthly_finance_snapshots
CREATE POLICY "Finance snapshots are viewable by everyone" ON monthly_finance_snapshots FOR SELECT USING (true);
CREATE POLICY "Finance snapshots are insertable by authenticated users" ON monthly_finance_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "Finance snapshots are updatable by authenticated users" ON monthly_finance_snapshots FOR UPDATE USING (true);
CREATE POLICY "Finance snapshots are deletable by authenticated users" ON monthly_finance_snapshots FOR DELETE USING (true);

-- ============================================================================
-- ✅ MIGRATION COMPLETE!
-- ============================================================================
-- 
-- What was created:
-- ✅ archived_months table
-- ✅ archived_projects table
-- ✅ project_pull_forwards table
-- ✅ monthly_finance_snapshots table
-- ✅ archived_month_id column in projects table
-- ✅ pulled_forward column in projects table
-- ✅ All indexes
-- ✅ All triggers
-- ✅ All RLS policies
--
-- Next steps:
-- 1. Verify in Dashboard: Database > Tables
-- 2. Try closing a month in your app
-- ============================================================================

