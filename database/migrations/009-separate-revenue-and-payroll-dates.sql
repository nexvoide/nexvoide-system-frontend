BEGIN;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.projects
SET paid_at = COALESCE(paid_at, start_date::TIMESTAMPTZ, created_at, NOW())
WHERE paid_at IS NULL;

UPDATE public.projects
SET completed_at = COALESCE(completed_at, end_date::TIMESTAMPTZ, updated_at, NOW())
WHERE LOWER(TRIM(status)) = 'completed'
  AND completed_at IS NULL;

ALTER TABLE public.projects
  ALTER COLUMN paid_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_projects_paid_at
  ON public.projects (paid_at);

CREATE INDEX IF NOT EXISTS idx_projects_completed_at
  ON public.projects (completed_at)
  WHERE completed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_project_completion_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF LOWER(TRIM(COALESCE(NEW.status, ''))) = 'completed'
     AND LOWER(TRIM(COALESCE(OLD.status, ''))) <> 'completed' THEN
    NEW.completed_at := NOW();
  ELSIF LOWER(TRIM(COALESCE(NEW.status, ''))) <> 'completed'
        AND LOWER(TRIM(COALESCE(OLD.status, ''))) = 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_project_completion_timestamp ON public.projects;
CREATE TRIGGER set_project_completion_timestamp
BEFORE UPDATE OF status ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_completion_timestamp();

COMMIT;
