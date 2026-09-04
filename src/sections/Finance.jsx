import React, { useMemo } from "react";
import { useAppStore, convert } from "../stores/appStore.js";
import { Wallet, TrendingUp, TrendingDown, DollarSign, BarChart3, Activity, PieChart as PieChartIcon } from "lucide-react";
import { 
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell, 
  BarChart, Bar, AreaChart, Area, ComposedChart, Legend, CartesianGrid 
} from "recharts";
import { motion } from "framer-motion";
import { useFilteredProjects, useCanViewFinance, useCanViewFinanceDetails } from "../hooks/useRoleFilter.js";

export default function Finance() {
  const { rate, currency } = useAppStore();
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

  // Selected currency snapshot for charts and breakdown
  const selectedStats = useMemo(() => {
    let totalRevenue = 0, totalExpenses = 0, completedRevenue = 0, pendingRevenue = 0, inProgressRevenue = 0, cancelledRevenue = 0, revisionRevenue = 0;
    for (const p of projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      const order = convert(p.amount || 0, p.currency, currency, rate);
      const assignedArray = ensureAssigned(p.assigned);
      let emp = 0;
      for (const a of assignedArray) {
        if (a.costType === 'percentage') emp += order * (Number(a.costValue) || 0) / 100;
        else emp += convert(a.costValue || 0, 'PKR', currency, rate);
      }
      const netValue = order - emp; // Net value after team payout
      totalRevenue += order; totalExpenses += emp;
      if (p.status === 'Completed') completedRevenue += order;
      if (p.status === 'Pending') pendingRevenue += order;
      // Active Projects Value: Show net value (after team payout deduction)
      if (p.status === 'In Progress') inProgressRevenue += netValue;
      // Handle both "Cancel" and "Cancelled" status
      if (p.status === 'Cancelled' || p.status === 'Cancel') cancelledRevenue += order;
      // Revision Revenue: Show net value (after team payout deduction)
      if (p.status === 'Revision' || p.status === 'Revising') revisionRevenue += netValue;
    }
    const netProfit = totalRevenue - totalExpenses;
    return { totalRevenue, totalExpenses, netProfit, completedRevenue, pendingRevenue, inProgressRevenue, cancelledRevenue, revisionRevenue };
  }, [projects, currency, rate]);

  const fmt = (n, cur) => new Intl.NumberFormat('en', { style: 'currency', currency: cur, maximumFractionDigits: 2 }).format(n);
  function computeIn(cur){
    // sum across projects converted to cur
    let totalRevenue = 0, totalExpenses = 0, completedRevenue=0, pendingRevenue=0, inProgressRevenue=0, cancelledRevenue=0, revisionRevenue=0;
    let employeeCompleted = 0; // team payouts only on completed
    for (const p of projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      const order = convert(p.amount||0, p.currency, cur, rate);
      const assignedArray = ensureAssigned(p.assigned);
      let emp = 0;
      for (const a of assignedArray) {
        if (a.costType === 'percentage') emp += order*(Number(a.costValue)||0)/100;
        else emp += convert(a.costValue||0, 'PKR', cur, rate);
      }
      const netValue = order - emp; // Net value after team payout
      totalRevenue += order; totalExpenses += emp;
      if (p.status==='Completed') { completedRevenue += order; employeeCompleted += emp; }
      if (p.status==='Pending') pendingRevenue += order;
      // Active Projects Value: Show net value (after team payout deduction)
      if (p.status==='In Progress') inProgressRevenue += netValue;
      // Handle both "Cancel" and "Cancelled" status
      if (p.status==='Cancelled' || p.status==='Cancel') cancelledRevenue += order;
      // Revision Revenue: Show net value (after team payout deduction)
      if (p.status==='Revision' || p.status==='Revising') revisionRevenue += netValue;
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
        
        const order = convert(p.amount || 0, p.currency, currency, rate);
        const paidMonth = String(p.paidAt || p.paid_at || p.createdAt || p.created_at || p.startDate || p.start_date || '').slice(0, 7);
        if (paidMonth === monthKey) revenue += order;

        const completedMonth = String(p.completedAt || p.completed_at || p.updatedAt || p.updated_at || '').slice(0, 7);
        if (String(p.status || '').trim().toLowerCase() === 'completed' && completedMonth === monthKey) {
          const assignedArray = ensureAssigned(p.assigned);
          for (const a of assignedArray) {
            if (a.costType === 'percentage') expenses += order * (Number(a.costValue) || 0) / 100;
            else expenses += convert(a.costValue || 0, 'PKR', currency, rate);
          }
        }
        profit = revenue - expenses;
      }
      months.push({ name: monthName, revenue, expenses, profit });
    }
    return months;
  }, [projects, currency, rate]);

  // Revenue by platform
  const platformData = useMemo(() => {
    const platforms = { Fiverr: 0, Upwork: 0, Direct: 0, Agency: 0 };
    for (const p of projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      const platform = p.platform || 'Direct';
      if (platforms.hasOwnProperty(platform)) {
        platforms[platform] += convert(p.amount || 0, p.currency, currency, rate);
      }
    }
    return Object.entries(platforms)
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [projects, currency, rate]);

  // Top performing clients (by revenue)
  const topClients = useMemo(() => {
    const clientMap = new Map();
    for (const p of projects) {
      const clientName = p.clientName || 'Unknown';
      const order = convert(p.amount || 0, p.currency, currency, rate);
      const existing = clientMap.get(clientName) || 0;
      clientMap.set(clientName, existing + order);
    }
    return Array.from(clientMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [projects, currency, rate]);

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
