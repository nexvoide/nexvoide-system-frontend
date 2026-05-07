export function getMonthBounds(year, month) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getProjectCustomerKey(project) {
  return String(
    project.brand_id ||
    project.brandId ||
    project.agency_id ||
    project.agencyId ||
    project.profile_id ||
    project.profileId ||
    project.client_name ||
    project.clientName ||
    project.id
  );
}

export function isSubscriptionProject(project) {
  return String(project?.billing_model || '').toLowerCase() === 'subscription';
}

function isSubscriptionLikeProject(project) {
  const billingModel = String(project?.billingModel || project?.billing_model || 'project').toLowerCase();
  const monthlyBaseRaw = Number(project?.monthly_base_price || project?.monthlyBasePrice || 0);
  const includedRaw = Number(project?.monthly_included_hours || project?.monthlyIncludedHours || 0);
  const extraRateRaw = Number(project?.extra_hour_rate || project?.extraHourRate || 0);
  const hasSubscriptionDates = Boolean(project?.subscription_start_date || project?.subscriptionStartDate);
  return (
    billingModel === 'subscription' ||
    monthlyBaseRaw > 0 ||
    includedRaw > 0 ||
    extraRateRaw > 0 ||
    hasSubscriptionDates
  );
}

export function isProjectActiveInMonth(project, year, month) {
  const { start, end } = getMonthBounds(year, month);
  const startDateRaw = project.subscription_start_date || project.subscriptionStartDate || project.start_date || project.startDate;
  const endDateRaw = project.subscription_end_date || project.subscriptionEndDate || project.end_date || project.endDate;
  const startDate = startDateRaw ? new Date(startDateRaw) : null;
  const endDate = endDateRaw ? new Date(endDateRaw) : null;
  if (startDate && startDate > end) return false;
  if (endDate && endDate < start) return false;
  return true;
}

export function calculateMonthEndInvoiceDraft({ projects, timeEntries, year, month }) {
  const { start, end } = getMonthBounds(year, month);
  const entries = Array.isArray(timeEntries) ? timeEntries : [];
  const rows = Array.isArray(projects) ? projects : [];
  const invoicesByCustomer = new Map();

  const ensureInvoice = (project) => {
    const key = getProjectCustomerKey(project);
    if (!invoicesByCustomer.has(key)) {
      invoicesByCustomer.set(key, {
        customerKey: key,
        customerName: project.client_name || project.clientName || 'Customer',
        subtotal: 0,
        items: [],
      });
    }
    return invoicesByCustomer.get(key);
  };

  for (const project of rows) {
    if (!project || !isProjectActiveInMonth(project, year, month)) continue;
    const model = String(project.billing_model || project.billingModel || 'project').toLowerCase();
    const invoice = ensureInvoice(project);

    if (model === 'subscription' || isSubscriptionLikeProject(project)) {
      const projectEntries = entries.filter((entry) => {
        const projectId = String(entry.project_id || entry.projectId || '');
        const entryDate = new Date(entry.entry_date || entry.entryDate);
        return projectId === String(project.id) && !Number.isNaN(entryDate.getTime()) && entryDate >= start && entryDate <= end;
      });
      const usedHours = projectEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
      const included = Number(project.monthly_included_hours || project.monthlyIncludedHours || 0);
      const basePrice = Number(project.monthly_base_price || project.monthlyBasePrice || 0);
      const extraRate = Number(project.extra_hour_rate || project.extraHourRate || 0);
      const employeeExtraRatePkr = Number(project.employee_extra_hour_rate_pkr || project.employeeExtraHourRatePkr || 0);

      invoice.items.push({
        item_type: 'subscription_base',
        project_id: project.id,
        description: `${project.project_name || project.projectName} - monthly base fee`,
        quantity: 1,
        unit_price: basePrice,
        line_total: basePrice,
        metadata: { includedHours: included, usedHours, employeeExtraRatePkr },
      });
      invoice.subtotal += basePrice;

      invoice.items.push({
        item_type: 'subscription_hours_info',
        project_id: project.id,
        description: `${project.project_name || project.projectName} - hours used (${usedHours.toFixed(2)}h / included ${included.toFixed(2)}h)`,
        quantity: usedHours,
        unit_price: 0,
        line_total: 0,
        metadata: { includedHours: included, usedHours, employeeExtraRatePkr },
      });

      // Match the invoice PDF behavior:
      // extra charge is based on total used hours logged in that month.
      const extraAmount = usedHours * extraRate;
      if (usedHours > 0) {
        invoice.items.push({
          item_type: 'subscription_overage',
          project_id: project.id,
          description: `${project.project_name || project.projectName} - extra hours (${usedHours.toFixed(2)}h)`,
          quantity: usedHours,
          unit_price: extraRate,
          line_total: extraAmount,
          metadata: { includedHours: included, usedHours },
        });
        invoice.subtotal += extraAmount;
      }
      continue;
    }

    if (model === 'hourly') {
      const projectEntries = entries.filter((entry) => {
        const projectId = String(entry.project_id || entry.projectId || '');
        const entryDate = new Date(entry.entry_date || entry.entryDate);
        return projectId === String(project.id) && !Number.isNaN(entryDate.getTime()) && entryDate >= start && entryDate <= end;
      });
      const hours = projectEntries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
      const hourlyRate = Number(project.extra_hour_rate || project.extraHourRate || 0);
      const lineTotal = hours * hourlyRate;
      if (hours > 0) {
        invoice.items.push({
          item_type: 'project_hourly',
          project_id: project.id,
          description: `${project.project_name || project.projectName} - hourly work`,
          quantity: hours,
          unit_price: hourlyRate,
          line_total: lineTotal,
          metadata: {},
        });
        invoice.subtotal += lineTotal;
      }
      continue;
    }

    const fixedAmount = Number(project.amount || 0);
    if (fixedAmount > 0) {
      invoice.items.push({
        item_type: 'project_fixed',
        project_id: project.id,
        description: `${project.project_name || project.projectName} - milestone/fixed work`,
        quantity: 1,
        unit_price: fixedAmount,
        line_total: fixedAmount,
        metadata: {},
      });
      invoice.subtotal += fixedAmount;
    }
  }

  return Array.from(invoicesByCustomer.values()).filter((invoice) => invoice.items.length > 0);
}
