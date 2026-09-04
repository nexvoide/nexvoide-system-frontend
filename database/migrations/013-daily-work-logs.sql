BEGIN;

CREATE TABLE IF NOT EXISTS public.employee_daily_work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  project_task TEXT NOT NULL,
  activity TEXT NOT NULL,
  minutes_spent INTEGER NOT NULL CHECK (minutes_spent > 0 AND minutes_spent <= 1440),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_daily_work_logs_employee_date
  ON public.employee_daily_work_logs (employee_id, work_date DESC);

ALTER TABLE public.employee_daily_work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_daily_work_logs_select ON public.employee_daily_work_logs;
CREATE POLICY employee_daily_work_logs_select
  ON public.employee_daily_work_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      LEFT JOIN public.employees e ON e.id = employee_daily_work_logs.employee_id
      WHERE u.auth_user_id = auth.uid()
        AND (
          LOWER(COALESCE(u.role, '')) LIKE '%admin%'
          OR LOWER(COALESCE(u.role, '')) LIKE '%manager%'
          OR LOWER(COALESCE(u.user_id, u.name, '')) = LOWER(COALESCE(e.name, ''))
        )
    )
  );

DROP POLICY IF EXISTS employee_daily_work_logs_insert ON public.employee_daily_work_logs;
CREATE POLICY employee_daily_work_logs_insert
  ON public.employee_daily_work_logs FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.employees e ON e.id = employee_daily_work_logs.employee_id
      WHERE u.auth_user_id = auth.uid()
        AND LOWER(COALESCE(u.user_id, u.name, '')) = LOWER(COALESCE(e.name, ''))
        AND e.employee_type IN ('retainer', 'hybrid')
    )
  );

COMMIT;
