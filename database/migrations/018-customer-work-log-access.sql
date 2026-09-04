BEGIN;

DROP POLICY IF EXISTS employee_daily_work_logs_select ON public.employee_daily_work_logs;
CREATE POLICY employee_daily_work_logs_select
  ON public.employee_daily_work_logs FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users app_user
      LEFT JOIN public.employees employee ON employee.id = employee_daily_work_logs.employee_id
      WHERE app_user.auth_user_id = auth.uid()
        AND COALESCE(app_user.active, true)
        AND (
          public.current_app_user_has_role('admin')
          OR public.current_app_user_has_role('manager')
          OR lower(btrim(COALESCE(app_user.user_id, app_user.name, ''))) = lower(btrim(COALESCE(employee.name, '')))
          OR (
            public.current_app_user_has_role('client')
            AND EXISTS (
              SELECT 1
              FROM public.company_dedicated_editors assignment
              WHERE assignment.employee_id = employee_daily_work_logs.employee_id
                AND (
                  (assignment.entity_type = 'profile' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = assignment.entity_id AND lower(btrim(p.name)) = lower(btrim(app_user.company_name))))
                  OR (assignment.entity_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = assignment.entity_id AND lower(btrim(a.name)) = lower(btrim(app_user.company_name))))
                  OR (assignment.entity_type = 'brand' AND EXISTS (SELECT 1 FROM public.brands b WHERE b.id = assignment.entity_id AND lower(btrim(b.name)) = lower(btrim(app_user.company_name))))
                )
            )
          )
        )
    )
  );

COMMIT;
