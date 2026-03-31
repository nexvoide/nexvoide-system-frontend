export function toYearMonth(dateValue) {
  if (!dateValue) return "";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function isPulledForwardProject(project) {
  return project?.pulled_forward === true || project?.pulledForward === true;
}

/**
 * Single source of truth for payout/balance month:
 * - Pulled-forward project -> month of start date
 * - Otherwise -> month of end date
 * - Fallback -> month of start date
 */
export function getBalanceMonth(project) {
  if (!project) return "";
  const isPulledForward = isPulledForwardProject(project);

  const startDate = project.startDate || project.start_date || "";
  const endDate = project.endDate || project.end_date || "";

  if (isPulledForward) return toYearMonth(startDate) || toYearMonth(endDate);
  return toYearMonth(endDate) || toYearMonth(startDate);
}

/**
 * Include rule used by balance screens.
 * Pulled-forward projects are visible in the current month even if dates are old.
 */
export function belongsToBalanceMonth(project, targetMonth, currentMonth) {
  if (!project || !targetMonth) return false;
  if (!currentMonth) return getBalanceMonth(project) === targetMonth;
  if (isPulledForwardProject(project) && targetMonth === currentMonth) return true;
  return getBalanceMonth(project) === targetMonth;
}

