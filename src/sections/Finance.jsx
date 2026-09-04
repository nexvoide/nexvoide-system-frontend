import React, { useMemo } from "react";
import { useAppStore, convert } from "../stores/appStore.js";
import { Wallet, TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, PieChart as PieChartIcon } from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, 
  BarChart, Bar, AreaChart, Area, ComposedChart, Legend, CartesianGrid 
} from "recharts";
import { motion } from "framer-motion";
import { useFilteredProjects, useCanViewFinance, useCanViewFinanceDetails } from "../hooks/useRoleFilter.js";
import { calculateMonthEndInvoiceDraft } from "../utils/subscriptionBilling.js";

export default function Finance() {
  const { rate, currency, timeEntries, activeMonth, invoices } = useAppStore();
  const projects = useFilteredProjects(); // Use filtered projects based on role
  const canViewFinance = useCanViewFinance();
  const canViewFinanceDetails = useCanViewFinanceDetails();

  // If user doesn't have permission to view finance, show access denied
  if (!canViewFinance) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Wallet size={48} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
          <p className="text-slate-500">You don't have permission to view finance data.</p>
        </div>
      </div>
    );
  }

  // Helper to ensure assigned is always an array
  const ensureAssigned = (assigned) => {
    if (Array.isArray(assigned)) return assigned;
    if (typeof assigned === 'string') {
      try {
        const parsed = JSON.parse(assigned);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const normalizeYearMonth = (value) => {
    const raw = String(value || "").trim();
    if (/^\d{4}-\d{2}$/.test(raw)) return raw;
    if (/^\d{4}-\d{1}$/.test(raw)) {
      const [year, month] = raw.split("-");
      return `${year}-${month.padStart(2, "0")}`;
    }
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const getLocalActiveMonth = () => {
    try {
      const raw = localStorage.getItem("nexvoide_settings");
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed?.active_month || "";
    } catch {
      return "";
    }
  };

  // Invoice PDFs use `nexvoide_settings.active_month`, so Finance must use the same value
  const effectiveActiveMonth = normalizeYearMonth(getLocalActiveMonth() || activeMonth);

  const getInvoiceMonthTotalIn = (cur) => {
    const selectedMonth = effectiveActiveMonth;
    if (!selectedMonth) return 0;
    return (Array.isArray(invoices) ? invoices : []).reduce((sum, invoice) => {
      const periodYear = Number(invoice.periodYear || invoice.period_year || 0);
      const periodMonth = Number(invoice.periodMonth || invoice.period_month || 0);
      if (!periodYear || !periodMonth) return sum;
      const invoiceMonth = `${periodYear}-${String(periodMonth).padStart(2, "0")}`;
      if (invoiceMonth !== selectedMonth) return sum;

      // Prefer summing invoice_items.line_total because some invoices may have
      // stale header totals (total/subtotal) while items are correct.
      const items =
        invoice.invoiceItems ||
        invoice.invoice_items ||
        invoice.items ||
        [];

      const itemsTotal = Array.isArray(items)
        ? items.reduce((acc, item) => {
            const v =
              Number(item.lineTotal ?? item.line_total ?? item.line_total_usd ?? item.unitPrice ?? item.unit_price ?? 0);
            return acc + (Number.isFinite(v) ? v : 0);
          }, 0)
        : 0;

      const invoiceHeaderTotal = Number(invoice.total ?? invoice.subtotal ?? 0);
      const invoiceTotal = itemsTotal > 0 ? itemsTotal : invoiceHeaderTotal;
      const invoiceCurrency = invoice.currency || "USD";
      return sum + convert(invoiceTotal, invoiceCurrency, cur, rate);
    }, 0);
  };

  const getDraftMonthTotalIn = (cur) => {
    const selectedMonth = effectiveActiveMonth;
    if (!selectedMonth) return 0;
    const [yearStr, monthStr] = selectedMonth.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return 0;
    const drafts = calculateMonthEndInvoiceDraft({
      projects,
      timeEntries,
      year,
      month,
    });
    return (Array.isArray(drafts) ? drafts : []).reduce((sum, draft) => {
      const subtotal = Number(draft?.subtotal || 0);
      return sum + convert(subtotal, "USD", cur, rate);
    }, 0);
  };

  const getMonthGrossRevenueIn = (cur) => {
    // Prefer saved invoices (invoice_items) because that's what you actually bill.
    // Fall back to draft-only calculation when there are no invoices yet.
    const invoiceMonthTotal = getInvoiceMonthTotalIn(cur);
    if (invoiceMonthTotal > 0) return invoiceMonthTotal;
    return getDraftMonthTotalIn(cur);
  };

  const getProjectEntriesForMonth = (projectId, monthKey) =>
    (Array.isArray(timeEntries) ? timeEntries : []).filter((entry) => {
      const entryProjectId = String(entry.projectId || entry.project_id || "");
      if (entryProjectId !== String(projectId)) return false;
      const normalizedMonth = normalizeYearMonth(monthKey);
      if (!normalizedMonth) return true;
      const d = new Date(entry.entryDate || entry.entry_date || "");
      if (Number.isNaN(d.getTime())) return false;
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      return ym === normalizedMonth;
    });

  const isSubscriptionLikeProject = (p) => {
    const billingModel = String(p?.billingModel || p?.billing_model || "project").toLowerCase();
    const monthlyBaseRaw = Number(p?.monthlyBasePrice || p?.monthly_base_price || 0);
    const includedRaw = Number(p?.monthlyIncludedHours || p?.monthly_included_hours || 0);
    const customerExtraRateRaw = Number(p?.extraHourRate || p?.extra_hour_rate || 0);
    return (
      billingModel === "subscription" ||
      monthlyBaseRaw > 0 ||
      includedRaw > 0 ||
      customerExtraRateRaw > 0 ||
      Number(p?.subscriptionStartDate || p?.subscription_start_date ? 1 : 0) > 0
    );
  };

  const getProjectFinancials = (p, cur, monthKey = effectiveActiveMonth) => {
    const billingModel = String(p.billingModel || p.billing_model || "project").toLowerCase();
    const monthlyBaseRaw = Number(p.monthlyBasePrice || p.monthly_base_price || 0);
    const includedRaw = Number(p.monthlyIncludedHours || p.monthly_included_hours || 0);
    const customerExtraRateRaw = Number(p.extraHourRate || p.extra_hour_rate || 0);
    const isSubscriptionLike =
      billingModel === "subscription" ||
      monthlyBaseRaw > 0 ||
      includedRaw > 0 ||
      Number(p.subscriptionStartDate || p.subscription_start_date ? 1 : 0) > 0;
    if (isSubscriptionLike) {
      const monthlyBase = Number(p.monthlyBasePrice || p.monthly_base_price || p.amount || 0);
      const customerExtraRate = Number(p.extraHourRate || p.extra_hour_rate || 0);
      const employeeBasePayoutPkr = Number(p.employeeMonthlyBasePayoutPkr || p.employee_monthly_base_payout_pkr || 0);
      const employeeExtraRatePkr = Number(p.employeeExtraHourRatePkr || p.employee_extra_hour_rate_pkr || 0);
      const entries = getProjectEntriesForMonth(p.id, monthKey);
      const included = Number(p.monthlyIncludedHours || p.monthly_included_hours || 0);
      const usedHours = entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
      // Invoice PDF charges customer based on total used hours (not (used - included)).
      const extraHours = usedHours;
      const order = convert(monthlyBase + (extraHours * customerExtraRate), p.currency || "USD", cur, rate);
      const emp = convert(employeeBasePayoutPkr + (extraHours * employeeExtraRatePkr), "PKR", cur, rate);
      return { order, emp };
    }
    if (billingModel === "hourly") {
      const hourlyRate = Number(p.extraHourRate || p.extra_hour_rate || 0);
      const entries = getProjectEntriesForMonth(p.id, monthKey);
      const usedHours = entries.reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
      const order = convert(usedHours * hourlyRate, p.currency || "USD", cur, rate);
      return { order, emp: 0 };
    }
    const order = convert(p.amount || 0, p.currency, cur, rate);
    const assignedArray = ensureAssigned(p.assigned);
    let emp = 0;
    for (const a of assignedArray) {
      if (a.costType === 'percentage') emp += order * (Number(a.costValue) || 0) / 100;
      else emp += convert(a.costValue || 0, 'PKR', cur, rate);
    }
    return { order, emp };
  };

  // Selected currency snapshot for charts and breakdown
  const selectedStats = useMemo(() => {
    let totalRevenue = 0, totalExpenses = 0, completedRevenue = 0, pendingRevenue = 0, inProgressRevenue = 0, cancelledRevenue = 0, revisionRevenue = 0;
    for (const p of projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      const { order, emp } = getProjectFinancials(p, currency);
      const netValue = order - emp; // Net value after team payout
      const activeDisplayValue = isSubscriptionLikeProject(p) ? order : netValue;
      totalRevenue += order; totalExpenses += emp;
      if (p.status === 'Completed') completedRevenue += order;
      if (p.status === 'Pending') pendingRevenue += order;
      // For subscription projects, don't deduct employee payout until completed.
      if (p.status === 'In Progress') inProgressRevenue += activeDisplayValue;
      // Handle both "Cancel" and "Cancelled" status
      if (p.status === 'Cancelled' || p.status === 'Cancel') cancelledRevenue += order;
      if (p.status === 'Revision' || p.status === 'Revising') revisionRevenue += activeDisplayValue;
    }
    // Use invoice totals (preferred) or draft totals as the source of truth for gross revenue.
    const monthGrossRevenue = getMonthGrossRevenueIn(currency);
    if (monthGrossRevenue > 0) {
      totalRevenue = monthGrossRevenue;
      // Keep completedRevenue at least equal to billed revenue for month-level KPI consistency.
      completedRevenue = Math.max(completedRevenue, monthGrossRevenue);
    }
    const netProfit = totalRevenue - totalExpenses;
    return { totalRevenue, totalExpenses, netProfit, completedRevenue, pendingRevenue, inProgressRevenue, cancelledRevenue, revisionRevenue };
  }, [projects, currency, rate, timeEntries, activeMonth, invoices, effectiveActiveMonth]);

  const fmt = (n, cur) => new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
  function computeIn(cur){
    // sum across projects converted to cur
    let totalRevenue = 0, totalExpenses = 0, completedRevenue=0, pendingRevenue=0, inProgressRevenue=0, cancelledRevenue=0, revisionRevenue=0;
    let employeeCompleted = 0; // team payouts only on completed
    for (const p of projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      const { order, emp } = getProjectFinancials(p, cur);
      const netValue = order - emp; // Net value after team payout
      const activeDisplayValue = isSubscriptionLikeProject(p) ? order : netValue;
      totalRevenue += order; totalExpenses += emp;
      if (p.status==='Completed') { completedRevenue += order; employeeCompleted += emp; }
      if (p.status==='Pending') pendingRevenue += order;
      if (p.status==='In Progress') inProgressRevenue += activeDisplayValue;
      // Handle both "Cancel" and "Cancelled" status
      if (p.status==='Cancelled' || p.status==='Cancel') cancelledRevenue += order;
      if (p.status==='Revision' || p.status==='Revising') revisionRevenue += activeDisplayValue;
    }
    const monthGrossRevenue = getMonthGrossRevenueIn(cur);
    if (monthGrossRevenue > 0) {
      totalRevenue = monthGrossRevenue;
      completedRevenue = Math.max(completedRevenue, monthGrossRevenue);
    }
    // Profit is only from completed orders
    const netProfit = completedRevenue - employeeCompleted;
    return { totalRevenue, totalExpenses, netProfit, completedRevenue, pendingRevenue, inProgressRevenue, cancelledRevenue, revisionRevenue };
  }
  // current currency values (for top KPI cards)
  const statsCur = computeIn(currency);

  // Monthly revenue data (last 6 months from actual projects)
  const monthlyData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      let revenue = 0, expenses = 0, profit = 0;
      for (const p of projects) {
        // Skip archived projects (they're in archived_projects table, not active projects)
        if (p.archived === true) continue;
        
        const projectDate = p.endDate || p.startDate || p.deadline;
        if (projectDate) {
          const projMonth = projectDate.substring(0, 7); // YYYY-MM
          if (projMonth === monthKey) {
            const { order, emp } = getProjectFinancials(p, currency, monthKey);
            revenue += order;
            expenses += emp;
            profit += order - emp;
          }
        }
      }
      months.push({ name: monthName, revenue, expenses, profit });
    }
    return months;
  }, [projects, currency, rate, timeEntries, activeMonth, effectiveActiveMonth]);

  // Revenue by platform
  const platformData = useMemo(() => {
    const platforms = { Fiverr: 0, Upwork: 0, Direct: 0, Agency: 0 };
    for (const p of projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      const platform = p.platform || 'Direct';
      if (platforms.hasOwnProperty(platform)) {
        const { order } = getProjectFinancials(p, currency);
        platforms[platform] += order;
      }
    }
    return Object.entries(platforms)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [projects, currency, rate, timeEntries, activeMonth, effectiveActiveMonth]);

  // Top performing clients (by revenue)
  const topClients = useMemo(() => {
    const clientMap = new Map();
    for (const p of projects) {
      const clientName = p.clientName || 'Unknown';
      const { order } = getProjectFinancials(p, currency);
      const existing = clientMap.get(clientName) || 0;
      clientMap.set(clientName, existing + order);
    }
    return Array.from(clientMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [projects, currency, rate, timeEntries, activeMonth, effectiveActiveMonth]);

  // Revenue vs Expenses comparison (last 6 months)
  const revenueExpensesData = useMemo(() => {
    return monthlyData.map(month => ({
      name: month.name,
      Revenue: month.revenue,
      Expenses: month.expenses,
      Profit: month.profit
    }));
  }, [monthlyData]);

  // Profit margin trend
  const profitMarginData = useMemo(() => {
    return monthlyData.map(month => ({
      name: month.name,
      margin: month.revenue > 0 ? ((month.profit / month.revenue) * 100) : 0
    }));
  }, [monthlyData]);

  const statusBreakdown = [
    { name: 'Completed', value: selectedStats.completedRevenue, color: '#22c55e' },
    { name: 'In Progress', value: selectedStats.inProgressRevenue, color: '#3b82f6' },
    { name: 'Revision', value: selectedStats.revisionRevenue, color: '#eab308' },
    { name: 'Cancelled', value: selectedStats.cancelledRevenue, color: '#ef4444' },
  ];

  // Custom tooltip formatter
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-800 dark:bg-slate-900 border border-slate-700 rounded-lg p-3 shadow-xl">
          <p className="text-slate-300 text-sm font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {fmt(entry.value, currency)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="grid gap-3">
      <div className="glass rounded-2xl h-11 px-3 flex items-center">
        <div className="text-sm font-semibold">Finance Overview</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
        {[
          { key: 'revenue', label: 'Gross Revenue', value: statsCur.totalRevenue, icon: DollarSign, color: '', showDetails: true },
          { key: 'payouts', label: 'Team Payouts', value: statsCur.totalExpenses, icon: Wallet, color: 'text-blue-400', showDetails: canViewFinanceDetails },
          { key: 'netprofit', label: 'Net Profit', value: statsCur.netProfit, icon: TrendingUp, color: 'text-green-400', showDetails: canViewFinanceDetails },
          { key: 'active', label: 'Active Projects Value (Net)', value: selectedStats.inProgressRevenue, icon: TrendingUp, color: '', showDetails: canViewFinanceDetails },
          { key: 'inrev', label: 'Revision Revenue (Net)', value: selectedStats.revisionRevenue, icon: TrendingUp, color: '', showDetails: canViewFinanceDetails },
          { key: 'cancelled', label: 'Cancelled Revenue', value: selectedStats.cancelledRevenue, icon: TrendingDown, color: 'text-red-400', showDetails: true },
        ].filter(k => k.showDetails).map((k, i) => (
          <div key={k.key} className="card">
            <div className="flex items-center gap-2 mb-1">
              {k.icon ? <k.icon size={18} className={k.key==='netprofit' ? 'text-green-400' : k.key==='payouts' ? 'text-blue-400' : k.key==='cancelled' ? 'text-red-400' : 'text-slate-400'} /> : null}
              <div className="text-xs text-slate-500">{k.label}</div>
            </div>
            <div className={`text-xl md:text-2xl font-bold ${k.color}`}>{fmt(k.value, currency)}</div>
          </div>
        ))}
      </div>

      {/* Advanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 mt-3">
        {/* Monthly Revenue vs Expenses */}
        <motion.div 
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Activity className="text-blue-500" size={18} />
            <div className="text-sm font-semibold">Revenue vs Expenses</div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={revenueExpensesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="Profit" stroke="#22c55e" strokeWidth={3} dot={{ fill: '#22c55e', r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Revenue by Platform */}
        <motion.div 
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="text-purple-500" size={18} />
            <div className="text-sm font-semibold">Revenue by Platform</div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={platformData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Second Row of Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Monthly Profit Trend */}
        <motion.div 
          className="card lg:col-span-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-green-500" size={18} />
            <div className="text-sm font-semibold">Monthly Profit Trend</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="profit" stroke="#22c55e" strokeWidth={2} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Project Status Breakdown */}
        <motion.div 
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="text-orange-500" size={18} />
            <div className="text-sm font-semibold">Status Breakdown</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  dataKey="value" 
                  data={statusBreakdown} 
                  innerRadius={60} 
                  outerRadius={90} 
                  paddingAngle={5}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {statusBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Third Row: Profit Margin & Top Clients */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Profit Margin Trend */}
        <motion.div 
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-cyan-500" size={18} />
            <div className="text-sm font-semibold">Profit Margin %</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={profitMarginData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} unit="%" />
                <Tooltip 
                  formatter={(value) => [`${value.toFixed(1)}%`, 'Margin']}
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="margin" 
                  stroke="#06b6d4" 
                  strokeWidth={3} 
                  dot={{ fill: '#06b6d4', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Top Performing Clients */}
        <motion.div 
          className="card"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="text-yellow-500" size={18} />
            <div className="text-sm font-semibold">Top 5 Clients by Revenue</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topClients} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#94a3b8" fontSize={12} />
                <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} width={100} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#eab308" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

