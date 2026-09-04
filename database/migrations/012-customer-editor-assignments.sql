BEGIN;
CREATE TABLE IF NOT EXISTS public.customer_editor_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_user_id, employee_id)
);
ALTER TABLE public.customer_editor_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS customer_editor_assignments_authenticated_select ON public.customer_editor_assignments;
CREATE POLICY customer_editor_assignments_authenticated_select ON public.customer_editor_assignments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS customer_editor_assignments_authenticated_manage ON public.customer_editor_assignments;
CREATE POLICY customer_editor_assignments_authenticated_manage ON public.customer_editor_assignments FOR ALL TO authenticated USING (true) WITH CHECK (true);
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS footage_link TEXT;
COMMIT;
