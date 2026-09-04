BEGIN;

CREATE TABLE IF NOT EXISTS public.company_dedicated_editors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('profile', 'agency', 'brand')),
  entity_id UUID NOT NULL,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_company_dedicated_editors_entity
  ON public.company_dedicated_editors (entity_type, entity_id);

ALTER TABLE public.company_dedicated_editors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS company_dedicated_editors_authenticated_select ON public.company_dedicated_editors;
CREATE POLICY company_dedicated_editors_authenticated_select
  ON public.company_dedicated_editors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS company_dedicated_editors_admin_manage ON public.company_dedicated_editors;
CREATE POLICY company_dedicated_editors_admin_manage
  ON public.company_dedicated_editors FOR ALL TO authenticated
  USING (
    public.current_app_user_has_role('admin')
    OR public.current_app_user_has_role('manager')
  )
  WITH CHECK (
    public.current_app_user_has_role('admin')
    OR public.current_app_user_has_role('manager')
  );

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
  app_company_name TEXT;
BEGIN
  SELECT app_user.id, app_user.company_name
    INTO app_user_id, app_company_name
  FROM public.users AS app_user
  WHERE app_user.auth_user_id = auth.uid()
    AND COALESCE(app_user.active, true)
    AND (lower(btrim(app_user.role)) = 'client' OR lower(app_user.role) LIKE '%"client"%')
    AND lower(btrim(COALESCE(requested_client_name, ''))) IN (
      lower(btrim(COALESCE(app_user.user_id, ''))),
      lower(btrim(COALESCE(app_user.name, ''))),
      lower(btrim(COALESCE(app_user.username, '')))
    )
  LIMIT 1;

  IF app_user_id IS NULL OR NULLIF(btrim(app_company_name), '') IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(NULLIF(assigned_value, ''), '[]')::JSONB) AS assignee
    JOIN public.company_dedicated_editors AS assignment
      ON assignment.employee_id::TEXT = COALESCE(assignee->>'employee_id', assignee->>'employeeId', assignee->>'id')
    WHERE (assignment.entity_type = 'profile' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = assignment.entity_id AND lower(btrim(p.name)) = lower(btrim(app_company_name))))
       OR (assignment.entity_type = 'agency' AND EXISTS (SELECT 1 FROM public.agencies a WHERE a.id = assignment.entity_id AND lower(btrim(a.name)) = lower(btrim(app_company_name))))
       OR (assignment.entity_type = 'brand' AND EXISTS (SELECT 1 FROM public.brands b WHERE b.id = assignment.entity_id AND lower(btrim(b.name)) = lower(btrim(app_company_name))))
  );
EXCEPTION WHEN invalid_text_representation THEN
  RETURN false;
END
$$;

REVOKE ALL ON FUNCTION public.current_client_can_create_task(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_client_can_create_task(TEXT, TEXT) TO authenticated;

COMMIT;
