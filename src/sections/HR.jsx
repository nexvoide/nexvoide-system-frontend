import React, { useMemo, useState, useEffect } from "react";
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
import { hasPermission, PERMISSIONS } from "../utils/permissions.js";
import { belongsToBalanceMonth, toYearMonth } from "../utils/projectMonth.js";
import { isProjectActiveInMonth } from "../utils/subscriptionBilling.js";

export default function HR() {
  const {
    addEmployee,
    updateEmployee,
    deleteEmployee,
    currency,
    rate,
    loading,
    userRole,
    activeMonth,
    refreshEmployees,
    employees: allEmployees,
    timeEntries,
    user,
  } = useAppStore();
  const employees = useFilteredEmployees(); // Use filtered employees based on role
  const projects = useFilteredProjects(); // Use filtered projects based on role
  const [refreshing, setRefreshing] = useState(false);

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

  // Don't refresh on mount - data already loaded in initialize()
  // Only refresh if explicitly needed (e.g., after create/update)

  // Ensure employees is always an array
  const safeEmployees = Array.isArray(employees) ? employees : [];
  const safeProjects = Array.isArray(projects) ? projects : [];

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

  const normalizeStatus = (status) => {
    const raw = String(status || "").trim().toLowerCase();
    if (!raw) return "";
    if (raw === "complete" || raw === "completed" || raw === "done") return "completed";
    if (raw === "revision" || raw === "revising") return "revision";
    return raw;
  };

  const stats = useMemo(() => {
    const normalizeYearMonth = (value) => {
      const raw = String(value || "").trim();
      if (/^\d{4}-\d{2}$/.test(raw)) return raw;
      if (/^\d{4}-\d{1}$/.test(raw)) {
        const [year, month] = raw.split("-");
        return `${year}-${month.padStart(2, "0")}`;
      }
      const parsed = toYearMonth(raw);
      if (parsed) return parsed;
      return toYearMonth(new Date().toISOString());
    };
    const selectedMonth = normalizeYearMonth(activeMonth);
    const currentMonth = normalizeYearMonth(activeMonth);
    const [selectedYear, selectedMonthNumber] = String(selectedMonth || "")
      .split("-")
      .map((part) => Number(part));
    const parseOvertime = (value) => {
      if (value === true || value === 1) return true;
      const raw = String(value ?? "").trim().toLowerCase();
      return raw === "true" || raw === "1" || raw === "yes";
    };
    const map = new Map();
    // Initialize map with all employees - handle both camelCase and snake_case
    for (const emp of safeEmployees) {
      const empName = emp.name || emp.employee_name || "Unknown Employee";
      map.set(empName, {
        projects: 0,
        revisions: 0,
        payout: 0,
        payoutPKR: 0,
        subscriptionHours: 0,
        subscriptionAssignedBaseHours: 0,
        subscriptionBasePayoutPKR: 0,
        subscriptionExtraHours: 0,
        subscriptionExtraPayoutPKR: 0,
        subscriptionPayoutPKR: 0,
        quantity: 0,
        revisionQuantity: 0,
        service: null,
      });
    }
    for (const p of safeProjects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      
      const belongsToMonth = belongsToBalanceMonth(p, selectedMonth, currentMonth);

      if (!belongsToMonth) continue;
      if (normalizeStatus(p.status) !== "completed") continue;
      const assignedArray = ensureAssigned(p.assigned);
      const projectQuantity = Number(p.quantity) || 0;
      const revisionQty = Number(p.revisionQuantity) || 0;
      const isRevision = p.isRevision || normalizeStatus(p.status) === "revision";
      // For revisions, use revisionQuantity if available, otherwise use quantity
      const quantityToUse =
        isRevision && revisionQty > 0 ? revisionQty : projectQuantity;
      for (const a of assignedArray) {
        // Compute payout both in display currency and in PKR (PKR is authoritative for employee payouts)
        const orderDisplay = convert(p.amount || 0, p.currency, currency, rate);
        const orderPKR = convert(p.amount || 0, p.currency, "PKR", rate);
        let costDisplay = 0;
        let costPKR = 0;
        if (a.costType === "percentage") {
          const pct = (Number(a.costValue) || 0) / 100;
          costDisplay = orderDisplay * pct;
          costPKR = orderPKR * pct;
        } else {
          costDisplay = convert(a.costValue || 0, "PKR", currency, rate);
          costPKR = Number(a.costValue) || 0;
        }
        const prev = map.get(a.name) || {
          projects: 0,
          revisions: 0,
          payout: 0,
          payoutPKR: 0,
          subscriptionHours: 0,
          subscriptionExtraHours: 0,
          subscriptionExtraPayoutPKR: 0,
          subscriptionPayoutPKR: 0,
          quantity: 0,
          revisionQuantity: 0,
          service: null,
        };
        map.set(a.name, {
          projects: prev.projects + (isRevision ? 0 : 1), // Only count as new project if NOT a revision
          revisions: prev.revisions + (isRevision ? 1 : 0),
          payout: prev.payout + costDisplay,
          payoutPKR: prev.payoutPKR + costPKR,
          subscriptionHours: prev.subscriptionHours,
        subscriptionAssignedBaseHours: prev.subscriptionAssignedBaseHours,
          subscriptionExtraHours: prev.subscriptionExtraHours,
          subscriptionExtraPayoutPKR: prev.subscriptionExtraPayoutPKR,
          quantity: prev.quantity + (isRevision ? 0 : projectQuantity), // Only add to quantity if not a revision
          revisionQuantity:
            prev.revisionQuantity + (isRevision ? quantityToUse : 0), // Add revision quantity for revisions
          subscriptionPayoutPKR: prev.subscriptionPayoutPKR,
          service: p.service || prev.service,
        });
      }
    }

    const projectById = new Map(
      safeProjects.map((p) => [String(p.id), p])
    );
    for (const entry of Array.isArray(timeEntries) ? timeEntries : []) {
      const projectId = String(entry.projectId || entry.project_id || "");
      const employeeId = String(entry.employeeId || entry.employee_id || "");
      const project = projectById.get(projectId);
      if (!project) continue;
      if (String(project.billingModel || project.billing_model || "project") !== "subscription") continue;
      const employee = safeEmployees.find((e) => String(e.id) === employeeId);
      if (!employee) continue;
      const entryDate = new Date(entry.entryDate || entry.entry_date || "");
      const belongsToMonth = belongsToBalanceMonth(project, selectedMonth, currentMonth);
      if (!belongsToMonth) {
        if (Number.isNaN(entryDate.getTime())) continue;
        const entryMonth = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, "0")}`;
        if (entryMonth !== selectedMonth) continue;
      }
      const empName = employee.name || employee.employee_name || "Unknown Employee";
      const hours = Number(entry.hours) || 0;
      const isOvertime = parseOvertime(entry.isOvertime ?? entry.is_overtime);
      const overtimeRate = Number(project.employeeExtraHourRatePkr || project.employee_extra_hour_rate_pkr || 0);
      const includeInMonthlyPayout = normalizeStatus(project.status) === "completed";
      const prev = map.get(empName) || {
        projects: 0,
        revisions: 0,
        payout: 0,
        payoutPKR: 0,
        subscriptionHours: 0,
        subscriptionAssignedBaseHours: 0,
        subscriptionBasePayoutPKR: 0,
        subscriptionExtraHours: 0,
        subscriptionExtraPayoutPKR: 0,
        subscriptionPayoutPKR: 0,
        quantity: 0,
        revisionQuantity: 0,
        service: null,
      };
      map.set(empName, {
        ...prev,
        payoutPKR: prev.payoutPKR + (includeInMonthlyPayout && isOvertime ? (hours * overtimeRate) : 0),
        subscriptionHours: prev.subscriptionHours + hours,
        subscriptionAssignedBaseHours: prev.subscriptionAssignedBaseHours,
        subscriptionBasePayoutPKR: prev.subscriptionBasePayoutPKR,
        subscriptionExtraHours: prev.subscriptionExtraHours + (isOvertime ? hours : 0),
        subscriptionExtraPayoutPKR: prev.subscriptionExtraPayoutPKR + (isOvertime ? (hours * overtimeRate) : 0),
        subscriptionPayoutPKR: prev.subscriptionPayoutPKR + (isOvertime ? (hours * overtimeRate) : 0),
      });
    }

    // Add subscription monthly base payout once per active subscription project.
    // Priority: split among employees who logged time in that month; fallback to assigned names.
    for (const project of safeProjects) {
      if (project.archived === true) continue;
      if (String(project.billingModel || project.billing_model || "project") !== "subscription") continue;
      if (!selectedYear || !selectedMonthNumber) continue;
      const belongsToMonth = belongsToBalanceMonth(project, selectedMonth, currentMonth);
      const activeByDate = isProjectActiveInMonth(project, selectedYear, selectedMonthNumber);
      if (!belongsToMonth && !activeByDate) continue;
      const configuredBasePayoutPkr = Number(project.employeeMonthlyBasePayoutPkr || project.employee_monthly_base_payout_pkr || 0);
      const fallbackBaseFromCustomerPkr = convert(
        Number(project.monthlyBasePrice || project.monthly_base_price || project.amount || 0),
        project.currency || "USD",
        "PKR",
        rate
      );
      const basePayoutPkr = configuredBasePayoutPkr > 0 ? configuredBasePayoutPkr : fallbackBaseFromCustomerPkr;
      const includedHours = Number(project.monthlyIncludedHours || project.monthly_included_hours || 0);
      if (basePayoutPkr <= 0) continue;
      const projectId = String(project.id || "");
      const entryEmployeeIds = new Set(
        (Array.isArray(timeEntries) ? timeEntries : [])
          .filter((entry) => {
            const pid = String(entry.projectId || entry.project_id || "");
            if (pid !== projectId) return false;
            const d = new Date(entry.entryDate || entry.entry_date || "");
            if (Number.isNaN(d.getTime())) return false;
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            return ym === selectedMonth;
          })
          .map((entry) => String(entry.employeeId || entry.employee_id || ""))
          .filter(Boolean)
      );

      let recipients = [];
      if (entryEmployeeIds.size > 0) {
        recipients = safeEmployees
          .filter((employee) => entryEmployeeIds.has(String(employee.id)))
          .map((employee) => employee.name || employee.employee_name || "")
          .filter(Boolean);
      } else {
        recipients = ensureAssigned(project.assigned)
          .map((assigned) => assigned?.name || "")
          .filter(Boolean);
      }
      if (!recipients.length) continue;

      const perEmployeeBase = basePayoutPkr / recipients.length;
      const perEmployeeBaseHours = includedHours > 0 ? (includedHours / recipients.length) : 0;
      const includeInMonthlyPayout = normalizeStatus(project.status) === "completed";
      for (const assignedName of recipients) {
        const prev = map.get(assignedName) || {
          projects: 0,
          revisions: 0,
          payout: 0,
          payoutPKR: 0,
          subscriptionHours: 0,
          subscriptionAssignedBaseHours: 0,
          subscriptionBasePayoutPKR: 0,
          subscriptionExtraHours: 0,
          subscriptionExtraPayoutPKR: 0,
          subscriptionPayoutPKR: 0,
          quantity: 0,
          revisionQuantity: 0,
          service: null,
        };
        map.set(assignedName, {
          ...prev,
          payoutPKR: prev.payoutPKR + (includeInMonthlyPayout ? perEmployeeBase : 0),
          subscriptionAssignedBaseHours: prev.subscriptionAssignedBaseHours + perEmployeeBaseHours,
          subscriptionBasePayoutPKR: prev.subscriptionBasePayoutPKR + perEmployeeBase,
          subscriptionPayoutPKR: prev.subscriptionPayoutPKR + perEmployeeBase,
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
        projects: (map.get(empName) || { projects: 0 }).projects,
        revisions: (map.get(empName) || { revisions: 0 }).revisions,
        payout: (map.get(empName) || { payout: 0 }).payout,
        payoutPKR: (map.get(empName) || { payoutPKR: 0 }).payoutPKR,
        subscriptionHours: (map.get(empName) || { subscriptionHours: 0 }).subscriptionHours,
        subscriptionBaseHours: (map.get(empName) || { subscriptionAssignedBaseHours: 0 }).subscriptionAssignedBaseHours,
        subscriptionBasePayoutPKR: Math.max(
          (map.get(empName) || { subscriptionBasePayoutPKR: 0 }).subscriptionBasePayoutPKR,
          Math.max(
            0,
            (map.get(empName) || { subscriptionPayoutPKR: 0 }).subscriptionPayoutPKR -
              (map.get(empName) || { subscriptionExtraPayoutPKR: 0 }).subscriptionExtraPayoutPKR
          )
        ),
        subscriptionExtraHours: (map.get(empName) || { subscriptionExtraHours: 0 }).subscriptionExtraHours,
        subscriptionExtraPayoutPKR: (map.get(empName) || { subscriptionExtraPayoutPKR: 0 }).subscriptionExtraPayoutPKR,
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
  }, [safeEmployees, safeProjects, timeEntries, currency, rate, sortKey, activeMonth]);

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
          displayed.map((r, index) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className='card group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 relative overflow-hidden'>
            {/* Gradient accent bar */}
            <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500'></div>

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
              </div>
            </div>

            {/* Payout Section - Highlighted */}
            <div className='mb-4 p-4 rounded-2xl bg-gradient-to-br from-blue-500/15 via-purple-500/15 to-pink-500/15 border border-blue-500/20 dark:border-blue-500/30 backdrop-blur-sm'>
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
              {r.payoutPKR > 0 && (
                <div className='flex items-center gap-1 mt-2 text-xs text-slate-500'>
                  <TrendingUp size={12} className='text-green-500' />
                  <span>Active this month</span>
                </div>
              )}
            </div>

            {(r.subscriptionBaseHours > 0 || r.subscriptionExtraHours > 0 || r.subscriptionBasePayoutPKR > 0) && (
              <div className='mb-4 p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30'>
                <div className='text-xs uppercase tracking-wide text-emerald-300 mb-2 font-semibold'>Subscription Hours</div>
                <div className='grid grid-cols-4 gap-2 text-xs'>
                  <div className='rounded-lg bg-slate-900/30 p-2'>
                    <div className='text-slate-400'>Hours</div>
                    <div className='text-white font-semibold'>{Number(r.subscriptionBaseHours || 0).toFixed(2)}</div>
                  </div>
                    <div className='rounded-lg bg-slate-900/30 p-2'>
                      <div className='text-slate-400'>Base Pay</div>
                      <div className='text-cyan-300 font-semibold'>
                        {new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(r.subscriptionBasePayoutPKR || 0)} PKR
                      </div>
                    </div>
                    <div className='rounded-lg bg-slate-900/30 p-2'>
                    <div className='text-slate-400'>Extra</div>
                    <div className='text-amber-300 font-semibold'>{Number(r.subscriptionExtraHours || 0).toFixed(2)}</div>
                  </div>
                  <div className='rounded-lg bg-slate-900/30 p-2'>
                    <div className='text-slate-400'>Extra Pay</div>
                    <div className='text-emerald-300 font-semibold'>
                      {new Intl.NumberFormat("en", { maximumFractionDigits: 0 }).format(r.subscriptionExtraPayoutPKR || 0)} PKR
                    </div>
                  </div>
                </div>
              </div>
            )}

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

            {/* Address Info */}
            {(r.street || r.city || r.state || r.country || r.zip) && (
              <div className='pt-4 border-t border-slate-200/30 dark:border-slate-700/30 space-y-2'>
                <div className='flex items-start gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors'>
                  <div className='w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0'>
                    <MapPin size={14} className='text-indigo-500' />
                  </div>
                  <div className='flex-1 min-w-0'>
                    <div className='text-xs text-slate-400 mb-0.5'>Address</div>
                    <div className='text-sm text-slate-700 dark:text-slate-300'>
                      {r.street && <div>{r.street}</div>}
                      {(r.city || r.state || r.zip) && (
                        <div>
                          {[r.city, r.state, r.zip].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {r.country && <div>{r.country}</div>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Contact & Bank Info */}
            {(r.email || r.phone || r.bankName || r.bankAccount) && (
              <div className='pt-4 border-t border-slate-200/30 dark:border-slate-700/30 space-y-2'>
                {r.email && (
                  <div className='flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors'>
                    <div className='w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0'>
                      <Mail size={14} className='text-blue-500' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='text-xs text-slate-400 mb-0.5'>Email</div>
                      <div className='text-sm text-slate-700 dark:text-slate-300 truncate font-medium'>
                        {r.email}
                      </div>
                    </div>
                  </div>
                )}
                {r.phone && (
                  <div className='flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors'>
                    <div className='w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0'>
                      <Phone size={14} className='text-green-500' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='text-xs text-slate-400 mb-0.5'>Phone</div>
                      <div className='text-sm text-slate-700 dark:text-slate-300 font-medium'>
                        {r.phone}
                      </div>
                    </div>
                  </div>
                )}
                {r.bankName && (
                  <div className='flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors'>
                    <div className='w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0'>
                      <Building2 size={14} className='text-purple-500' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='text-xs text-slate-400 mb-0.5'>Bank</div>
                      <div className='text-sm text-slate-700 dark:text-slate-300 truncate font-medium'>
                        {r.bankName}
                      </div>
                    </div>
                  </div>
                )}
                {r.bankAccount && (
                  <div className='flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors'>
                    <div className='w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0'>
                      <CreditCard size={14} className='text-pink-500' />
                    </div>
                    <div className='flex-1 min-w-0'>
                      <div className='text-xs text-slate-400 mb-0.5'>
                        Account
                      </div>
                      <div className='text-sm text-slate-700 dark:text-slate-300 font-mono font-medium'>
                        {r.bankAccount}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className='mt-5 pt-4 border-t border-slate-200/30 dark:border-slate-700/30 flex justify-between items-center'>
              <button
                className='glass px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:bg-green-500/15 hover:text-green-400 transition-colors'
                onClick={() => {
                  try {
                    // Always use PKR for salary PDFs
                    generateSalaryPDF(r, safeProjects, "PKR", rate);
                  } catch (e) {
                    console.error("Failed to generate salary PDF:", e);
                    alert("Failed to generate PDF.");
                  }
                }}>
                <Download size={14} />
                Salary PDF
              </button>
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

      {open && (
        <EmployeeDrawer
          initial={editing}
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
        />
      )}
    </div>
  );
}

function EmployeeDrawer({ initial, onClose, onSave }) {
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
    };
    console.log("📦 EmployeeDrawer: Calling onSave with payload:", payload);
    onSave(payload);
  }
  return (
    <div className='fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-2 md:p-0 overflow-y-auto'>
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm md:bg-black/20' onClick={onClose} />
      <div className='relative w-full max-w-md min-h-full md:min-h-0 md:h-auto md:max-h-[90vh] glass rounded-none md:rounded-xl md:rounded-l-2xl md:rounded-r-none p-4 sm:p-4 overflow-hidden flex flex-col my-0 md:my-auto md:ml-auto'>
        <div className='flex items-center justify-between mb-3 sm:mb-4 flex-shrink-0 sticky top-0 bg-transparent z-10 pb-2'>
          <div className='text-base sm:text-lg font-semibold'>
            {initial ? "Edit Employee" : "Add Employee"}
          </div>
          <button
            type='button'
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
