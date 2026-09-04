BEGIN;

CREATE OR REPLACE FUNCTION public.current_app_user_has_role(requested_role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.auth_user_id = auth.uid()
        AND COALESCE(app_user.active, true)
        AND (
          lower(btrim(app_user.role)) = lower(btrim(requested_role))
          OR lower(app_user.role) LIKE '%"' || lower(btrim(requested_role)) || '"%'
        )
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_matches_identity(candidate TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.users AS app_user
      WHERE app_user.auth_user_id = auth.uid()
        AND COALESCE(app_user.active, true)
        AND lower(btrim(COALESCE(candidate, ''))) IN (
          lower(app_user.id::TEXT),
          lower(btrim(COALESCE(app_user.user_id, ''))),
          lower(btrim(COALESCE(app_user.name, ''))),
          lower(btrim(COALESCE(app_user.username, '')))
        )
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.current_app_user_is_project_assignee(assigned_value TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN COALESCE(
    EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(NULLIF(assigned_value, ''), '[]')::JSONB) AS assignee
      LEFT JOIN public.employees AS employee
        ON employee.id::TEXT = COALESCE(assignee->>'employee_id', assignee->>'employeeId', assignee->>'id')
      INNER JOIN public.users AS app_user
        ON app_user.auth_user_id = auth.uid()
       AND COALESCE(app_user.active, true)
      WHERE lower(btrim(COALESCE(assignee->>'name', employee.name, ''))) IN (
              lower(btrim(COALESCE(app_user.name, ''))),
              lower(btrim(COALESCE(app_user.user_id, ''))),
              lower(btrim(COALESCE(app_user.username, '')))
            )
         OR lower(btrim(COALESCE(employee.name, ''))) IN (
              lower(btrim(COALESCE(app_user.name, ''))),
              lower(btrim(COALESCE(app_user.user_id, '')))
            )
    ),
    false
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END
$$;

CREATE OR REPLACE FUNCTION public.current_client_can_create_task(
  requested_client_name TEXT,
  assigned_value TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  app_user_id UUID;
BEGIN
  SELECT app_user.id
  INTO app_user_id
  FROM public.users AS app_user
  WHERE app_user.auth_user_id = auth.uid()
    AND COALESCE(app_user.active, true)
    AND (
      lower(btrim(app_user.role)) = 'client'
      OR lower(app_user.role) LIKE '%"client"%'
    )
    AND lower(btrim(COALESCE(requested_client_name, ''))) IN (
      lower(btrim(COALESCE(app_user.user_id, ''))),
      lower(btrim(COALESCE(app_user.name, ''))),
      lower(btrim(COALESCE(app_user.username, '')))
    )
  LIMIT 1;

  IF app_user_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(NULLIF(assigned_value, ''), '[]')::JSONB) AS assignee
    INNER JOIN public.customer_editor_assignments AS assignment
      ON assignment.customer_user_id = app_user_id
     AND assignment.employee_id::TEXT = COALESCE(
       assignee->>'employee_id',
       assignee->>'employeeId',
       assignee->>'id'
     )
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END
$$;

REVOKE ALL ON FUNCTION public.current_app_user_has_role(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_user_matches_identity(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_app_user_is_project_assignee(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_client_can_create_task(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_has_role(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_user_matches_identity(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_user_is_project_assignee(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_client_can_create_task(TEXT, TEXT) TO authenticated;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_role_select ON public.projects;
CREATE POLICY projects_role_select
  ON public.projects
  FOR SELECT
  TO authenticated
  USING (
    public.current_app_user_has_role('admin')
    OR public.current_app_user_has_role('manager')
    OR public.current_app_user_matches_identity(client_name)
    OR public.current_app_user_is_project_assignee(assigned)
    OR (
      public.current_app_user_has_role('teamlead')
      AND EXISTS (
        SELECT 1
        FROM public.users AS app_user
        WHERE app_user.auth_user_id = auth.uid()
          AND lower(btrim(COALESCE(app_user.service, ''))) = lower(btrim(COALESCE(projects.service, '')))
      )
    )
  );

DROP POLICY IF EXISTS projects_role_insert ON public.projects;
CREATE POLICY projects_role_insert
  ON public.projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_app_user_has_role('admin')
    OR public.current_app_user_has_role('manager')
    OR public.current_client_can_create_task(client_name, assigned)
  );

DROP POLICY IF EXISTS projects_role_update ON public.projects;
CREATE POLICY projects_role_update
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING (
    public.current_app_user_has_role('admin')
    OR public.current_app_user_has_role('manager')
    OR public.current_app_user_has_role('teamlead')
    OR public.current_app_user_matches_identity(client_name)
  )
  WITH CHECK (
    public.current_app_user_has_role('admin')
    OR public.current_app_user_has_role('manager')
    OR public.current_app_user_has_role('teamlead')
    OR public.current_app_user_matches_identity(client_name)
  );

DROP POLICY IF EXISTS projects_role_delete ON public.projects;
CREATE POLICY projects_role_delete
  ON public.projects
  FOR DELETE
  TO authenticated
  USING (
    public.current_app_user_has_role('admin')
    OR public.current_app_user_has_role('manager')
  );

COMMIT;
