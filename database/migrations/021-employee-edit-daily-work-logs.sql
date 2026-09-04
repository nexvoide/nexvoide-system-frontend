BEGIN;

DROP POLICY IF EXISTS employee_daily_work_logs_update
  ON public.employee_daily_work_logs;

CREATE POLICY employee_daily_work_logs_update
  ON public.employee_daily_work_logs
  FOR UPDATE
  TO authenticated
  USING (
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
  )
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
