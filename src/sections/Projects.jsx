import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Table, LayoutGrid } from "lucide-react";
import { useAppStore, convert } from "../stores/appStore.js";
import ProjectForm from "../widgets/ProjectForm.jsx";
import ProjectCard from "../widgets/ProjectCard.jsx";
import TimeEntryForm from "../widgets/TimeEntryForm.jsx";
import { useFilteredProjects, useCanCreateProjects, useCanEditProjects, useCanDeleteProjects, useCanViewFinanceDetails } from "../hooks/useRoleFilter.js";
import { ROLES, normalizeRoles, hasRole } from "../utils/permissions.js";

export default function Projects() {
  const { currency, rate, loading, user, timeEntries, activeMonth } = useAppStore();
  const projects = useFilteredProjects(); // Use filtered projects based on role
  const canCreate = useCanCreateProjects();
  const canEdit = useCanEditProjects();
  const canDelete = useCanDeleteProjects();
  const canViewFinanceDetails = useCanViewFinanceDetails();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("In Progress");
  const [editing, setEditing] = useState(null);
  const [mode, setMode] = useState("table");

  // Ensure projects is always an array
  const safeProjects = Array.isArray(projects) ? projects : [];
  
  // Debug: Log projects data
  useEffect(() => {
    console.log('🔍 Projects section - projects count:', safeProjects.length);
    if (safeProjects.length > 0) {
      console.log('🔍 First project:', safeProjects[0]);
      console.log('🔍 First project keys:', Object.keys(safeProjects[0]));
    }
  }, [safeProjects]);

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

  // Helper to compute remaining time (ms) until deadline/endDate; overdue => negative
  // Completed projects are never overdue
  const getRemainingMs = (p) => {
    const status = String(p.status || '').toLowerCase();
    if (status === 'completed') return Number.POSITIVE_INFINITY; // Completed = never overdue
    const parseDate = (str) => { const d = new Date(str); return isNaN(d) ? null : d; };
    const now = Date.now();
    const due = parseDate(p.deadline) || parseDate(p.endDate);
    if (!due) return Number.POSITIVE_INFINITY; // no deadline -> push to end
    return due.getTime() - now;
  };

  // Archived projects should not appear in active project lists/tabs.
  const isArchivedProject = (project) => {
    if (!project) return false;
    if (project.archived === true || project.archived === 1) return true;
    if (String(project.archived).toLowerCase() === "true") return true;

    const archivedMonthId = project.archived_month_id ?? project.archivedMonthId;
    return archivedMonthId !== null && archivedMonthId !== undefined && String(archivedMonthId).trim() !== "";
  };

  const filtered = useMemo(() => {
    if (!safeProjects || !Array.isArray(safeProjects)) return [];
    const list = safeProjects.map(p => ({
      ...p,
      assigned: ensureAssigned(p.assigned)
    })).filter((p) => {
      // Do not show month-closed (archived) projects in Projects page.
      if (isArchivedProject(p)) return false;
      const matchesQ = [p.projectName, p.clientName, p.platform].some((x) =>
        String(x || "").toLowerCase().includes(query.toLowerCase())
      );
      const norm = (s)=> s === 'Revision' ? 'Revising' : (s === 'Cancelled' ? 'Cancel' : s);
      const ps = norm(p.status);
      const matchesS = tab === "All" ? true : ps === tab;
      return matchesQ && matchesS;
    });

    // Sort: overdue first, then by least remaining time
    // Completed projects are never considered overdue
    return list.sort((a, b) => {
      const aStatus = String(a.status || '').toLowerCase();
      const bStatus = String(b.status || '').toLowerCase();
      const aCompleted = aStatus === 'completed';
      const bCompleted = bStatus === 'completed';
      
      // Completed projects go to the end
      if (aCompleted && !bCompleted) return 1;
      if (!aCompleted && bCompleted) return -1;
      
      const ra = getRemainingMs(a);
      const rb = getRemainingMs(b);
      const aOver = !aCompleted && ra < 0 ? 1 : 0;
      const bOver = !bCompleted && rb < 0 ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver; // overdue first
      // then by remaining time ascending (more overdue -> more negative -> earlier)
      return ra - rb;
    });
  }, [safeProjects, query, tab]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading projects...</div>
      </div>
    );
  }

  return (
    <div className="grid gap-2 sm:gap-1 w-full max-w-full overflow-x-hidden">
      <div className="glass rounded-xl sm:rounded-2xl h-auto md:h-14 px-2.5 sm:px-3 py-2.5 md:py-0 flex flex-col md:flex-row items-stretch md:items-center gap-2.5 md:gap-2 mb-2 sm:mb-3 w-full max-w-full">
        <input 
          className="px-3 h-10 md:h-9 rounded-xl flex-1 min-w-0 bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none placeholder-white/60 text-white text-base md:text-sm"
          placeholder="Search projects..."
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
        />
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-hide w-full min-w-0 -mx-2.5 sm:-mx-3 px-2.5 sm:px-3">
          {['All','In Progress','Revising','Completed','Cancel'].map(t => (
            <button
              key={t}
              className={`px-3 h-10 md:h-9 rounded-xl text-sm whitespace-nowrap touch-manipulation flex-shrink-0 ${tab===t? 'bg-blue-500 text-white' : 'glass'}`}
              onClick={()=>setTab(t)}
            >{t}</button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            className="glass h-10 w-10 md:h-9 md:w-9 rounded-xl grid place-items-center text-white touch-manipulation"
            onClick={() => setMode('table')}
            title="Table view"
          >
            <Table size={16}/>
          </button>
          <button
            className="glass h-10 w-10 md:h-9 md:w-9 rounded-xl grid place-items-center text-white touch-manipulation"
            onClick={() => setMode('cards')}
            title="Card view"
          >
            <LayoutGrid size={16}/>
          </button>
          {canCreate && (
            <>
              <TimeEntryForm />
              <ProjectForm triggerLabel="New Subscription" initialBillingModel="subscription" onDone={()=>setEditing(null)} />
              <ProjectForm triggerLabel="New Project" initialBillingModel="project" editing={editing} onDone={()=>setEditing(null)} />
            </>
          )}
        </div>
      </div>

      {mode === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 md:gap-4 mt-2 sm:mt-4 w-full max-w-full">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{delay:i*0.03}} className="w-full max-w-full">
              <ProjectCard project={p} onEdit={canEdit ? () => setEditing(p) : null} currency={currency} rate={rate} />
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="text-slate-500 text-center py-8 text-sm">No projects found.</div>}
        </div>
      ) : (
        <div className="glass rounded-xl sm:rounded-2xl overflow-hidden mt-2 sm:mt-4 w-full max-w-full">
          {/* Mobile Card View for Table Mode */}
          <div className="block md:hidden space-y-2.5 sm:space-y-3 p-2.5 sm:p-3 w-full max-w-full">
            {filtered.map((p) => {
              const isSubscription = String(p.billingModel || p.billing_model || '').toLowerCase() === 'subscription';
              const subscriptionBase = Number(p.monthlyBasePrice || p.monthly_base_price || p.amount || 0);
              const order = isSubscription
                ? convert(subscriptionBase, p.currency || 'USD', currency, rate)
                : convert(p.amount || 0, p.currency, currency, rate);
              const assignedArray = ensureAssigned(p.assigned);
              let emp = 0;
              if (isSubscription) {
                const employeeExtraRatePkr = Number(p.employeeExtraHourRatePkr || p.employee_extra_hour_rate_pkr || 0);
                const basePayoutPkr = Number(p.employeeMonthlyBasePayoutPkr || p.employee_monthly_base_payout_pkr || 0);
                const extraHours = (Array.isArray(timeEntries) ? timeEntries : [])
                  .filter((entry) => {
                    const projectId = String(entry.projectId || entry.project_id || '');
                    if (projectId !== String(p.id)) return false;
                    const isOvertime = Boolean(entry.isOvertime || entry.is_overtime);
                    if (!isOvertime) return false;
                    const entryDate = entry.entryDate || entry.entry_date;
                    if (!entryDate || !activeMonth) return true;
                    const d = new Date(entryDate);
                    if (Number.isNaN(d.getTime())) return false;
                    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    return ym === activeMonth;
                  })
                  .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
                emp = convert(basePayoutPkr + (extraHours * employeeExtraRatePkr), 'PKR', currency, rate);
              } else {
                for (const a of assignedArray) {
                  if (a.costType === 'percentage') emp += order * (Number(a.costValue) || 0) / 100;
                  else emp += convert(a.costValue || 0, 'PKR', currency, rate);
                }
              }
              const profit = order-emp;
              const isUserAssigned = user && user.userId && assignedArray.some(a => {
                const assignedName = a.name || '';
                const userId = user.userId || user.user_id || user.name || '';
                return assignedName === userId || assignedName.toLowerCase() === userId.toLowerCase();
              });
              const canSeeTeamPayment = canViewFinanceDetails || isUserAssigned;
              
              return (
                <div key={p.id} className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-slate-700/50 w-full max-w-full overflow-hidden">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="text-xs text-slate-400 mb-1 truncate">{p.platform} • {p.clientName}</div>
                      <div className="text-sm sm:text-base font-semibold text-white break-words">{p.projectName}</div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs flex-shrink-0 whitespace-nowrap">{p.status}</span>
                  </div>
                  <div className="space-y-2 text-xs sm:text-sm">
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                      <span className="text-slate-400">Assigned:</span>
                      <span className="text-slate-200 break-words sm:text-right">{assignedArray.map(a=>a?.name || '').filter(Boolean).join(', ') || 'Unassigned'}</span>
                    </div>
                    {canViewFinanceDetails && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-slate-400">Order:</span>
                        <span className="text-slate-200 sm:text-right">{order.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    {canSeeTeamPayment && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-slate-400">Employee:</span>
                        <span className="text-slate-200 sm:text-right">{emp.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    {canViewFinanceDetails && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-slate-400">Profit:</span>
                        <span className="text-green-400 font-medium sm:text-right">{profit.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    {p.deadline && (
                      <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                        <span className="text-slate-400">Deadline:</span>
                        <span className="text-slate-200 sm:text-right">{new Date(p.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <button 
                        className="btn btn-secondary w-full text-sm py-2.5 min-h-[44px] touch-manipulation" 
                        onClick={()=>setEditing(p)}
                      >
                        Edit Project
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-slate-500 text-center py-8 text-sm">No projects found.</div>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto scrollbar-thin">
            <table className="min-w-full text-sm">
            <thead className="bg-slate-100 dark:bg-slate-900/50">
              <tr>
                <th className="p-2 text-left text-xs md:text-sm font-semibold">Platform</th>
                <th className="p-2 text-left text-xs md:text-sm font-semibold">Client</th>
                <th className="p-2 text-left text-xs md:text-sm font-semibold">Project</th>
                <th className="p-2 text-left text-xs md:text-sm font-semibold">Assigned</th>
                {canViewFinanceDetails && <th className="p-2 text-left text-xs md:text-sm font-semibold">Order</th>}
                {(canViewFinanceDetails || (user && user.userId)) && <th className="p-2 text-left text-xs md:text-sm font-semibold">Employee</th>}
                {canViewFinanceDetails && <th className="p-2 text-left text-xs md:text-sm font-semibold">Profit</th>}
                <th className="p-2 text-left text-xs md:text-sm font-semibold">Status</th>
                <th className="p-2 text-left text-xs md:text-sm font-semibold">Deadline</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const isSubscription = String(p.billingModel || p.billing_model || '').toLowerCase() === 'subscription';
                const subscriptionBase = Number(p.monthlyBasePrice || p.monthly_base_price || p.amount || 0);
                const order = isSubscription
                  ? convert(subscriptionBase, p.currency || 'USD', currency, rate)
                  : convert(p.amount || 0, p.currency, currency, rate);
                const assignedArray = ensureAssigned(p.assigned);
                let emp = 0;
                if (isSubscription) {
                  const employeeExtraRatePkr = Number(p.employeeExtraHourRatePkr || p.employee_extra_hour_rate_pkr || 0);
                  const basePayoutPkr = Number(p.employeeMonthlyBasePayoutPkr || p.employee_monthly_base_payout_pkr || 0);
                  const extraHours = (Array.isArray(timeEntries) ? timeEntries : [])
                    .filter((entry) => {
                      const projectId = String(entry.projectId || entry.project_id || '');
                      if (projectId !== String(p.id)) return false;
                      const isOvertime = Boolean(entry.isOvertime || entry.is_overtime);
                      if (!isOvertime) return false;
                      const entryDate = entry.entryDate || entry.entry_date;
                      if (!entryDate || !activeMonth) return true;
                      const d = new Date(entryDate);
                      if (Number.isNaN(d.getTime())) return false;
                      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                      return ym === activeMonth;
                    })
                    .reduce((sum, entry) => sum + (Number(entry.hours) || 0), 0);
                  emp = convert(basePayoutPkr + (extraHours * employeeExtraRatePkr), 'PKR', currency, rate);
                } else {
                  for (const a of assignedArray) {
                    if (a.costType === 'percentage') emp += order * (Number(a.costValue) || 0) / 100;
                    else emp += convert(a.costValue || 0, 'PKR', currency, rate);
                  }
                }
                const profit = order-emp;
                
                // Check if current user is assigned to this project
                const isUserAssigned = user && user.userId && assignedArray.some(a => {
                  const assignedName = a.name || '';
                  const userId = user.userId || user.user_id || user.name || '';
                  return assignedName === userId || assignedName.toLowerCase() === userId.toLowerCase();
                });
                
                // Show Team Payment if: user has finance details permission OR user is assigned to the project
                const canSeeTeamPayment = canViewFinanceDetails || isUserAssigned;
                // deadline progress for table view
                // Parse deadline - handle Supabase TIMESTAMP (may not have timezone)
                const parseDate = (str)=>{ 
                  if (!str) return null;
                  let dateStr = String(str).trim();
                  
                  // If it's already an ISO string with timezone, use it directly
                  if (dateStr.endsWith('Z') || dateStr.match(/[+-]\d{2}:\d{2}$/)) {
                    const d = new Date(dateStr);
                    return isNaN(d.getTime()) ? null : d;
                  }
                  
                  // If it's a timestamp without timezone (from Supabase TIMESTAMP column)
                  // Treat it as UTC by appending 'Z'
                  if (dateStr.includes('T') && !dateStr.endsWith('Z')) {
                    dateStr = dateStr + 'Z';
                  }
                  
                  const d = new Date(dateStr);
                  return isNaN(d.getTime()) ? null : d;
                };
                const now = Date.now();
                const due = parseDate(p.deadline);
                const dueTs = due ? due.getTime() : null;
                const start = parseDate(p.startDate);
                const WINDOW_MS = 48*60*60*1000;
                const startRefTs = start ? start.getTime() : (dueTs ? (dueTs - WINDOW_MS) : null);
                const totalMs = (startRefTs!==null && dueTs!==null) ? Math.max(1, dueTs - startRefTs) : 0;
                const remainingMs = dueTs!==null ? Math.max(0, dueTs - now) : 0;
                const elapsedMs = totalMs ? Math.min(totalMs, Math.max(0, now - startRefTs)) : 0;
                const pct = totalMs ? Math.min(100, Math.max(0, (elapsedMs/totalMs)*100)) : 0;
                // Completed projects are never overdue
                const status = String(p.status || '').toLowerCase();
                const isOverdue = status !== 'completed' && dueTs!==null ? now >= dueTs : false;
                const fmtRemain=(ms)=>{ const s=Math.max(0,Math.floor(ms/1000)); const d=Math.floor(s/86400); const h=Math.floor((s%86400)/3600); const m=Math.floor((s%3600)/60); if(d>0) return `${d}d ${h}h`; if(h>0) return `${h}h ${m}m`; const ss=s%60; return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`; };
                return (
                  <tr key={p.id} className="border-t border-slate-200/30">
                    <td className="p-2 text-xs md:text-sm">{p.platform}</td>
                    <td className="p-2 text-xs md:text-sm">{p.clientName}</td>
                    <td className="p-2 text-xs md:text-sm font-medium">{p.projectName}</td>
                    <td className="p-2 text-xs md:text-sm">{assignedArray.map(a=>a?.name || '').filter(Boolean).join(', ') || 'Unassigned'}</td>
                    {canViewFinanceDetails && <td className="p-2">{order.toFixed(2)} {currency}</td>}
                    {canSeeTeamPayment && <td className="p-2">{emp.toFixed(2)} {currency}</td>}
                    {canViewFinanceDetails && <td className="p-2">{profit.toFixed(2)} {currency}</td>}
                    <td className="p-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800">{p.status}</span>
                    </td>
                    <td className="p-2">
                      <div className="text-xs text-slate-500">{due ? due.toLocaleString() : '-'}</div>
                      {due && !isOverdue && (
                        <div className="mt-1">
                          <div className="h-1.5 w-full rounded bg-slate-800 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{width: `${Math.max(2,pct)}%`}} />
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{`Time left: ${fmtRemain(remainingMs)}`}</div>
                        </div>
                      )}
                      {due && isOverdue && (
                        <div className="text-[10px] text-red-400 mt-1">Overdue</div>
                      )}
                    </td>
                    <td className="p-2 text-right">
                      {canEdit && (
                        <button className="btn btn-secondary text-xs md:text-sm px-2 md:px-4 py-1.5 md:py-2" onClick={()=>setEditing(p)}>Edit</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  );
}


