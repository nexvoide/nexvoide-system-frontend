BEGIN;

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS employee_type TEXT NOT NULL DEFAULT 'project_based',
  ADD COLUMN IF NOT EXISTS monthly_salary NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duty_hours TEXT,
  ADD COLUMN IF NOT EXISTS assigned_client TEXT;

UPDATE public.employees
SET employee_type = 'project_based'
WHERE employee_type IS NULL OR employee_type NOT IN ('project_based', 'retainer', 'hybrid');

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_employee_type_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_employee_type_check
  CHECK (employee_type IN ('project_based', 'retainer', 'hybrid'));

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_monthly_salary_check;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_monthly_salary_check
  CHECK (monthly_salary >= 0);

COMMIT;
