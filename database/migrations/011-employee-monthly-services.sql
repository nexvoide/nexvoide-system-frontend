BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_monthly_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  service_month DATE NOT NULL,
  fixed_salary_pkr NUMERIC(12, 2) NOT NULL CHECK (fixed_salary_pkr >= 0),
  completed_by TEXT,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_monthly_services_employee_month_key UNIQUE (employee_id, service_month),
  CONSTRAINT employee_monthly_services_first_day_check CHECK (EXTRACT(DAY FROM service_month) = 1)
);

CREATE INDEX IF NOT EXISTS idx_employee_monthly_services_month
  ON public.employee_monthly_services (service_month);

ALTER TABLE public.employee_monthly_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_monthly_services_authenticated_select ON public.employee_monthly_services;
CREATE POLICY employee_monthly_services_authenticated_select
  ON public.employee_monthly_services
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS employee_monthly_services_authenticated_insert ON public.employee_monthly_services;
CREATE POLICY employee_monthly_services_authenticated_insert
  ON public.employee_monthly_services
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMIT;
