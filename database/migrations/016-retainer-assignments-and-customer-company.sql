BEGIN;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS retainer_assignments JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.employee_monthly_services
  ADD COLUMN IF NOT EXISTS customer_revenue_pkr NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS assignment_snapshot JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE public.employee_monthly_services
  DROP CONSTRAINT IF EXISTS employee_monthly_services_customer_revenue_check;

ALTER TABLE public.employee_monthly_services
  ADD CONSTRAINT employee_monthly_services_customer_revenue_check
  CHECK (customer_revenue_pkr >= 0);

COMMIT;
