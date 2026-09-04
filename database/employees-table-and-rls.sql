-- ============================================================================
-- EMPLOYEES TABLE AND RLS POLICIES
-- ============================================================================
-- This file contains the employees table definition and all related RLS policies
-- extracted from 00-MASTER-SETUP-ALL.sql
-- ============================================================================

-- ============================================================================
-- EMPLOYEES TABLE
-- ============================================================================

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

-- ============================================================================
-- EMPLOYEES INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_employees_created_at ON employees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_active_created_at ON employees(active, created_at DESC);

-- ============================================================================
-- EMPLOYEES TRIGGER (for updated_at)
-- ============================================================================

-- Create the function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the trigger for employees
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES (if they exist)
-- ============================================================================

DROP POLICY IF EXISTS "Employees are viewable by everyone" ON employees;
DROP POLICY IF EXISTS "Employees are insertable by authenticated users" ON employees;
DROP POLICY IF EXISTS "Employees are updatable by authenticated users" ON employees;
DROP POLICY IF EXISTS "Employees are deletable by authenticated users" ON employees;

-- ============================================================================
-- CREATE RLS POLICIES
-- ============================================================================

CREATE POLICY "Employees are viewable by everyone" ON employees FOR SELECT USING (true);
CREATE POLICY "Employees are insertable by authenticated users" ON employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Employees are updatable by authenticated users" ON employees FOR UPDATE USING (true);
CREATE POLICY "Employees are deletable by authenticated users" ON employees FOR DELETE USING (true);

