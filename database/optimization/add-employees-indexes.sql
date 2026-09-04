-- Add indexes to employees table for better query performance
-- Run this in Supabase SQL Editor to optimize employee queries

-- Index on created_at (for ORDER BY queries)
-- This is critical for the getAll() query that orders by created_at
CREATE INDEX IF NOT EXISTS idx_employees_created_at 
ON employees(created_at DESC);

-- Index on active status (if you filter by active employees)
CREATE INDEX IF NOT EXISTS idx_employees_active 
ON employees(active) 
WHERE active = true;

-- Composite index for common query patterns
-- Useful if you often filter by active and order by created_at
CREATE INDEX IF NOT EXISTS idx_employees_active_created_at 
ON employees(active, created_at DESC);

-- Index on name (for search/filter operations)
CREATE INDEX IF NOT EXISTS idx_employees_name 
ON employees(name);

-- Verify indexes were created
SELECT 
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'employees'
ORDER BY indexname;



