import React, { useMemo, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Plus, Table, LayoutGrid } from "lucide-react";
import { useAppStore, convert } from "../stores/appStore.js";
import ProjectForm from "../widgets/ProjectForm.jsx";
import ProjectCard from "../widgets/ProjectCard.jsx";
import { useFilteredProjects, useCanCreateProjects, useCanEditProjects, useCanDeleteProjects, useCanViewFinanceDetails } from "../hooks/useRoleFilter.js";
import { ROLES, normalizeRoles, hasRole } from "../utils/permissions.js";

export default function Projects() {
  const { currency, rate, loading, user } = useAppStore();
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
  const getRemainingMs = (p) => {
    const parseDate = (str) => { const d = new Date(str); return isNaN(d) ? null : d; };
    const now = Date.now();
    const due = parseDate(p.deadline) || parseDate(p.endDate);
    if (!due) return Number.POSITIVE_INFINITY; // no deadline -> push to end
    return due.getTime() - now;
  };

  const filtered = useMemo(() => {
    if (!safeProjects || !Array.isArray(safeProjects)) return [];
    const list = safeProjects.map(p => ({
      ...p,
      assigned: ensureAssigned(p.assigned)
    })).filter((p) => {
      const matchesQ = [p.projectName, p.clientName, p.platform].some((x) =>
        String(x || "").toLowerCase().includes(query.toLowerCase())
      );
      const norm = (s)=> s === 'Revision' ? 'Revising' : (s === 'Cancelled' ? 'Cancel' : s);
      const ps = norm(p.status);
      const matchesS = tab === "All" ? true : ps === tab;
      return matchesQ && matchesS;
    });

    // Sort: overdue first, then by least remaining time
    return list.sort((a, b) => {
      const ra = getRemainingMs(a);
      const rb = getRemainingMs(b);
      const aOver = ra < 0 ? 1 : 0;
      const bOver = rb < 0 ? 1 : 0;
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
    <div className="grid gap-1">
      <div className="glass rounded-2xl h-auto md:h-14 px-3 py-2 md:py-0 flex flex-col md:flex-row items-stretch md:items-center gap-2 mb-3">
      <input 
  className="px-3 h-9 rounded-xl flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none placeholder-white/60 text-white text-sm md:text-base"
  placeholder="Search by client/project/platform"
  value={query}
  onChange={(e)=>setQuery(e.target.value)}
/>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {['All','In Progress','Revising','Completed','Cancel'].map(t => (
            <button
              key={t}
              className={`px-3 h-9 rounded-xl text-sm whitespace-nowrap ${tab===t? 'bg-blue-500 text-white' : 'glass'}`}
              onClick={()=>setTab(t)}
            >{t}</button>
          ))}
        </div>
        <button
  className="glass h-9 w-9 rounded-xl grid place-items-center text-white"
  onClick={() => setMode('table')}
>
  <Table size={16}/>
</button>

<button
  className="glass h-9 w-9 rounded-xl grid place-items-center text-white"
  onClick={() => setMode('cards')}
>
  <LayoutGrid size={16}/>
</button>
        {canCreate && (
          <ProjectForm triggerLabel="New Project" editing={editing} onDone={()=>setEditing(null)} />
        )}
      </div>

      {mode === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 md:gap-4 mt-4">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} transition={{delay:i*0.03}}>
              <ProjectCard project={p} onEdit={canEdit ? () => setEditing(p) : null} currency={currency} rate={rate} />
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="text-slate-500 text-center py-8">No projects found.</div>}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden mt-4">
          {/* Mobile Card View for Table Mode */}
          <div className="block md:hidden space-y-3 p-3">
            {filtered.map((p) => {
              const order = convert(p.amount||0, p.currency, currency, rate);
              const assignedArray = ensureAssigned(p.assigned);
              let emp=0; for(const a of assignedArray){ if(a.costType==='percentage') emp += order*(Number(a.costValue)||0)/100; else emp += convert(a.costValue||0, 'PKR', currency, rate); }
              const profit = order-emp;
              const isUserAssigned = user && user.userId && assignedArray.some(a => {
                const assignedName = a.name || '';
                const userId = user.userId || user.user_id || user.name || '';
                return assignedName === userId || assignedName.toLowerCase() === userId.toLowerCase();
              });
              const canSeeTeamPayment = canViewFinanceDetails || isUserAssigned;
              
              return (
                <div key={p.id} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-slate-400 mb-1">{p.platform} • {p.clientName}</div>
                      <div className="text-sm font-semibold text-white truncate">{p.projectName}</div>
                    </div>
                    <span className="inline-flex items-center px-2 py-1 rounded-lg bg-blue-500/20 text-blue-300 text-xs ml-2 flex-shrink-0">{p.status}</span>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned:</span>
                      <span className="text-slate-200 truncate ml-2">{assignedArray.map(a=>a?.name || '').filter(Boolean).join(', ') || 'Unassigned'}</span>
                    </div>
                    {canViewFinanceDetails && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Order:</span>
                        <span className="text-slate-200">{order.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    {canSeeTeamPayment && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Employee:</span>
                        <span className="text-slate-200">{emp.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    {canViewFinanceDetails && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Profit:</span>
                        <span className="text-green-400 font-medium">{profit.toFixed(2)} {currency}</span>
                      </div>
                    )}
                    {p.deadline && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Deadline:</span>
                        <span className="text-slate-200">{new Date(p.deadline).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  {canEdit && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <button 
                        className="btn btn-secondary w-full text-xs py-2" 
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
              <div className="text-slate-500 text-center py-8">No projects found.</div>
            )}
          </div>
          
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
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
                const order = convert(p.amount||0, p.currency, currency, rate);
                const assignedArray = ensureAssigned(p.assigned);
                let emp=0; for(const a of assignedArray){ if(a.costType==='percentage') emp += order*(Number(a.costValue)||0)/100; else emp += convert(a.costValue||0, 'PKR', currency, rate); }
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
                const isOverdue = dueTs!==null ? now >= dueTs : false;
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


