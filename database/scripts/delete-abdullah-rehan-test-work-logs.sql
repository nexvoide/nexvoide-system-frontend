BEGIN;

DO $$
DECLARE
  target_employee_id UUID;
  matching_employee_count INTEGER;
  deleted_log_count INTEGER;
BEGIN
  SELECT COUNT(*), MIN(id::TEXT)::UUID
    INTO matching_employee_count, target_employee_id
  FROM public.employees
  WHERE lower(btrim(name)) = lower('Abdullah Rehan');

  IF matching_employee_count = 0 THEN
    RAISE EXCEPTION 'No employee named Abdullah Rehan was found. Nothing was deleted.';
  END IF;

  IF matching_employee_count > 1 THEN
    RAISE EXCEPTION 'More than one employee named Abdullah Rehan was found. Nothing was deleted.';
  END IF;

  DELETE FROM public.employee_daily_work_logs
  WHERE employee_id = target_employee_id;

  GET DIAGNOSTICS deleted_log_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % work-log entries for Abdullah Rehan.', deleted_log_count;
END
$$;

COMMIT;
