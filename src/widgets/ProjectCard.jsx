import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore, convert } from "../stores/appStore.js";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useCanEditProjects, useCanDeleteProjects, useCanViewFinanceDetails } from "../hooks/useRoleFilter.js";
import { ROLES, normalizeRoles, hasRole } from "../utils/permissions.js";

function StatusPill({ status }) {
  const color = useMemo(() => {
    switch (status) {
      case "Completed": return "bg-green-500/15 text-green-300 border-green-500/30";
      case "In Progress": return "bg-blue-500/15 text-blue-300 border-blue-500/30";
      case "Revising": return "bg-purple-500/15 text-purple-300 border-purple-500/30";
      case "Cancel": return "bg-red-500/15 text-red-300 border-red-500/30";
      default: return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    }
  }, [status]);
  return <span className={`inline-flex items-center px-3 h-9 rounded-2xl text-sm border shadow-sm ${color}`}>{status}</span>;
}

function Avatar({ name, logo }) {
  if (logo) {
    return (
      <div className="flex items-center justify-center w-12 h-12 rounded-full overflow-hidden border border-slate-600 flex-shrink-0">
        <img src={logo} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }
  const initials = String(name || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-700 text-slate-200 text-xs font-semibold">
      {initials || "?"}
    </div>
  );
}

export default function ProjectCard({ project, onEdit, currency, rate }) {
  const { deleteProject, updateProject, profiles, agencies, brands, employees, user } = useAppStore();
  const canEdit = useCanEditProjects();
  const canDelete = useCanDeleteProjects();
  const canViewFinanceDetails = useCanViewFinanceDetails();
  
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
  
  const assignedArray = ensureAssigned(project.assigned);
  const order = convert(project.amount||0, project.currency, currency, rate);
  let emp=0; for(const a of assignedArray){ if(a.costType==='percentage') emp += order*(Number(a.costValue)||0)/100; else emp += convert(a.costValue||0, 'PKR', currency, rate); }
  const profit = order-emp;
  const [expanded, setExpanded] = useState(false);
  const firstAssignee = assignedArray[0];
  const fmt = (n) => new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(n);
  const sym = currency === 'USD' ? '$' : '₨';
  
  // Check if current user is assigned to this project
  const isUserAssigned = useMemo(() => {
    if (!user || !user.userId) return false;
    const userId = user.userId || user.user_id || user.name || '';
    return assignedArray.some(a => {
      const assignedName = a.name || '';
      return assignedName === userId || assignedName.toLowerCase() === userId.toLowerCase();
    });
  }, [assignedArray, user]);
  
  // Show Team Payment if: user has finance details permission (Admin/Manager) OR user is assigned to the project
  const canSeeTeamPayment = canViewFinanceDetails || isUserAssigned;

  // Get logo from profile/agency/brand
  const clientLogo = useMemo(() => {
    if (project.profileId) {
      const profile = profiles.find(p => p.id === project.profileId);
      return profile?.logo || '';
    }
    if (project.agencyId) {
      const agency = agencies.find(a => a.id === project.agencyId);
      return agency?.logo || '';
    }
    if (project.brandId) {
      const brand = brands.find(b => b.id === project.brandId);
      return brand?.logo || '';
    }
    return '';
  }, [project.profileId, project.agencyId, project.brandId, profiles, agencies, brands]);

  // Deadline countdown / progress (supports date+time)
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000); // tick every second for smooth countdown
    return () => clearInterval(id);
  }, []);

  function parseDate(str){
    if (!str) return null;
    // Parse date from database
    // Supabase TIMESTAMP might return without 'Z' suffix, so we need to handle it
    let dateStr = String(str).trim();
    
    // If it's already an ISO string with 'Z', use it directly
    if (dateStr.endsWith('Z') || dateStr.includes('+') || dateStr.includes('-') && dateStr.match(/[+-]\d{2}:\d{2}$/)) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) return d;
    }
    
    // If it's a timestamp without timezone (from Supabase TIMESTAMP column)
    // Treat it as UTC by appending 'Z'
    if (dateStr.includes('T') && !dateStr.endsWith('Z') && !dateStr.match(/[+-]\d{2}:\d{2}$/)) {
      dateStr = dateStr.endsWith('Z') ? dateStr : dateStr + 'Z';
    }
    
    // Try parsing
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) return d;
    
    // Fallback: try replacing space with T and appending Z
    const dd = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('T') ? '' : 'Z'));
    return isNaN(dd.getTime()) ? null : dd;
  }

  const start = parseDate(project.startDate);
  const due = parseDate(project.deadline);
  const dueTs = due ? due.getTime() : null;
  // Progress baseline strategy:
  // - If a Start date exists: use [Start -> Due]
  // - If no Start: use last 48h window before Due so progress is meaningful as the deadline approaches
  const WINDOW_MS = 48 * 60 * 60 * 1000;
  const startRefTs = start ? start.getTime() : (dueTs ? (dueTs - WINDOW_MS) : null);
  const totalMs = startRefTs !== null && dueTs !== null ? Math.max(1, dueTs - startRefTs) : 0;
  const remainingMs = dueTs !== null ? Math.max(0, dueTs - now) : 0;
  const elapsedMs = totalMs ? Math.min(totalMs, Math.max(0, now - startRefTs)) : 0;
  const pct = totalMs ? Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100)) : 0;

  function fmtRemaining(ms){
    const s = Math.max(0, Math.floor(ms/1000));
    const d = Math.floor(s/86400);
    const h = Math.floor((s%86400)/3600);
    const m = Math.floor((s%3600)/60);
    const ss = s % 60;
    if (d>0) return `${d}d ${h}h`;
    if (h>0) return `${h}h ${m}m`;
    return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  }

  const isOverdue = due ? now >= due.getTime() : false;
  const isUrgent = !isOverdue && due && remainingMs > 0 && remainingMs <= 24*60*60*1000; // < 24h

  // Normalize raw source links: support multiple links stored as newline-separated string
  const rawSourceLinks = useMemo(() => {
    const raw = project.rawSourceLink || project.raw_source_link || "";
    if (!raw) return [];
    return String(raw)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }, [project.rawSourceLink, project.raw_source_link]);

  return (
    <motion.div 
      whileHover={{ y: -2 }} 
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`card w-full overflow-hidden ${isOverdue ? 'ring-2 ring-red-500 animate-pulse' : ''}`}
    >
      {/* Mobile Design - Different Layout */}
      <div className="md:hidden">
        {/* Header Section */}
        <div className="p-4 pb-3 border-b border-slate-700/50">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">
                <Avatar name={project.clientName} logo={clientLogo} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-400 mb-1">{project.platform}</div>
                <div className="text-base font-bold text-white mb-1 truncate">{project.projectName}</div>
                <div className="text-xs text-slate-400 truncate">{project.clientName}</div>
              </div>
            </div>
            <div className="flex-shrink-0">
              <StatusPill status={project.status} />
            </div>
          </div>
          
          {/* Deadline with Progress - Prominent on Mobile */}
          {due && (
            <div className="mt-3 p-3 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400">Deadline</span>
                <span className={`text-xs font-semibold ${isOverdue ? 'text-red-400' : isUrgent ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {isOverdue ? 'Overdue' : isUrgent ? 'Urgent' : 'On Track'}
                </span>
              </div>
              <div className="text-sm font-bold text-white mb-2">
                {due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              {!isOverdue && (
                <div className="mb-2">
                  <div className="h-2 w-full rounded-full bg-slate-700 overflow-hidden">
                    <div 
                      className={`h-full transition-all ${isUrgent ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                      style={{width: `${Math.max(2, pct)}%`}} 
                    />
                  </div>
                </div>
              )}
              <div className="text-xs text-slate-400">
                {isOverdue 
                  ? `Overdue by ${fmtRemaining(now - due.getTime())}` 
                  : `Time left: ${fmtRemaining(remainingMs)}`}
              </div>
            </div>
          )}
        </div>

        {/* Financial Info - Compact Grid */}
        <div className="p-4 pt-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {canViewFinanceDetails && (
              <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
                <div className="text-[10px] text-blue-300/80 mb-1">Order</div>
                <div className="text-sm font-bold text-blue-200">{sym}{fmt(order)}</div>
              </div>
            )}
            {canSeeTeamPayment && (
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="text-[10px] text-slate-400 mb-1">Team</div>
                <div className="text-sm font-bold text-slate-200">{sym}{fmt(emp)}</div>
              </div>
            )}
            {canViewFinanceDetails && (
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="text-[10px] text-emerald-300/80 mb-1">Profit</div>
                <div className="text-sm font-bold text-emerald-200">{sym}{fmt(profit)}</div>
              </div>
            )}
            {firstAssignee && (
              <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50">
                <div className="text-[10px] text-slate-400 mb-1">Assigned</div>
                <div className="text-xs font-semibold text-slate-200 truncate">{firstAssignee.name}</div>
              </div>
            )}
          </div>

          {/* Action Buttons - Full Width on Mobile */}
          <div className="flex flex-col gap-2 mt-3">
            {canEdit && (
              <button 
                className="w-full btn btn-primary py-3 text-sm font-semibold touch-manipulation"
                onClick={onEdit}
              >
                Edit Project
              </button>
            )}
            <div className="flex gap-2">
              {canEdit && (
                <select 
                  className="flex-1 glass px-3 h-11 rounded-xl text-sm touch-manipulation" 
                  value={project.status === 'Revision' ? 'Revising' : project.status === 'Cancelled' ? 'Cancel' : project.status} 
                  onChange={async (e) => {
                    try {
                      await updateProject(project.id, { status: e.target.value });
                    } catch (error) {
                      console.error('Failed to update project status:', error);
                      alert('Failed to update project status. Please try again.');
                    }
                  }}
                >
                  <option>In Progress</option>
                  <option>Completed</option>
                  <option>Revising</option>
                  <option>Cancel</option>
                </select>
              )}
              <button 
                className="btn btn-secondary px-4 h-11 text-sm touch-manipulation" 
                onClick={()=>setExpanded(v=>!v)}
              >
                {expanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
              </button>
            </div>
          </div>

          {/* Expanded Details - Mobile */}
          {expanded && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <div className="text-xs text-slate-400 mb-2 font-medium">Additional Details</div>
              <div className="space-y-2">
                {assignedArray.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-400 mb-1.5">Assignees</div>
                    <div className="space-y-1.5">
                      {assignedArray.map((a, i) => {
                        const employee = employees.find(e => e.name === a.name);
                        return (
                          <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 text-xs">
                            <Avatar name={a.name} logo={employee?.avatar} />
                            <div className="flex-1">
                              <div className="text-slate-200 font-medium">{a.name}</div>
                              <div className="text-slate-400">{a.costType === "percentage" ? `${a.costValue}%` : `${a.costValue} PKR`}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 rounded-lg bg-slate-800/40">
                    <div className="text-slate-400 mb-1">Start Date</div>
                    <div className="text-slate-200">{project.startDate || '-'}</div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-800/40">
                    <div className="text-slate-400 mb-1">End Date</div>
                    <div className="text-slate-200">{project.endDate || '-'}</div>
                  </div>
                </div>
                {(project.service || project.quantity || project.revisionQuantity || rawSourceLinks.length > 0) && (
                  <div className="p-2 rounded-lg bg-slate-800/40 space-y-1.5">
                    {project.service && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">Service:</span>
                        <span className="text-slate-200 font-medium">{project.service}</span>
                      </div>
                    )}
                    {(project.revisionQuantity || project.quantity) && (
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-400">{project.isRevision ? 'Revision Qty:' : 'Quantity:'}</span>
                        <span className="text-slate-200 font-medium">{project.revisionQuantity || project.quantity}</span>
                      </div>
                    )}
                    {rawSourceLinks.length > 0 && (
                      <div className="pt-1.5 border-t border-slate-700/50">
                        <div className="text-xs text-slate-400 mb-1">
                          {rawSourceLinks.length > 1 ? "Source Links" : "Source Link"}
                        </div>
                        <div className="space-y-1">
                          {rawSourceLinks.map((link, idx) => (
                            <a
                              key={idx}
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-blue-400 hover:text-blue-300 text-xs break-all"
                            >
                              {rawSourceLinks.length > 1 ? `${idx + 1}. ${link}` : link}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Design - Original Layout */}
      <div className="hidden md:block p-5">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Avatar name={project.clientName} logo={clientLogo} />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-400 mb-1">{project.platform} • {project.clientName}</div>
              <div className="text-lg font-semibold tracking-tight text-slate-100 mb-2">{project.projectName}</div>
              <div className="flex-shrink-0">
                <StatusPill status={project.status} />
              </div>
            </div>
          </div>
        </div>
        <div className={`grid gap-4 mt-5 ${canViewFinanceDetails ? 'grid-cols-2 lg:grid-cols-4' : (canSeeTeamPayment ? 'grid-cols-2' : 'grid-cols-1')}`}>
          {canViewFinanceDetails && (
          <div className="min-w-0 rounded-2xl bg-slate-900/40 border border-slate-700/50 px-4 py-3">
            <div className="text-xs text-slate-400">Order Value</div>
            <div className="mt-1 text-lg font-bold text-slate-100 truncate">{sym}{fmt(order)} <span className="text-xs text-slate-400">{currency}</span></div>
          </div>
          )}
          {canSeeTeamPayment && (
          <div className="min-w-0 rounded-2xl bg-slate-900/40 border border-slate-700/50 px-4 py-3">
            <div className="text-xs text-slate-400">Team Payment</div>
            <div className="mt-1 text-lg font-bold text-slate-100 truncate">{sym}{fmt(emp)} <span className="text-xs text-slate-400">{currency}</span></div>
          </div>
          )}
          {canViewFinanceDetails && (
          <div className="min-w-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 px-4 py-3">
            <div className="text-xs text-emerald-300">Profit</div>
            <div className="mt-1 text-lg font-bold text-emerald-200 truncate">{sym}{fmt(profit)} <span className="text-xs text-emerald-300">{currency}</span></div>
          </div>
          )}
          <div className="min-w-0 rounded-2xl bg-slate-900/40 border border-slate-700/50 px-4 py-3">
            <div className="text-xs text-slate-400">Due</div>
            <div className="mt-1 text-lg font-bold text-slate-100 truncate">{due ? due.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</div>
            {due && !isOverdue && (
              <div className="mt-2">
                <div className="h-2 w-full rounded bg-slate-800 overflow-hidden">
                  <div className={`h-full ${isOverdue ? 'bg-red-500' : isUrgent ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{width: `${Math.max(2, isOverdue ? 100 : pct)}%`}} />
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {isOverdue ? `Overdue by ${fmtRemaining(now - due.getTime())}` : `Time left: ${fmtRemaining(remainingMs)}`}
                </div>
              </div>
            )}
            {due && isOverdue && (
              <div className="mt-2 text-xs text-red-400">Overdue by {fmtRemaining(now - due.getTime())}</div>
            )}
          </div>
        </div>
        {(project.service || project.quantity || project.revisionQuantity || rawSourceLinks.length > 0) && (
          <div className="mt-4 flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-4 flex-wrap">
              {project.service && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">Service:</span>
                  <span className="text-slate-200 font-medium">{project.service}</span>
                </div>
              )}
              {(project.revisionQuantity || project.quantity) && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400">{project.isRevision ? 'Revision Quantity:' : 'Quantity:'}</span>
                  <span className="text-slate-200 font-medium">{project.revisionQuantity || project.quantity}</span>
                </div>
              )}
            </div>
            {rawSourceLinks.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-slate-400">
                  {rawSourceLinks.length > 1 ? "Source Links:" : "Source Link:"}
                </span>
                <div className="flex flex-wrap gap-2">
                  {rawSourceLinks.map((link, idx) => (
                    <a
                      key={idx}
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline truncate max-w-xs"
                    >
                      {rawSourceLinks.length > 1 ? `Link ${idx + 1}` : link}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        <div className="mt-5 border-t border-slate-700/40 pt-4 flex items-center justify-between text-sm min-w-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {firstAssignee && (() => {
              const employee = employees.find(e => e.name === firstAssignee.name);
              return <Avatar name={firstAssignee.name} logo={employee?.avatar} />;
            })()}
            {!firstAssignee && <Avatar name="—" />}
            <div className="text-slate-300 truncate">Assigned to <span className="font-medium text-slate-100">{firstAssignee?.name || '—'}</span></div>
          </div>
          <div className="flex gap-4 text-slate-400 text-xs">
            <div>Start: <span className="text-slate-200">{project.startDate || '-'}</span></div>
            <div>End: <span className="text-slate-200">{project.endDate || '-'}</span></div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button className="btn btn-secondary small text-sm py-2" onClick={()=>setExpanded(v=>!v)}>{expanded? <ChevronUp size={14}/> : <ChevronDown size={14}/> } Details</button>
          <div className="flex-1" />
          {canEdit && (
            <select className="glass px-3 h-9 rounded-xl text-sm" value={project.status === 'Revision' ? 'Revising' : project.status === 'Cancelled' ? 'Cancel' : project.status} onChange={async (e) => {
              try {
                await updateProject(project.id, { status: e.target.value });
              } catch (error) {
                console.error('Failed to update project status:', error);
                alert('Failed to update project status. Please try again.');
              }
            }}>
              <option>In Progress</option>
              <option>Completed</option>
              <option>Revising</option>
              <option>Cancel</option>
            </select>
          )}
          {canEdit && onEdit && (
            <button className="btn secondary small text-sm py-2 px-3" onClick={onEdit}>Edit</button>
          )}
          {canDelete && (
            <button className="btn danger small text-sm py-2 px-3" onClick={async ()=>{
              if (confirm('Are you sure you want to delete this project?')) {
                try {
                  await deleteProject(project.id);
                } catch (error) {
                  console.error('Failed to delete project:', error);
                  alert('Failed to delete project. Please try again.');
                }
              }
            }}>Delete</button>
          )}
        </div>
      </div>
      {expanded && (
        <div className={`mt-3 border-t border-slate-700/40 pt-3 ${expanded ? 'block' : 'hidden'}`}>
          <div className="text-xs text-slate-400 mb-2 font-medium">Additional Details</div>
          <div className="space-y-2 mb-3">
            {assignedArray.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-1.5">Assignees</div>
                <div className="space-y-1.5">
                  {assignedArray.map((a, i) => {
                    const employee = employees.find(e => e.name === a.name);
                    return (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/40 text-xs">
                        <Avatar name={a.name} logo={employee?.avatar} />
                        <div className="flex-1">
                          <div className="text-slate-200 font-medium">{a.name}</div>
                          <div className="text-slate-400">{a.costType === "percentage" ? `${a.costValue}%` : `${a.costValue} PKR`}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-slate-800/40">
                <div className="text-slate-400 mb-1">Start Date</div>
                <div className="text-slate-200">{project.startDate || '-'}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/40">
                <div className="text-slate-400 mb-1">End Date</div>
                <div className="text-slate-200">{project.endDate || '-'}</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-800/40 md:col-span-1 col-span-2">
                <div className="text-slate-400 mb-1">Status</div>
                <div className="text-slate-200">{project.status}</div>
              </div>
            </div>
            {(project.service || project.quantity || project.revisionQuantity || rawSourceLinks.length > 0) && (
              <div className="p-2 rounded-lg bg-slate-800/40 space-y-1.5">
                {project.service && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">Service:</span>
                    <span className="text-slate-200 font-medium">{project.service}</span>
                  </div>
                )}
                {(project.revisionQuantity || project.quantity) && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{project.isRevision ? 'Revision Qty:' : 'Quantity:'}</span>
                    <span className="text-slate-200 font-medium">{project.revisionQuantity || project.quantity}</span>
                  </div>
                )}
                {rawSourceLinks.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-700/50">
                    <div className="text-xs text-slate-400 mb-1">
                      {rawSourceLinks.length > 1 ? "Source Links" : "Source Link"}
                    </div>
                    <div className="space-y-1">
                      {rawSourceLinks.map((link, idx) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-blue-400 hover:text-blue-300 text-xs break-all"
                        >
                          {rawSourceLinks.length > 1 ? `${idx + 1}. ${link}` : link}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}


