BEGIN;

ALTER TABLE public.employee_daily_work_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_daily_work_logs_employee_own_select
  ON public.employee_daily_work_logs;

CREATE POLICY employee_daily_work_logs_employee_own_select
  ON public.employee_daily_work_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users AS app_user
      JOIN public.employees AS employee
        ON employee.id = employee_daily_work_logs.employee_id
      WHERE app_user.auth_user_id = auth.uid()
        AND COALESCE(app_user.active, true)
        AND (
          lower(btrim(COALESCE(employee.name, ''))) = lower(btrim(COALESCE(app_user.name, '')))
          OR lower(btrim(COALESCE(employee.name, ''))) = lower(btrim(COALESCE(app_user.user_id, '')))
          OR lower(btrim(COALESCE(employee.name, ''))) = lower(btrim(COALESCE(app_user.username, '')))
          OR employee.id::TEXT = btrim(COALESCE(app_user.user_id, ''))
        )
    )
  );

DROP POLICY IF EXISTS employee_daily_work_logs_insert
  ON public.employee_daily_work_logs;

CREATE POLICY employee_daily_work_logs_insert
  ON public.employee_daily_work_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.users AS app_user
      JOIN public.employees AS employee
        ON employee.id = employee_daily_work_logs.employee_id
      WHERE app_user.auth_user_id = auth.uid()
        AND COALESCE(app_user.active, true)
        AND employee.employee_type IN ('retainer', 'hybrid')
        AND (
          lower(btrim(COALESCE(employee.name, ''))) = lower(btrim(COALESCE(app_user.name, '')))
          OR lower(btrim(COALESCE(employee.name, ''))) = lower(btrim(COALESCE(app_user.user_id, '')))
          OR lower(btrim(COALESCE(employee.name, ''))) = lower(btrim(COALESCE(app_user.username, '')))
          OR employee.id::TEXT = btrim(COALESCE(app_user.user_id, ''))
        )
    )
  );

COMMIT;
