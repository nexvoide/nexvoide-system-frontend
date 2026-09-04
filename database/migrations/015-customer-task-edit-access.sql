BEGIN;

CREATE OR REPLACE FUNCTION public.protect_customer_project_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_protected JSONB;
  new_protected JSONB;
BEGIN
  IF public.current_app_user_has_role('admin')
     OR public.current_app_user_has_role('manager')
     OR public.current_app_user_has_role('teamlead') THEN
    RETURN NEW;
  END IF;

  IF NOT public.current_app_user_has_role('client')
     OR NOT public.current_app_user_matches_identity(OLD.client_name)
     OR NEW.client_name IS DISTINCT FROM OLD.client_name
     OR NOT public.current_client_can_create_task(NEW.client_name, NEW.assigned) THEN
    RAISE EXCEPTION 'You can only edit your own tasks and use editors assigned to your account.'
      USING ERRCODE = '42501';
  END IF;

  old_protected := to_jsonb(OLD) - ARRAY[
    'project_name', 'assigned', 'raw_source_link', 'footage_link',
    'notes', 'deadline', 'priority', 'updated_at'
  ];
  new_protected := to_jsonb(NEW) - ARRAY[
    'project_name', 'assigned', 'raw_source_link', 'footage_link',
    'notes', 'deadline', 'priority', 'updated_at'
  ];

  IF new_protected IS DISTINCT FROM old_protected THEN
    RAISE EXCEPTION 'Customers cannot change project financial, ownership, or status fields.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_customer_project_updates ON public.projects;
CREATE TRIGGER protect_customer_project_updates
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.protect_customer_project_updates();

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

COMMIT;
