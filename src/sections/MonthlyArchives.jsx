import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, Download, Filter, Search, TrendingUp, TrendingDown, 
  DollarSign, FileText, BarChart3, Eye, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { getArchivedMonths, getArchivedProjects, getFinanceSnapshot } from '../utils/monthlyClosing.js';
  import { useAppStore, convert } from "../stores/appStore.js";
import { hasRole } from '../utils/permissions.js';
import { ROLES } from '../utils/permissions.js';

export default function MonthlyArchives() {
  const { user, currency, rate } = useAppStore();
  const [archivedMonths, setArchivedMonths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [monthProjects, setMonthProjects] = useState([]);
  const [financeSnapshot, setFinanceSnapshot] = useState(null);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterYear, setFilterYear] = useState(null);

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
                      <button
                        onClick={() => setSelectedMonth(month)}
                        className="w-full px-4 py-2 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye size={18} />
                        View Full Details
                      </button>
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
function MonthDetailsModal({ month, projects, financeSnapshot, onClose }) {
  const { currency, rate } = useAppStore();
  
  const fmt = (n) => new Intl.NumberFormat('en', { 
    style: 'currency', 
    currency: currency, 
    maximumFractionDigits: 2 
  }).format(n);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{month.month_label}</h2>
            <p className="text-sm text-slate-400 mt-1">
              Detailed archive information
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Projects List */}
          <div>
            <h3 className="font-semibold text-white mb-3">Archived Projects ({projects.length})</h3>
            <div className="space-y-2">
              {projects.map(project => (
                <div key={project.id} className="p-3 rounded-xl bg-slate-800/50">
                  <div className="font-semibold text-white">{project.project_name}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    {project.client_name} • {project.platform} • {fmt(convert(project.amount || 0, project.currency || 'USD', currency, rate))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}


