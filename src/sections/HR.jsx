import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppStore, convert } from "../stores/appStore.js";
import { generateSalaryPDF } from "../utils/pdfGenerator.js";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Users,
  Wallet,
  Mail,
  Phone,
  Building2,
  CreditCard,
  Briefcase,
  TrendingUp,
  Download,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  useFilteredEmployees,
  useFilteredProjects,
} from "../hooks/useRoleFilter.js";
import { hasPermission, PERMISSIONS, hasRole, normalizeRoles, ROLES } from "../utils/permissions.js";
import { dbCompanyDedicatedEditors, dbDailyWorkLogs, dbEmployeeMonthlyServices } from "../lib/db.js";
import DailyWorkLog from "../components/DailyWorkLog.jsx";
import { downloadMonthlyWorkLogPDF } from "../utils/workLogReport.js";

export default function HR() {
  const {
    addEmployee,
    updateEmployee,
    deleteEmployee,
    currency,
    rate,
    loading,
    userRole,
    refreshEmployees,
    employees: allEmployees,
    user,
    profiles,
    agencies,
    brands,
    allUsers,
  } = useAppStore();
  const roleFilteredEmployees = useFilteredEmployees();
  const projects = useFilteredProjects(); // Use filtered projects based on role
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyServices, setMonthlyServices] = useState([]);
  const [completingServiceId, setCompletingServiceId] = useState(null);
  const [detailsCardId, setDetailsCardId] = useState(null);
  const [customerEmployeeIds, setCustomerEmployeeIds] = useState([]);
  const currentRoles = normalizeRoles(user?.role, '');
  const isCustomerView = hasRole(currentRoles, ROLES.CLIENT);
  const isAdminView = hasRole(currentRoles, ROLES.ADMIN);
  const isManagerView = hasRole(currentRoles, ROLES.MANAGER) && !isAdminView;
  const canSeeOwnFinance = hasRole(currentRoles, ROLES.EMPLOYEE);
  const canSeeFinance = isAdminView || (!isManagerView && canSeeOwnFinance);
  const employees = isCustomerView
    ? allEmployees.filter(employee => customerEmployeeIds.some(id => String(id) === String(employee.id)))
    : roleFilteredEmployees;

  useEffect(() => {
    if (!isCustomerView) return;
    const companyName = String(user?.companyName || user?.company_name || '').trim().toLowerCase();
    if (!companyName) {
      setCustomerEmployeeIds([]);
      return;
    }
    const entities = [
      ...profiles.map(item => ({ entityType: 'profile', entityId: item.id, name: item.name })),
      ...agencies.map(item => ({ entityType: 'agency', entityId: item.id, name: item.name })),
      ...brands.map(item => ({ entityType: 'brand', entityId: item.id, name: item.name })),
    ].filter(item => String(item.name || '').trim().toLowerCase() === companyName);
    dbCompanyDedicatedEditors.getByEntities(entities)
      .then(rows => setCustomerEmployeeIds([...new Set(rows.map(row => row.employee_id || row.employeeId).filter(Boolean))]))
      .catch(error => {
        console.error('Failed to load customer dedicated editors:', error);
        setCustomerEmployeeIds([]);
      });
  }, [isCustomerView, user?.companyName, user?.company_name, profiles, agencies, brands]);

  // Debug logging
  useEffect(() => {
    console.log("🔍 HR Debug Info:");
    console.log("  - User Role:", userRole);
    console.log("  - User:", user);
    console.log("  - All employees in store:", allEmployees?.length || 0);
    console.log("  - Filtered employees:", employees?.length || 0);
    console.log("  - All employees:", allEmployees);
    console.log("  - Filtered employees:", employees);
  }, [userRole, user, allEmployees, employees]);

  // Check if user can add employees (only admin and manager)
  const canAddEmployees = hasPermission(userRole, PERMISSIONS.ADD_TEAM_MEMBERS);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState("payout");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const refreshMonthlyServices = async () => {
    try {
      const rows = await dbEmployeeMonthlyServices.getAll();
      setMonthlyServices(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Failed to load monthly service completions:", error);
      setMonthlyServices([]);
    }
  };

  useEffect(() => {
    refreshMonthlyServices();
  }, []);

  // Don't refresh on mount - data already loaded in initialize()
  // Only refresh if explicitly needed (e.g., after create/update)

  // Ensure employees is always an array
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

  const ym = (str) => {
    if (!str) return "";
    const d = new Date(str);
    if (isNaN(d)) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  // Helper to ensure assigned is always an array
  const ensureAssigned = (assigned) => {
    if (Array.isArray(assigned)) return assigned;
    if (typeof assigned === "string") {
      try {
        const parsed = JSON.parse(assigned);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const stats = useMemo(() => {
    const map = new Map();
    // Initialize map with all employees - handle both camelCase and snake_case
    for (const emp of safeEmployees) {
      const empName = emp.name || emp.employee_name || "Unknown Employee";
      map.set(empName, {
        projects: 0,
        revisions: 0,
        payout: 0,
        payoutPKR: 0,
        projectPayout: 0,
        projectPayoutPKR: 0,
        quantity: 0,
        revisionQuantity: 0,
        service: null,
      });
    }
    for (const p of safeProjects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      
      // Check if project was pulled forward
      const isPulledForward = p.pulled_forward === true || p.pulledForward === true;
      
      // Get project's date month (prefer startDate for pulled-forward projects)
      // When a project is pulled forward, its start_date is updated to the next month
      const projectDate = isPulledForward
        ? (p.startDate || p.start_date)
        : (p.completedAt || p.completed_at || p.updatedAt || p.updated_at);
      const m = projectDate ? ym(projectDate) : month;
      
      // Include project if:
      // 1. Its date matches the selected month, OR
      // 2. It was pulled forward and we're viewing the current month (pulled-forward projects belong to current/new month)
      const currentMonth = ym(new Date().toISOString());
      const belongsToMonth = m === month || (isPulledForward && month === currentMonth);
      
      if (!belongsToMonth) continue;
      const assignedArray = ensureAssigned(p.assigned);
      const projectQuantity = Number(p.quantity) || 0;
      const revisionQty = Number(p.revisionQuantity) || 0;
      const isRevision = p.isRevision || p.status === "Revision";
      const isCompleted = String(p.status || "").trim().toLowerCase() === "completed";
      // For revisions, use revisionQuantity if available, otherwise use quantity
      const quantityToUse =
        isRevision && revisionQty > 0 ? revisionQty : projectQuantity;
      for (const a of assignedArray) {
        // A team payout is earned only after the project is completed.
        let costDisplay = 0;
        let costPKR = 0;
        if (isCompleted) {
          const orderDisplay = convert(p.amount || 0, p.currency, currency, rate);
          const orderPKR = convert(p.amount || 0, p.currency, "PKR", rate);
          if (a.costType === "percentage") {
            const pct = (Number(a.costValue) || 0) / 100;
            costDisplay = orderDisplay * pct;
            costPKR = orderPKR * pct;
          } else {
            costDisplay = convert(a.costValue || 0, "PKR", currency, rate);
            costPKR = Number(a.costValue) || 0;
          }
        }
        const prev = map.get(a.name) || {
          projects: 0,
          revisions: 0,
          payout: 0,
          payoutPKR: 0,
          projectPayout: 0,
          projectPayoutPKR: 0,
          quantity: 0,
          revisionQuantity: 0,
          service: null,
        };
        map.set(a.name, {
          projects: prev.projects + (isRevision ? 0 : 1), // Only count as new project if NOT a revision
          revisions: prev.revisions + (isRevision ? 1 : 0),
          payout: prev.payout + costDisplay,
          payoutPKR: prev.payoutPKR + costPKR,
          projectPayout: prev.projectPayout + costDisplay,
          projectPayoutPKR: prev.projectPayoutPKR + costPKR,
          quantity: prev.quantity + (isRevision ? 0 : projectQuantity), // Only add to quantity if not a revision
          revisionQuantity:
            prev.revisionQuantity + (isRevision ? quantityToUse : 0), // Add revision quantity for revisions
          service: p.service || prev.service,
        });
      }
    }
    // Map all employees to rows - handle both camelCase and snake_case field names
    let rows = safeEmployees.map((e) => {
      // Handle both camelCase and snake_case field names
      const empName = e.name || e.employee_name || "Unknown Employee";
      const empRole = e.role || e.employee_role || "";
      const empEmail = e.email || e.employee_email || "";
      const empPhone = e.phone || e.employee_phone || "";
      const empBankName = e.bankName || e.bank_name || "";
      const empBankAccount = e.bankAccount || e.bank_account || "";
      const empAvatar = e.avatar || e.employee_avatar || "";
      const employeeType = e.employeeType || e.employee_type || "project_based";
      const isRetainer = employeeType === "retainer" || employeeType === "hybrid";
      const serviceCompletion = monthlyServices.find((service) =>
        String(service.employee_id || service.employeeId) === String(e.id) &&
        String(service.service_month || service.serviceMonth || '').slice(0, 7) === month
      );
      const fixedSalaryPKR = isRetainer && serviceCompletion
        ? (Number(serviceCompletion.fixed_salary_pkr ?? serviceCompletion.fixedSalaryPKR ?? 0) || 0)
        : 0;
      const fixedSalary = convert(fixedSalaryPKR, "PKR", currency, rate);
      const retainerAssignments = Array.isArray(e.retainerAssignments || e.retainer_assignments) ? (e.retainerAssignments || e.retainer_assignments) : [];
      const configuredRetainerRevenuePKR = retainerAssignments.reduce((total, assignment) => total + convert(Number(assignment.monthlyRevenue) || 0, assignment.currency || 'PKR', 'PKR', rate), 0);
      const customerRevenuePKR = serviceCompletion
        ? Number(serviceCompletion.customer_revenue_pkr ?? serviceCompletion.customerRevenuePKR ?? 0) || 0
        : 0;
      const projectPayout = (map.get(empName) || { projectPayout: 0 }).projectPayout;
      const projectPayoutPKR = (map.get(empName) || { projectPayoutPKR: 0 }).projectPayoutPKR;

      return {
        id: e.id,
        name: empName,
        role: empRole,
        avatar: empAvatar,
        email: empEmail,
        phone: empPhone,
        bankName: empBankName,
        bankAccount: empBankAccount,
        street: e.street || e.address_street || "",
        city: e.city || e.address_city || "",
        state: e.state || e.address_state || "",
        country: e.country || e.address_country || "",
        zip: e.zip || e.address_zip || "",
        notes: e.notes || "",
        projects: (map.get(empName) || { projects: 0 }).projects,
        revisions: (map.get(empName) || { revisions: 0 }).revisions,
        employeeType,
        monthlySalary: fixedSalaryPKR,
        dutyHours: e.dutyHours || e.duty_hours || "",
        assignedClient: e.assignedClient || e.assigned_client || "",
        retainerAssignments,
        customerRevenuePKR,
        retainerGrossProfitPKR: customerRevenuePKR - fixedSalaryPKR,
        configuredRetainerRevenuePKR,
        configuredRetainerGrossProfitPKR: configuredRetainerRevenuePKR - (Number(e.monthlySalary ?? e.monthly_salary ?? 0) || 0),
        monthlyServiceCompleted: Boolean(serviceCompletion),
        monthlyServiceCompletedAt: serviceCompletion?.completed_at || serviceCompletion?.completedAt || null,
        configuredMonthlySalaryPKR: Number(e.monthlySalary ?? e.monthly_salary ?? 0) || 0,
        fixedSalary,
        fixedSalaryPKR,
        projectPayout,
        projectPayoutPKR,
        payout: projectPayout + fixedSalary,
        payoutPKR: projectPayoutPKR + fixedSalaryPKR,
        quantity: (map.get(empName) || { quantity: 0 }).quantity,
        revisionQuantity: (map.get(empName) || { revisionQuantity: 0 })
          .revisionQuantity,
        service: (map.get(empName) || { service: null }).service,
      };
    });
    if (sortKey === "name") rows.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortKey === "projects")
      rows.sort((a, b) => b.projects - a.projects);
    else rows.sort((a, b) => b.payout - a.payout);
    return rows;
  }, [safeEmployees, safeProjects, monthlyServices, month, currency, rate, sortKey]);

  const displayed = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return stats;
    return stats.filter((r) =>
      [r.name, r.role, r.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }, [stats, query]);

  const projectsByName = useMemo(() => {
    const m = new Map();
    for (const r of stats) m.set(r.name, r.projects);
    return m;
  }, [stats]);

  function startCreate() {
    if (!canAddEmployees) {
      alert(
        "You do not have permission to add employees. Only Admin and Manager roles can add employees."
      );
      return;
    }
    setEditing(null);
    setOpen(true);
  }
  function startEdit(emp) {
    setEditing(emp);
    setOpen(true);
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center py-12'>
        <div className='text-slate-500'>Loading team...</div>
      </div>
    );
  }

  return (
    <div className='grid gap-2'>
      <div className='glass rounded-2xl h-auto md:h-11 px-3 py-2 md:py-0 flex flex-col md:flex-row items-stretch md:items-center gap-2'>
        <div className='text-sm font-semibold flex items-center gap-2 flex-shrink-0'>
          <Users size={16} /> Team
        </div>
        <input
          className='px-3 h-9 rounded-xl flex-1 bg-transparent border-none outline-none ring-0 focus:ring-0 focus:outline-none placeholder-white/60 text-white text-sm md:text-base'
          placeholder='Search by name/role/email'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className='flex-1 hidden md:block' />
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            className='btn btn-secondary inline-flex items-center gap-2 text-sm'
            onClick={async () => {
              setRefreshing(true);
              try {
                await refreshEmployees();
              } catch (error) {
                console.error("Failed to refresh employees:", error);
                alert("Failed to refresh employees. Please try again.");
              } finally {
                setRefreshing(false);
              }
            }}
            disabled={refreshing}
            title='Refresh employees list'>
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            <span className="hidden sm:inline">{refreshing ? "Refreshing..." : "Refresh"}</span>
          </button>
          {canAddEmployees && (
            <button
              className='btn btn-primary inline-flex items-center gap-2 text-sm whitespace-nowrap'
              onClick={startCreate}>
              <Plus size={16} /> <span className="hidden sm:inline">Add </span>Employee
            </button>
          )}
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4'>
        {displayed.length === 0 ? (
          <div className='col-span-full text-center py-12 text-slate-500'>
            <Users size={48} className='mx-auto mb-3 opacity-50' />
            <div className='text-sm'>
              {!hasPermission(userRole, PERMISSIONS.VIEW_ALL_TEAM) 
                ? (!user?.userId && !user?.user_id
                    ? "No employee card found. Please make sure your Employee ID/Name is set in your user profile."
                    : "No employee card found matching your Employee ID/Name. Please contact administrator.")
                : "No team members found."}
            </div>
          </div>
        ) : (
          displayed.map((r, index) => isCustomerView ? (
            <CustomerTeamCard key={r.id} employee={r} month={month} customerName={user?.companyName || user?.company_name || user?.name} currentUser={user}/>
          ) : (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className='card group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden'>
            {/* Gradient accent bar */}
            <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'></div>

            {detailsCardId === r.id && (
              <div className='absolute inset-0 z-20 flex flex-col overflow-hidden bg-white p-4 dark:bg-slate-950'>
                <div className='flex items-center justify-between border-b border-slate-200/30 pb-3 dark:border-slate-700/30'>
                  <div>
                    <div className='font-bold text-slate-900 dark:text-slate-100'>{r.name}</div>
                    <div className='text-xs text-slate-500'>Contact, banking and address details</div>
                  </div>
                  <button type='button' className='grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' onClick={() => setDetailsCardId(null)} aria-label='Return to employee summary'><X size={18}/></button>
                </div>
                <div className='mt-3 grid flex-1 content-start gap-2 overflow-y-auto text-sm'>
                  <DetailRow icon={Mail} label='Email' value={r.email}/>
                  <DetailRow icon={Phone} label='Phone' value={r.phone}/>
                  {canSeeFinance && <DetailRow icon={Building2} label='Bank name' value={r.bankName}/>} 
                  {canSeeFinance && <DetailRow icon={CreditCard} label='Bank account number' value={r.bankAccount} mono/>}
                  <DetailRow icon={MapPin} label='Address' value={[
                    r.street,
                    [r.city, r.state, r.zip].filter(Boolean).join(', '),
                    r.country,
                  ].filter(Boolean).join('\n')}/>
                  <DetailRow icon={Briefcase} label='Notes' value={r.notes}/>
                </div>
                <button type='button' className='btn btn-secondary mt-3 min-h-11 w-full' onClick={() => setDetailsCardId(null)}>Back to summary</button>
              </div>
            )}

            {/* Header Section */}
            <div className='flex items-start gap-4 mb-4 pb-4 border-b border-slate-200/30 dark:border-slate-700/30'>
              {r.avatar ? (
                <div className='relative flex-shrink-0'>
                  <div className='w-16 h-16 rounded-2xl overflow-hidden border-2 border-blue-500/50 shadow-xl ring-2 ring-blue-500/20'>
                    <img
                      src={r.avatar}
                      alt={r.name}
                      className='w-full h-full object-cover'
                    />
                  </div>
                  <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-950 shadow-lg'></div>
                </div>
              ) : (
                <div className='relative flex-shrink-0'>
                  <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 flex items-center justify-center text-white font-bold text-2xl shadow-xl'>
                    {r.name.charAt(0).toUpperCase()}
                  </div>
                  <div className='absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-white dark:border-slate-950 shadow-lg'></div>
                </div>
              )}
              <div className='flex-1 min-w-0 pt-1'>
                <div className='font-bold text-lg text-slate-900 dark:text-slate-100 truncate mb-1'>
                  {r.name}
                </div>
                <div className='flex items-center gap-2'>
                  <Briefcase size={14} className='text-slate-400' />
                  <span className='text-sm text-slate-500 dark:text-slate-400 truncate'>
                    {r.role || "No role specified"}
                  </span>
                </div>
                <div className='mt-2 inline-flex rounded-lg bg-slate-700/40 px-2 py-1 text-[11px] text-slate-300'>
                  {r.employeeType === "hybrid"
                    ? "Permanent + Project-Based"
                    : r.employeeType === "retainer"
                      ? "Permanent / Retainer"
                      : "Project-Based"}
                </div>
              </div>
            </div>

            {/* Payout Section - Admin and the employee's own card only */}
            {canSeeFinance && <div className='mb-4 p-4 rounded-2xl bg-gradient-to-br from-blue-500/15 via-purple-500/15 to-pink-500/15 border border-blue-500/20 dark:border-blue-500/30 backdrop-blur-sm'>
              <div className='flex items-center justify-between mb-2'>
                <div className='flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider'>
                  <Wallet size={14} />
                  Monthly Payout
                </div>
                <div className='px-2 py-0.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold'>
                  PKR
                </div>
              </div>
              <div className='text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-baseline gap-2'>
                {new Intl.NumberFormat("en", {
                  maximumFractionDigits: 0,
                }).format(r.payoutPKR)}
                <span className='text-xs font-normal text-slate-500'>PKR</span>
              </div>
              {(r.employeeType === "retainer" || r.employeeType === "hybrid") && (
                <div className='mt-3 grid grid-cols-2 gap-2 border-t border-blue-500/20 pt-3 text-xs'>
                  <div>
                    <div className='text-slate-500'>Fixed monthly salary</div>
                    <div className='font-semibold text-slate-200'>{new Intl.NumberFormat("en").format(r.configuredMonthlySalaryPKR)} PKR</div>
                    <div className={`mt-0.5 text-[10px] ${r.monthlyServiceCompleted ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {r.monthlyServiceCompleted ? 'Added to this month’s payout' : 'Not yet added to payout'}
                    </div>
                  </div>
                  <div>
                    <div className='text-slate-500'>Project earnings</div>
                    <div className='font-semibold text-slate-200'>{new Intl.NumberFormat("en").format(r.projectPayoutPKR)} PKR</div>
                  </div>
                  {isAdminView && <div>
                    <div className='text-slate-500'>Monthly retainer revenue</div>
                    <div className='font-semibold text-emerald-300'>{new Intl.NumberFormat("en").format(r.configuredRetainerRevenuePKR)} PKR</div>
                  </div>}
                  {isAdminView && <div>
                    <div className='text-slate-500'>Expected gross profit</div>
                    <div className='font-semibold text-emerald-300'>{new Intl.NumberFormat("en").format(r.configuredRetainerGrossProfitPKR)} PKR</div>
                  </div>}
                </div>
              )}
              {isAdminView && (r.employeeType === "retainer" || r.employeeType === "hybrid") && r.retainerAssignments.length > 0 && (
                <div className='mt-3 space-y-1 border-t border-blue-500/20 pt-3 text-xs'>
                  <div className='text-slate-500'>Customer assignments</div>
                  {r.retainerAssignments.map((assignment) => (
                    <div key={`${assignment.entityType}-${assignment.entityId}`} className='flex justify-between gap-2 text-slate-300'>
                      <span className='truncate'>{assignment.name} · {assignment.dailyHours || 0}h/day</span>
                      <span className='shrink-0'>{new Intl.NumberFormat("en").format(Number(assignment.monthlyRevenue) || 0)} {assignment.currency || 'PKR'}</span>
                    </div>
                  ))}
                </div>
              )}
              {(r.employeeType === "retainer" || r.employeeType === "hybrid") && (
                <div className='mt-3'>
                  {r.monthlyServiceCompleted ? (
                    <div className='flex min-h-[40px] items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-400'>
                      Monthly service completed
                    </div>
                  ) : canAddEmployees ? (
                    <button
                      type='button'
                      disabled={completingServiceId === r.id}
                      className='btn btn-primary w-full min-h-[44px] text-sm disabled:opacity-60'
                      onClick={async () => {
                        if (!confirm(`Complete ${month} monthly service for ${r.name}? This will add ${new Intl.NumberFormat("en").format(r.configuredMonthlySalaryPKR)} PKR to the payout.`)) return;
                        setCompletingServiceId(r.id);
                        try {
                          await dbEmployeeMonthlyServices.complete({
                            employeeId: r.id,
                            serviceMonth: month,
                          fixedSalaryPKR: r.configuredMonthlySalaryPKR,
                          customerRevenuePKR: r.retainerAssignments.reduce((total, assignment) => total + convert(Number(assignment.monthlyRevenue) || 0, assignment.currency || 'PKR', 'PKR', rate), 0),
                          assignmentSnapshot: r.retainerAssignments,
                            completedBy: user?.userId || user?.user_id || user?.name || null,
                          });
                          await refreshMonthlyServices();
                        } catch (error) {
                          console.error("Failed to complete monthly service:", error);
                          alert(error.message || "Failed to complete monthly service.");
                        } finally {
                          setCompletingServiceId(null);
                        }
                      }}>
                      {completingServiceId === r.id ? "Completing…" : "Complete Monthly Service"}
                    </button>
                  ) : (
                    <div className='text-center text-xs text-slate-500'>Monthly service pending</div>
                  )}
                </div>
              )}
              {r.payoutPKR > 0 && (
                <div className='flex items-center gap-1 mt-2 text-xs text-slate-500'>
                  <TrendingUp size={12} className='text-green-500' />
                  <span>Active this month</span>
                </div>
              )}
            </div>}

            {/* Stats Grid */}
            <div className='grid grid-cols-2 gap-3 mb-4'>
              <div className='p-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 hover:border-blue-500/30 transition-colors'>
                <div className='flex items-center gap-2 mb-1.5'>
                  <div className='w-2 h-2 rounded-full bg-blue-500'></div>
                  <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>
                    Projects
                  </span>
                </div>
                <div className='text-xl font-bold text-slate-900 dark:text-slate-100'>
                  {r.projects}
                </div>
                <div className='text-xs text-slate-400 mt-1'>This month</div>
              </div>
              {r.revisions > 0 ? (
                <div className='p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/20 border border-amber-500/30 dark:border-amber-500/40 hover:border-amber-500/50 transition-colors'>
                  <div className='flex items-center gap-2 mb-1.5'>
                    <div className='w-2 h-2 rounded-full bg-amber-500'></div>
                    <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>
                      Revisions
                    </span>
                  </div>
                  <div className='text-xl font-bold text-amber-600 dark:text-amber-400'>
                    {r.revisionQuantity > 0 ? r.revisionQuantity : r.revisions}
                  </div>
                  <div className='text-xs text-slate-400 mt-1'>
                    {r.revisionQuantity > 0
                      ? "Revision items"
                      : "Paid revisions"}
                  </div>
                </div>
              ) : r.quantity > 0 ? (
                <div className='p-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 hover:border-purple-500/30 transition-colors'>
                  <div className='flex items-center gap-2 mb-1.5'>
                    <div className='w-2 h-2 rounded-full bg-purple-500'></div>
                    <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>
                      Quantity
                    </span>
                  </div>
                  <div className='text-xl font-bold text-slate-900 dark:text-slate-100'>
                    {r.quantity}
                  </div>
                  <div className='text-xs text-slate-400 mt-1 truncate'>
                    {r.service || "Items"}
                  </div>
                </div>
              ) : (
                <div className='p-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-700/50'>
                  <div className='flex items-center gap-2 mb-1.5'>
                    <div className='w-2 h-2 rounded-full bg-slate-400'></div>
                    <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>
                      Quantity
                    </span>
                  </div>
                  <div className='text-xl font-bold text-slate-400'>0</div>
                  <div className='text-xs text-slate-400 mt-1'>No items</div>
                </div>
              )}
            </div>

            {/* Quantity row if revisions exist and there's also regular quantity */}
            {r.revisions > 0 && r.quantity > 0 && (
              <div className='mb-4'>
                <div className='p-3 rounded-xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/50 dark:to-slate-900/50 border border-slate-200/50 dark:border-slate-700/50 hover:border-purple-500/30 transition-colors'>
                  <div className='flex items-center gap-2 mb-1.5'>
                    <div className='w-2 h-2 rounded-full bg-purple-500'></div>
                    <span className='text-xs text-slate-500 dark:text-slate-400 font-medium'>
                      Regular Quantity
                    </span>
                  </div>
                  <div className='text-xl font-bold text-slate-900 dark:text-slate-100'>
                    {r.quantity}
                  </div>
                  <div className='text-xs text-slate-400 mt-1 truncate'>
                    {r.service || "Items"}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className='mt-5 pt-4 border-t border-slate-200/30 dark:border-slate-700/30 flex justify-between items-center'>
              <div className='flex flex-wrap gap-2'>
              <button type='button' className='glass px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:bg-blue-500/15 hover:text-blue-400 transition-colors' onClick={() => setDetailsCardId(r.id)}>
                <Building2 size={14}/> Contact details
              </button>
              {canSeeFinance && <button
                className='glass px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:bg-green-500/15 hover:text-green-400 transition-colors'
                onClick={() => {
                  try {
                    // Always use PKR for salary PDFs
                    generateSalaryPDF(r, safeProjects, "PKR", rate, month);
                  } catch (e) {
                    console.error("Failed to generate salary PDF:", e);
                    alert("Failed to generate PDF.");
                  }
                }}>
                <Download size={14} />
                Salary PDF
              </button>}
              {(r.employeeType === "retainer" || r.employeeType === "hybrid") && <DailyWorkLog employee={r} currentUser={user}/>}</div>
              {(hasPermission(userRole, PERMISSIONS.EDIT_TEAM_MEMBERS) || hasPermission(userRole, PERMISSIONS.DELETE_TEAM_MEMBERS)) && (
              <div className='flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity'>
                  {hasPermission(userRole, PERMISSIONS.EDIT_TEAM_MEMBERS) && (
                <button
                  className='btn btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg-blue-500 hover:text-white transition-colors'
                  onClick={() =>
                    startEdit(safeEmployees.find((e) => e.id === r.id))
                  }>
                  <Pencil size={14} />
                  Edit
                </button>
                  )}
                  {hasPermission(userRole, PERMISSIONS.DELETE_TEAM_MEMBERS) && (
                <button
                  className='btn btn-secondary px-4 py-2 text-sm inline-flex items-center gap-2 hover:bg-red-500 hover:text-white transition-colors'
                  onClick={async () => {
                    if (
                      confirm(
                        "Are you sure you want to delete this employee? This action cannot be undone."
                      )
                    ) {
                      try {
                        await deleteEmployee(r.id);
                        // Success - employee card will be removed from UI immediately
                      } catch (error) {
                        console.error("Failed to delete employee:", error);
                        alert(
                          error.message ||
                            "Failed to delete employee. Please try again."
                        );
                      }
                    }
                  }}>
                  <Trash2 size={14} />
                  Delete
                </button>
                  )}
              </div>
              )}
            </div>
          </motion.div>
          ))
        )}
      </div>

      {open && createPortal(
        <EmployeeDrawer
          initial={editing}
          canManageRetainerFinance={isAdminView}
          assignmentOptions={[
            ...profiles.map(item => ({ entityType: 'profile', entityId: item.id, name: item.name || item.username, group: 'Freelance Profiles' })),
            ...brands.map(item => ({ entityType: 'brand', entityId: item.id, name: item.name, group: 'Brands / Businesses' })),
            ...agencies.map(item => ({ entityType: 'agency', entityId: item.id, name: item.name, group: 'Collaborative Agencies' })),
            ...allUsers.filter(item => String(item.role || '').toLowerCase().includes('client')).map(item => ({ entityType: 'customer', entityId: item.id, name: item.companyName || item.company_name || item.name, group: 'Customer Companies' })),
          ].filter(item => item.entityId && item.name)}
          onClose={() => {
            setOpen(false);
            setEditing(null); // Clear editing state when closing
          }}
          onSave={async (data) => {
            try {
              if (editing) {
                // Double-check permission before editing
                if (!hasPermission(userRole, PERMISSIONS.EDIT_TEAM_MEMBERS)) {
                  alert(
                    "You do not have permission to edit employees. Only Admin and Manager roles can edit employees."
                  );
                  return;
                }
                await updateEmployee(editing.id, data);
              } else {
                // Double-check permission before adding
                if (!canAddEmployees) {
                  alert(
                    "You do not have permission to add employees. Only Admin and Manager roles can add employees."
                  );
                  return;
                }
                await addEmployee(data);
                // State is already updated in addEmployee, UI will update immediately
              }
              setOpen(false);
              setEditing(null);
            } catch (error) {
              console.error("Failed to save employee:", error);
              alert(
                `Failed to save employee: ${
                  error.message || "Please try again."
                }`
              );
            }
          }}
        />,
        document.body
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className='flex items-start gap-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/40'>
      <div className='grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-500/10 text-blue-500'><Icon size={15}/></div>
      <div className='min-w-0 flex-1'>
        <div className='text-[11px] text-slate-500'>{label}</div>
        <div className={`whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-200 ${mono ? 'font-mono' : ''}`}>{value || 'Not provided'}</div>
      </div>
    </div>
  );
}

function CustomerTeamCard({ employee, month, customerName, currentUser }) {
  const [downloading, setDownloading] = useState(false);
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className='card relative overflow-hidden p-4'>
      <div className='absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'/>
      <div className='flex items-center gap-3'>
        {employee.avatar ? <img src={employee.avatar} alt={employee.name} className='h-12 w-12 rounded-xl border border-blue-500/40 object-cover'/> : <div className='grid h-12 w-12 place-items-center rounded-xl bg-blue-600 font-bold text-white'>{employee.name?.charAt(0) || '?'}</div>}
        <div className='min-w-0'><div className='truncate font-semibold text-slate-100'>{employee.name}</div><div className='truncate text-xs text-slate-400'>{employee.role || 'Dedicated editor'}</div></div>
      </div>
      <div className='mt-4 grid grid-cols-2 gap-2'>
        <div className='rounded-xl bg-slate-800/50 p-3'><div className='text-xs text-slate-500'>Projects</div><div className='mt-1 text-xl font-bold text-white'>{employee.projects}</div></div>
        <div className='rounded-xl bg-slate-800/50 p-3'><div className='text-xs text-slate-500'>Quantity</div><div className='mt-1 text-xl font-bold text-white'>{employee.quantity}</div></div>
      </div>
      <div className='mt-4 flex flex-wrap items-center gap-2'>
      <DailyWorkLog employee={employee} currentUser={currentUser} todayOnly triggerLabel="Today’s Work Log"/>
      <button type='button' disabled={downloading} className='glass inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs disabled:opacity-60' onClick={async () => {
        setDownloading(true);
        try {
          const rows = await dbDailyWorkLogs.getByEmployeeAndMonth(employee.id, month);
          downloadMonthlyWorkLogPDF({ ...employee, assignedClient: customerName, retainerAssignments: [] }, month, rows);
        } catch (error) {
          alert(error.message || 'Failed to download work log.');
        } finally {
          setDownloading(false);
        }
      }}><Download size={14}/>{downloading ? 'Preparing…' : 'Monthly PDF'}</button>
      </div>
    </motion.div>
  );
}

function EmployeeDrawer({ initial, assignmentOptions = [], canManageRetainerFinance = false, onClose, onSave }) {
  const [form, setForm] = useState(
    () =>
      initial || {
        name: "",
        role: "",
        email: "",
        phone: "",
        bankName: "",
        bankAccount: "",
        street: "",
        city: "",
        state: "",
        country: "",
        zip: "",
        avatar: "",
        notes: "",
        employeeType: "project_based",
        monthlySalary: "",
        dutyHours: "",
        assignedClient: "",
        retainerAssignments: [],
      }
  );
  
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

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      // 2MB limit
      alert("Image size must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      set("avatar", reader.result);
    };
    reader.readAsDataURL(file);
  }

  function submit(e) {
    e.preventDefault();
    console.log("📝 EmployeeDrawer: submit called, form:", form);
    if (!form.name || !form.name.trim()) {
      console.warn("⚠️ EmployeeDrawer: Name is required");
      alert("Name is required");
      return;
    }
    const payload = {
      ...form,
      bankName: form.bankName || "",
      bankAccount: form.bankAccount || "",
      avatar: form.avatar || "",
      employeeType: form.employeeType || form.employee_type || "project_based",
      monthlySalary: ["retainer", "hybrid"].includes(form.employeeType || form.employee_type) ? Math.max(0, Number(form.monthlySalary ?? form.monthly_salary) || 0) : 0,
      dutyHours: ["retainer", "hybrid"].includes(form.employeeType || form.employee_type) ? (form.dutyHours || form.duty_hours || "") : "",
      assignedClient: ["retainer", "hybrid"].includes(form.employeeType || form.employee_type) ? (form.assignedClient || form.assigned_client || "") : "",
      retainerAssignments: ["retainer", "hybrid"].includes(form.employeeType || form.employee_type) && Array.isArray(form.retainerAssignments || form.retainer_assignments) ? (form.retainerAssignments || form.retainer_assignments) : [],
    };
    console.log("📦 EmployeeDrawer: Calling onSave with payload:", payload);
    onSave(payload);
  }
  return (
    <div className='fixed inset-0 z-[2147483647] flex items-start sm:items-center justify-center p-0 sm:p-2 md:p-0 overflow-y-auto' role='dialog' aria-modal='true' aria-labelledby='employee-drawer-title'>
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm md:bg-black/20' onClick={onClose} />
      <div className='relative w-full max-w-md min-h-full md:min-h-0 md:h-auto md:max-h-[90vh] glass rounded-none md:rounded-xl md:rounded-l-2xl md:rounded-r-none p-4 sm:p-4 overflow-hidden flex flex-col my-0 md:my-auto md:ml-auto'>
        <div className='flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0 sticky top-0 bg-transparent z-10 pb-2'>
          <div id='employee-drawer-title' className='text-base sm:text-lg font-semibold'>
            {initial ? "Edit Employee" : "Add Employee"}
          </div>
          <button
            type='button'
            aria-label='Close employee form'
            className='glass p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center'
            onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className='grid gap-3 overflow-y-auto flex-1 scrollbar-thin pb-safe'>
          <div>
            <label className='text-xs text-slate-500'>Name</label>
            <input
              className='glass w-full px-3 py-2 rounded-xl'
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>
          <div>
            <label className='text-xs text-slate-500'>
              Profile Photo / Avatar
            </label>
            <div className='flex items-center gap-3'>
              {form.avatar && (
                <div className='w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 flex-shrink-0'>
                  <img
                    src={form.avatar}
                    alt='Avatar'
                    className='w-full h-full object-cover'
                  />
                </div>
              )}
              <label className='flex-1 cursor-pointer'>
                <input
                  type='file'
                  accept='image/*'
                  onChange={handleImageUpload}
                  className='hidden'
                />
                <div className='glass w-full px-3 py-2 rounded-xl flex items-center justify-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors'>
                  {form.avatar ? "Change Photo" : "Upload Photo"}
                </div>
              </label>
              {form.avatar && (
                <button
                  type='button'
                  onClick={() => set("avatar", "")}
                  className='btn btn-secondary px-3 py-2 text-xs'>
                  Remove
                </button>
              )}
            </div>
          </div>
          <div>
            <label className='text-xs text-slate-500'>Role</label>
            <input
              className='glass w-full px-3 py-2 rounded-xl'
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
            />
          </div>
          <div>
            <label className='text-xs text-slate-500'>Employee Type</label>
            <select
              className='glass w-full px-3 py-2 rounded-xl min-h-[44px]'
              value={form.employeeType || form.employee_type || "project_based"}
              onChange={(e) => set("employeeType", e.target.value)}>
              <option value='project_based'>Project-Based Employee</option>
              <option value='retainer'>Permanent / Retainer Employee</option>
              <option value='hybrid'>Permanent + Project-Based Employee</option>
            </select>
          </div>
          {["retainer", "hybrid"].includes(form.employeeType || form.employee_type) && (
            <div className='grid gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3'>
              {canManageRetainerFinance && <div>
                <label className='text-xs text-slate-500'>Fixed Monthly Salary (PKR)</label>
                <input
                  className='glass w-full px-3 py-2 rounded-xl'
                  type='number'
                  min='0'
                  step='1'
                  required
                  value={form.monthlySalary ?? form.monthly_salary ?? ""}
                  onChange={(e) => set("monthlySalary", e.target.value)}
                />
              </div>}
              <div>
                <label className='text-xs text-slate-500'>Working Hours / Duty Time</label>
                <input
                  className='glass w-full px-3 py-2 rounded-xl'
                  value={form.dutyHours || form.duty_hours || ""}
                  onChange={(e) => set("dutyHours", e.target.value)}
                  placeholder='e.g. 9:00 AM – 6:00 PM'
                />
              </div>
              {canManageRetainerFinance && <div>
                <label className='text-xs text-slate-500'>Customer / Profile / Brand / Agency Assignments</label>
                <p className='mb-2 text-[11px] text-slate-500'>Select one or more accounts, then set allocated hours and the monthly retainer paid to the company.</p>
                <div className='grid max-h-64 gap-2 overflow-y-auto pr-1'>
                  {assignmentOptions.map((option) => {
                    const assignments = Array.isArray(form.retainerAssignments || form.retainer_assignments) ? (form.retainerAssignments || form.retainer_assignments) : [];
                    const index = assignments.findIndex(item => item.entityType === option.entityType && String(item.entityId) === String(option.entityId));
                    const assignment = index >= 0 ? assignments[index] : null;
                    const updateAssignment = (changes) => set('retainerAssignments', assignments.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item));
                    return <div key={`${option.entityType}-${option.entityId}`} className='rounded-xl bg-slate-800/50 p-2'>
                      <label className='flex min-h-9 cursor-pointer items-center gap-2'>
                        <input type='checkbox' checked={Boolean(assignment)} onChange={(event) => set('retainerAssignments', event.target.checked ? [...assignments, { ...option, dailyHours: 4, monthlyRevenue: 0, currency: 'USD' }] : assignments.filter((_, itemIndex) => itemIndex !== index))}/>
                        <span className='min-w-0 flex-1 truncate text-sm text-slate-200'>{option.name}</span>
                        <span className='text-[10px] text-slate-500'>{option.group}</span>
                      </label>
                      {assignment && <div className='mt-2 grid grid-cols-3 gap-2'>
                        <label className='text-[10px] text-slate-500'>Hours/day<input className='glass mt-1 h-9 w-full rounded-lg px-2 text-sm' type='number' min='0.25' max='24' step='0.25' value={assignment.dailyHours} onChange={(event) => updateAssignment({ dailyHours: Math.max(0.25, Number(event.target.value) || 0.25) })}/></label>
                        <label className='col-span-1 text-[10px] text-slate-500'>Monthly fee<input className='glass mt-1 h-9 w-full rounded-lg px-2 text-sm' type='number' min='0' step='0.01' value={assignment.monthlyRevenue} onChange={(event) => updateAssignment({ monthlyRevenue: Math.max(0, Number(event.target.value) || 0) })}/></label>
                        <label className='text-[10px] text-slate-500'>Currency<select className='glass mt-1 h-9 w-full rounded-lg px-2 text-sm' value={assignment.currency || 'USD'} onChange={(event) => updateAssignment({ currency: event.target.value })}><option>USD</option><option>PKR</option></select></label>
                      </div>}
                    </div>;
                  })}
                  {assignmentOptions.length === 0 && <div className='text-xs text-amber-300'>Add profiles, brands, agencies, or customer companies in Setup/Users first.</div>}
                </div>
              </div>}
            </div>
          )}
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3'>
            <div>
              <label className='text-xs text-slate-500'>Email</label>
              <input
                className='glass w-full px-3 py-2 rounded-xl'
                value={form.email || ""}
                onChange={(e) => set("email", e.target.value)}
              />
            </div>
            <div>
              <label className='text-xs text-slate-500'>Phone</label>
              <input
                className='glass w-full px-3 py-2 rounded-xl'
                value={form.phone || ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3'>
            <div>
              <label className='text-xs text-slate-500'>Bank name</label>
              <input
                className='glass w-full px-3 py-2 rounded-xl'
                value={form.bankName || ""}
                onChange={(e) => set("bankName", e.target.value)}
              />
            </div>
            <div>
              <label className='text-xs text-slate-500'>
                Bank account number
              </label>
              <input
                className='glass w-full px-3 py-2 rounded-xl'
                value={form.bankAccount || ""}
                onChange={(e) => set("bankAccount", e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className='text-xs text-slate-500'>Street Address</label>
            <input
              className='glass w-full px-3 py-2 rounded-xl'
              value={form.street || ""}
              onChange={(e) => set("street", e.target.value)}
              placeholder='Street address'
            />
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3'>
            <div>
              <label className='text-xs text-slate-500'>City</label>
              <input
                className='glass w-full px-3 py-2 rounded-xl'
                value={form.city || ""}
                onChange={(e) => set("city", e.target.value)}
                placeholder='City'
              />
            </div>
            <div>
              <label className='text-xs text-slate-500'>State/Province</label>
              <input
                className='glass w-full px-3 py-2 rounded-xl'
                value={form.state || ""}
                onChange={(e) => set("state", e.target.value)}
                placeholder='State'
              />
            </div>
          </div>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3'>
            <div>
              <label className='text-xs text-slate-500'>Country</label>
              <input
                className='glass w-full px-3 py-2 rounded-xl'
                value={form.country || ""}
                onChange={(e) => set("country", e.target.value)}
                placeholder='Country'
              />
            </div>
            <div>
              <label className='text-xs text-slate-500'>ZIP/Postal Code</label>
              <input
                className='glass w-full px-3 py-2 rounded-xl'
                value={form.zip || ""}
                onChange={(e) => set("zip", e.target.value)}
                placeholder='ZIP Code'
              />
            </div>
          </div>
          <div>
            <label className='text-xs text-slate-500'>Notes</label>
            <textarea
              className='glass w-full px-3 py-2 rounded-xl'
              rows={3}
              value={form.notes || ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
          <div className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800'>
            <button className='btn btn-primary flex-1 sm:flex-none' type='submit'>
              Save
            </button>
            <button
              type='button'
              className='btn btn-secondary flex-1 sm:flex-none'
              onClick={onClose}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
