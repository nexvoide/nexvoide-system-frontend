import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Download, Filter, Search, TrendingUp, TrendingDown, 
  DollarSign, FileText, BarChart3, Eye, ChevronDown, ChevronUp, X, Trash2
} from 'lucide-react';
import { getArchivedMonths, getArchivedProjects, getFinanceSnapshot, deleteArchivedMonth } from '../utils/monthlyClosing.js';
  import { useAppStore, convert } from "../stores/appStore.js";
import { hasRole } from '../utils/permissions.js';
import { ROLES } from '../utils/permissions.js';

export default function MonthlyArchives() {
  const { user, currency, rate, profiles, agencies, brands } = useAppStore();
  const [archivedMonths, setArchivedMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthProjects, setMonthProjects] = useState([]);
  const [financeSnapshot, setFinanceSnapshot] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState(null);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const isAdmin = hasRole(user?.role, ROLES.ADMIN);

  useEffect(() => {
    if (isAdmin) {
      loadArchivedMonths();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (selectedMonth) {
      loadMonthDetails(selectedMonth.id);
    }
  }, [selectedMonth]);

  const loadArchivedMonths = async () => {
    setLoading(true);
    try {
      const months = await getArchivedMonths();
      setArchivedMonths(months);
    } catch (error) {
      console.error('Error loading archived months:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonthDetails = async (monthId) => {
    try {
      const [projects, snapshot] = await Promise.all([
        getArchivedProjects(monthId),
        getFinanceSnapshot(monthId)
      ]);
      setMonthProjects(projects);
      setFinanceSnapshot(snapshot);
    } catch (error) {
      console.error('Error loading month details:', error);
    }
  };

  const filteredMonths = useMemo(() => {
    let filtered = archivedMonths;
    
    if (filterYear) {
      filtered = filtered.filter(m => m.year === filterYear);
    }
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(m => 
        m.month_label?.toLowerCase().includes(query) ||
        m.year?.toString().includes(query)
      );
    }
    
    return filtered;
  }, [archivedMonths, searchQuery, filterYear]);

  const availableYears = useMemo(() => {
    const years = new Set(archivedMonths.map(m => m.year));
    return Array.from(years).sort((a, b) => b - a);
  }, [archivedMonths]);

  const exportMonthData = (month) => {
    const data = {
      month: month.month_label,
      year: month.year,
      month_number: month.month,
      closed_at: month.closed_at,
      financial_summary: {
        total_revenue: month.total_revenue,
        total_expenses: month.total_expenses,
        net_profit: month.net_profit,
        completed_revenue: month.completed_revenue,
        in_progress_revenue: month.in_progress_revenue,
        cancelled_revenue: month.cancelled_revenue,
        revision_revenue: month.revision_revenue
      },
      project_statistics: {
        total_projects: month.total_projects,
        completed_projects: month.completed_projects,
        in_progress_projects: month.in_progress_projects,
        cancelled_projects: month.cancelled_projects,
        revision_projects: month.revision_projects
      },
      team_statistics: {
        total_team_cost: month.total_team_cost,
        active_employees: month.active_employees,
        total_billing_hours: month.total_billing_hours
      }
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${month.month_label.replace(/\s+/g, '_')}_archive.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n) => new Intl.NumberFormat('en', { 
    style: 'currency', 
    currency: currency, 
    maximumFractionDigits: 2 
  }).format(n);

  const handleDeleteMonth = async (month) => {
    const ok = window.confirm(
      `Delete archive for ${month.month_label} permanently?\n\nThis removes archive snapshots.\nProjects will remain in their current state.`
    );
    if (!ok) return;

    setActionLoadingId(month.id);
    try {
      await deleteArchivedMonth(month.id);
      alert(`Deleted archive month: ${month.month_label}`);

      if (selectedMonth?.id === month.id) {
        setSelectedMonth(null);
        setMonthProjects([]);
        setFinanceSnapshot(null);
      }
      if (expandedMonth === month.id) {
        setExpandedMonth(null);
      }

      await loadArchivedMonths();
    } catch (error) {
      console.error('Delete archived month failed:', error);
      alert(`Failed to delete archive month: ${error.message || 'Please try again.'}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Calendar size={48} className="mx-auto mb-4 text-slate-400" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Access Denied</h2>
          <p className="text-slate-500">Only administrators can view monthly archives.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading archived months...</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {/* Header */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Monthly Archives</h1>
            <p className="text-sm text-slate-400 mt-1">
              View and analyze archived monthly data
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search months..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base md:text-sm"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400 flex-shrink-0" />
            <select
              value={filterYear || ''}
              onChange={(e) => setFilterYear(e.target.value ? parseInt(e.target.value) : null)}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-slate-800/50 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-base md:text-sm"
            >
              <option value="">All Years</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Archived Months List */}
      <div className="grid gap-3">
        {filteredMonths.length === 0 ? (
          <div className="glass rounded-2xl p-12 text-center">
            <Calendar size={48} className="mx-auto mb-4 text-slate-400" />
            <div className="text-slate-400">
              {archivedMonths.length === 0 
                ? 'No months have been closed yet.'
                : 'No months match your search criteria.'}
            </div>
          </div>
        ) : (
          filteredMonths.map((month) => {
            const isExpanded = expandedMonth === month.id;
            
            return (
              <motion.div
                key={month.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass rounded-2xl p-4"
              >
                {/* Month Header */}
                <div 
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedMonth(isExpanded ? null : month.id)}
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 rounded-xl bg-blue-500/20">
                      <Calendar size={20} className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-white text-base md:text-lg">
                        {month.month_label}
                      </div>
                      <div className="text-xs md:text-sm text-slate-400 mt-1">
                        Closed on {new Date(month.closed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Quick Stats */}
                    <div className="text-right hidden md:block">
                      <div className="text-sm text-slate-400">Net Profit</div>
                      <div className={`font-semibold ${
                        month.net_profit >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {fmt(convert(month.net_profit || 0, month.base_currency || 'USD', currency, month.exchange_rate || rate))}
                      </div>
                    </div>
                    <div className="text-right hidden md:block">
                      <div className="text-sm text-slate-400">Projects</div>
                      <div className="font-semibold text-white">
                        {month.completed_projects} / {month.total_projects}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exportMonthData(month);
                      }}
                      className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
                      title="Export data"
                    >
                      <Download size={18} className="text-slate-400" />
                    </button>
                    {isExpanded ? (
                      <ChevronUp size={20} className="text-slate-400" />
                    ) : (
                      <ChevronDown size={20} className="text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="mt-4 pt-4 border-t border-slate-700"
                  >
                    <div className="grid md:grid-cols-2 gap-4">
                      {/* Financial Summary */}
                      <div className="p-4 rounded-xl bg-slate-800/50">
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <DollarSign size={18} className="text-green-400" />
                          Financial Summary
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Revenue:</span>
                            <span className="text-white font-semibold">
                              {fmt(convert(month.total_revenue || 0, month.base_currency || 'USD', currency, month.exchange_rate || rate))}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Expenses:</span>
                            <span className="text-white font-semibold">
                              {fmt(convert(month.total_expenses || 0, month.base_currency || 'USD', currency, month.exchange_rate || rate))}
                            </span>
                          </div>
                          <div className="flex justify-between pt-2 border-t border-slate-700">
                            <span className="text-slate-400">Net Profit:</span>
                            <span className={`font-semibold ${
                              month.net_profit >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {fmt(convert(month.net_profit || 0, month.base_currency || 'USD', currency, month.exchange_rate || rate))}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Project Statistics */}
                      <div className="p-4 rounded-xl bg-slate-800/50">
                        <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
                          <FileText size={18} className="text-blue-400" />
                          Project Statistics
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Projects:</span>
                            <span className="text-white font-semibold">{month.total_projects}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Completed:</span>
                            <span className="text-green-400 font-semibold">{month.completed_projects}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">In Progress:</span>
                            <span className="text-yellow-400 font-semibold">{month.in_progress_projects}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cancelled:</span>
                            <span className="text-red-400 font-semibold">{month.cancelled_projects}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* View Details Button */}
                    <div className="mt-4">
                      <div className="grid sm:grid-cols-3 gap-2">
                        <button
                          onClick={() => setSelectedMonth(month)}
                          className="px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          <Eye size={18} />
                          View Details
                        </button>
                        <button
                          onClick={() => handleDeleteMonth(month)}
                          disabled={actionLoadingId === month.id}
                          className="px-4 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 sm:col-span-2"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Month Details Modal */}
      {selectedMonth && (
        <MonthDetailsModal
          month={selectedMonth}
          projects={monthProjects}
          financeSnapshot={financeSnapshot}
          profiles={profiles || []}
          agencies={agencies || []}
          brands={brands || []}
          onClose={() => {
            setSelectedMonth(null);
            setMonthProjects([]);
            setFinanceSnapshot(null);
          }}
        />
      )}
    </div>
  );
}

// Month Details Modal Component
function MonthDetailsModal({ month, projects, financeSnapshot, profiles = [], agencies = [], brands = [], onClose }) {
  const { currency, rate } = useAppStore();

  const fmt = (n) => new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency,
    maximumFractionDigits: 2
  }).format(n);

  const ensureAssigned = (assigned) => {
    if (Array.isArray(assigned)) return assigned;
    if (typeof assigned === 'string') {
      try {
        const a = JSON.parse(assigned);
        return Array.isArray(a) ? a : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const normalizePlatform = (platform) => String(platform || '').trim().toLowerCase();

  // Compute breakdowns from archived projects
  const { employeeSalaries, byProfile, byAgency, byBrand, totalRevenue, totalExpenses, netProfit } = useMemo(() => {
    const empMap = {};
    const profileMap = {};
    const agencyMap = {};
    const brandMap = {};
    let rev = 0;
    let exp = 0;

    for (const p of projects) {
      const amount = Number(p.amount) || 0;
      const pCurrency = p.currency || 'USD';
      const orderDisplay = convert(amount, pCurrency, currency, rate);
      rev += orderDisplay;

      const assigned = ensureAssigned(p.assigned);
      const costType = a => a.costType ?? a.cost_type ?? 'fixed';
      const costValue = a => Number(a.costValue ?? a.cost_value ?? 0) || 0;
      for (const a of assigned) {
        const name = a.name || a.employee_name || 'Unknown';
        if (!empMap[name]) empMap[name] = 0;
        const type = costType(a);
        const val = costValue(a);
        if (type === 'percentage') {
          const cost = orderDisplay * val / 100;
          empMap[name] += cost;
          exp += cost;
        } else {
          const cost = convert(val, 'PKR', currency, rate);
          empMap[name] += cost;
          exp += cost;
        }
      }

      const platform = normalizePlatform(p.platform);
      const profileId = p.profile_id ?? p.profileId ?? '';
      const agencyId = p.agency_id ?? p.agencyId ?? '';
      const brandId = p.brand_id ?? p.brandId ?? '';
      const clientName = p.client_name || p.clientName || '';

      const isFreelance = platform === 'fiverr' || platform === 'upwork';
      const isAgency = platform === 'agency';
      const isDirect = platform === 'direct';

      // Freelance: Fiverr/Upwork projects only.
      if (isFreelance || (!platform && profileId)) {
        const pKey = String(profileId || `${platform || 'freelance'}-${clientName || 'unknown'}`);
        if (!profileMap[pKey]) {
          profileMap[pKey] = { id: profileId || null, name: clientName || '', revenue: 0, count: 0 };
        }
        profileMap[pKey].revenue += orderDisplay;
        profileMap[pKey].count += 1;
      }

      // Agency: platform=Agency only.
      if (isAgency || (!platform && agencyId)) {
        const aKey = String(agencyId || `agency-${clientName || 'unknown'}`);
        if (!agencyMap[aKey]) {
          agencyMap[aKey] = { id: agencyId || null, name: clientName || '', revenue: 0, count: 0 };
        }
        agencyMap[aKey].revenue += orderDisplay;
        agencyMap[aKey].count += 1;
      }

      // Direct: platform=Direct only.
      if (isDirect || (!platform && brandId)) {
        const bKey = String(brandId || `direct-${clientName || 'unknown'}`);
        if (!brandMap[bKey]) {
          brandMap[bKey] = { id: brandId || null, name: clientName || '', revenue: 0, count: 0 };
        }
        brandMap[bKey].revenue += orderDisplay;
        brandMap[bKey].count += 1;
      }
    }

    // Resolve names from store
    const byProfileList = Object.entries(profileMap).map(([k, v]) => {
      const name = v.id ? (profiles.find(pr => String(pr.id) === String(v.id))?.name || v.name || `Profile #${v.id}`) : (v.name || 'Unknown Freelance');
      return { ...v, name };
    }).filter(r => r.count > 0).sort((a, b) => b.revenue - a.revenue);

    const byAgencyList = Object.entries(agencyMap).map(([k, v]) => {
      const name = v.id ? (agencies.find(ag => String(ag.id) === String(v.id))?.name || v.name || `Agency #${v.id}`) : (v.name || 'Unknown Agency');
      return { ...v, name };
    }).filter(r => r.count > 0).sort((a, b) => b.revenue - a.revenue);

    const byBrandList = Object.entries(brandMap).map(([k, v]) => {
      const name = v.id ? (brands.find(br => String(br.id) === String(v.id))?.name || v.name || `Brand #${v.id}`) : (v.name || 'Unknown Direct Client');
      return { ...v, name };
    }).filter(r => r.count > 0).sort((a, b) => b.revenue - a.revenue);

    const employeeSalaries = Object.entries(empMap).map(([name, cost]) => ({ name, cost })).sort((a, b) => b.cost - a.cost);

    return {
      employeeSalaries,
      byProfile: byProfileList,
      byAgency: byAgencyList,
      byBrand: byBrandList,
      totalRevenue: rev,
      totalExpenses: exp,
      netProfit: rev - exp
    };
  }, [projects, currency, rate, profiles, agencies, brands]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative glass rounded-none sm:rounded-2xl p-4 sm:p-6 max-w-4xl w-full min-h-full sm:min-h-0 max-h-full sm:max-h-[90vh] overflow-hidden flex flex-col my-0 sm:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-6 flex-shrink-0 sticky top-0 bg-transparent z-10 pb-2">
          <div className="flex-1 min-w-0 pr-2">
            <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white">{month.month_label}</h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Detailed archive: projects, salaries, and business by profile, agency & brand
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-5">
          {/* Financial Summary */}
          <div className="p-4 rounded-xl bg-slate-800/50">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <DollarSign size={18} className="text-green-400" />
              Financial Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-slate-400">Total Revenue</div>
                <div className="font-semibold text-white">{fmt(totalRevenue)}</div>
              </div>
              <div>
                <div className="text-slate-400">Total Expenses (Salaries)</div>
                <div className="font-semibold text-white">{fmt(totalExpenses)}</div>
              </div>
              <div>
                <div className="text-slate-400">Net Profit</div>
                <div className={`font-semibold ${netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(netProfit)}</div>
              </div>
              <div>
                <div className="text-slate-400">Projects</div>
                <div className="font-semibold text-white">{projects.length}</div>
              </div>
            </div>
          </div>

          {/* Employee Salaries */}
          <div>
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <BarChart3 size={18} className="text-amber-400" />
              Employee Salaries (this month)
            </h3>
            <div className="rounded-xl bg-slate-800/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-3 text-slate-400 font-medium">Employee</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Salary</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeSalaries.length === 0 ? (
                    <tr><td colSpan={2} className="p-3 text-slate-500">No assigned costs</td></tr>
                  ) : (
                    employeeSalaries.map(({ name, cost }) => (
                      <tr key={name} className="border-b border-slate-700/50">
                        <td className="p-3 text-white">{name}</td>
                        <td className="p-3 text-right font-medium text-white">{fmt(cost)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Freelance Profile */}
          <div>
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp size={18} className="text-orange-400" />
              Business by Freelance Profile
            </h3>
            <div className="rounded-xl bg-slate-800/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-3 text-slate-400 font-medium">Profile</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Projects</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byProfile.length === 0 ? (
                    <tr><td colSpan={3} className="p-3 text-slate-500">No profile breakdown</td></tr>
                  ) : (
                    byProfile.map((r) => (
                      <tr key={r.id ?? r.name} className="border-b border-slate-700/50">
                        <td className="p-3 text-white">{r.name}</td>
                        <td className="p-3 text-right text-slate-300">{r.count}</td>
                        <td className="p-3 text-right font-medium text-white">{fmt(r.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Agency */}
          <div>
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <FileText size={18} className="text-blue-400" />
              Business by Agency
            </h3>
            <div className="rounded-xl bg-slate-800/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-3 text-slate-400 font-medium">Agency</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Projects</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byAgency.length === 0 ? (
                    <tr><td colSpan={3} className="p-3 text-slate-500">No agency breakdown</td></tr>
                  ) : (
                    byAgency.map((r) => (
                      <tr key={r.id} className="border-b border-slate-700/50">
                        <td className="p-3 text-white">{r.name}</td>
                        <td className="p-3 text-right text-slate-300">{r.count}</td>
                        <td className="p-3 text-right font-medium text-white">{fmt(r.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* By Brand */}
          <div>
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <FileText size={18} className="text-purple-400" />
              Business by Brand
            </h3>
            <div className="rounded-xl bg-slate-800/50 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left p-3 text-slate-400 font-medium">Brand</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Projects</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {byBrand.length === 0 ? (
                    <tr><td colSpan={3} className="p-3 text-slate-500">No brand breakdown</td></tr>
                  ) : (
                    byBrand.map((r) => (
                      <tr key={r.id} className="border-b border-slate-700/50">
                        <td className="p-3 text-white">{r.name}</td>
                        <td className="p-3 text-right text-slate-300">{r.count}</td>
                        <td className="p-3 text-right font-medium text-white">{fmt(r.revenue)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Archived Projects List */}
          <div>
            <h3 className="font-semibold text-white mb-3">Archived Projects ({projects.length})</h3>
            <div className="space-y-2">
              {projects.map(project => {
                const projectAmount = convert(project.amount || 0, project.currency || 'USD', currency, rate);
                const assignedMembers = ensureAssigned(project.assigned);
                const assignedWithCosts = assignedMembers.map((a) => {
                  const name = a.name || a.employee_name || 'Unknown';
                  const type = a.costType ?? a.cost_type ?? 'fixed';
                  const rawValue = Number(a.costValue ?? a.cost_value ?? 0) || 0;
                  const cost = type === 'percentage'
                    ? (projectAmount * rawValue) / 100
                    : convert(rawValue, 'PKR', currency, rate);
                  return { name, type, rawValue, cost };
                });
                const computedTeamCost = assignedWithCosts.reduce((sum, a) => sum + a.cost, 0);
                const teamCost = computedTeamCost || convert(Number(project.team_cost) || 0, project.currency || 'USD', currency, rate);
                const profit = projectAmount - teamCost;
                return (
                  <div key={project.id} className="p-3 rounded-xl bg-slate-800/50">
                    <div className="font-semibold text-white">{project.project_name}</div>
                    <div className="text-sm text-slate-400 mt-1">
                      {project.client_name} • {project.platform} • {fmt(projectAmount)}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0">
                      <span>Service: {project.service || 'N/A'}</span>
                      <span>Status: {project.status || 'Completed'}</span>
                      <span>Employee Count: {assignedWithCosts.length}</span>
                      <span>Team cost: {fmt(teamCost)}</span>
                      <span>Profit: {fmt(profit)}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-0">
                      <span>Start: {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'}</span>
                      <span>End: {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    {assignedWithCosts.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-700/60">
                        <div className="text-xs text-slate-400 mb-1">Assigned Employees</div>
                        <div className="space-y-1">
                          {assignedWithCosts.map((employee, idx) => (
                            <div key={`${project.id}-${employee.name}-${idx}`} className="text-xs text-slate-300 flex flex-wrap items-center gap-x-2">
                              <span className="font-medium text-slate-200">{employee.name}</span>
                              <span>({employee.type === 'percentage' ? `${employee.rawValue}%` : `${employee.rawValue} PKR`})</span>
                              <span>-</span>
                              <span>Cost: {fmt(employee.cost)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {!!project.raw_source_link && (
                      <div className="mt-2">
                        <a
                          href={project.raw_source_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-300 underline break-all"
                        >
                          Source Link
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


