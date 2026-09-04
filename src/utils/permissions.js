/**
 * Role-Based Access Control (RBAC) System
 * Defines roles, permissions, and access control logic
 */

// User Roles
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  TEAM_LEAD: 'teamlead',
  EMPLOYEE: 'employee',
  CLIENT: 'client'
};

// Role Colors
export const ROLE_COLORS = {
  [ROLES.ADMIN]: 'blue',
  [ROLES.MANAGER]: 'violet',
  [ROLES.TEAM_LEAD]: 'green',
  [ROLES.EMPLOYEE]: 'gray',
  [ROLES.CLIENT]: 'gold'
};

// Role Labels
export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Admin',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
  [ROLES.EMPLOYEE]: 'Employee',
  [ROLES.CLIENT]: 'Client'
};

// Permissions Configuration
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_FULL_DASHBOARD: 'view_full_dashboard',
  VIEW_CATEGORY_DASHBOARD: 'view_category_dashboard',
  VIEW_OWN_DASHBOARD: 'view_own_dashboard',
  
  // Projects
  VIEW_PROJECTS: 'view_projects',
  VIEW_ALL_PROJECTS: 'view_all_projects',
  VIEW_CATEGORY_PROJECTS: 'view_category_projects',
  VIEW_OWN_PROJECTS: 'view_own_projects',
  CREATE_PROJECTS: 'create_projects',
  EDIT_PROJECTS: 'edit_projects',
  DELETE_PROJECTS: 'delete_projects',
  ASSIGN_PROJECTS: 'assign_projects',
  VIEW_PROJECT_COSTS: 'view_project_costs',
  
  // Team/Employees
  VIEW_TEAM: 'view_team',
  VIEW_ALL_TEAM: 'view_all_team',
  VIEW_CATEGORY_TEAM: 'view_category_team',
  VIEW_OWN_PROFILE: 'view_own_profile',
  ADD_TEAM_MEMBERS: 'add_team_members',
  EDIT_TEAM_MEMBERS: 'edit_team_members',
  DELETE_TEAM_MEMBERS: 'delete_team_members',
  
  // Finance
  VIEW_FINANCE: 'view_finance',
  VIEW_FINANCE_DETAILS: 'view_finance_details',
  EDIT_FINANCE: 'edit_finance',
  
  // Setup (Clients, Agencies, Brands)
  VIEW_SETUP: 'view_setup',
  MANAGE_CLIENTS: 'manage_clients',
  MANAGE_AGENCIES: 'manage_agencies',
  MANAGE_BRANDS: 'manage_brands',
  
  // Settings
  VIEW_SETTINGS: 'view_settings',
  EDIT_SETTINGS: 'edit_settings',
  
  // Activity Logs
  VIEW_ACTIVITY_LOGS: 'view_activity_logs',
  
  // Chat
  VIEW_CHAT: 'view_chat',
  MANAGE_CHANNELS: 'manage_channels',
  
  // Monthly Archives
  VIEW_MONTHLY_ARCHIVES: 'view_monthly_archives',
  CLOSE_MONTH: 'close_month',
};

// Role Permissions Map
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_FULL_DASHBOARD,
    PERMISSIONS.VIEW_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.EDIT_PROJECTS,
    PERMISSIONS.DELETE_PROJECTS,
    PERMISSIONS.ASSIGN_PROJECTS,
    PERMISSIONS.VIEW_PROJECT_COSTS,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.VIEW_ALL_TEAM,
    PERMISSIONS.ADD_TEAM_MEMBERS,
    PERMISSIONS.EDIT_TEAM_MEMBERS,
    PERMISSIONS.DELETE_TEAM_MEMBERS,
    PERMISSIONS.VIEW_FINANCE,
    PERMISSIONS.VIEW_FINANCE_DETAILS,
    PERMISSIONS.EDIT_FINANCE,
    PERMISSIONS.VIEW_SETUP,
    PERMISSIONS.MANAGE_CLIENTS,
    PERMISSIONS.MANAGE_AGENCIES,
    PERMISSIONS.MANAGE_BRANDS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.EDIT_SETTINGS,
    PERMISSIONS.VIEW_ACTIVITY_LOGS,
    PERMISSIONS.VIEW_CHAT,
    PERMISSIONS.MANAGE_CHANNELS,
    PERMISSIONS.VIEW_MONTHLY_ARCHIVES,
    PERMISSIONS.CLOSE_MONTH,
  ],
  
  [ROLES.MANAGER]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_FULL_DASHBOARD,
    PERMISSIONS.VIEW_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.EDIT_PROJECTS,
    PERMISSIONS.DELETE_PROJECTS,
    PERMISSIONS.ASSIGN_PROJECTS,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.VIEW_ALL_TEAM,
    PERMISSIONS.ADD_TEAM_MEMBERS,
    PERMISSIONS.EDIT_TEAM_MEMBERS,
    PERMISSIONS.DELETE_TEAM_MEMBERS,
    PERMISSIONS.VIEW_SETUP,
    PERMISSIONS.MANAGE_CLIENTS,
    PERMISSIONS.MANAGE_AGENCIES,
    PERMISSIONS.MANAGE_BRANDS,
    PERMISSIONS.VIEW_SETTINGS,
    PERMISSIONS.VIEW_ACTIVITY_LOGS,
    PERMISSIONS.VIEW_CHAT,
    PERMISSIONS.MANAGE_CHANNELS,
    // No finance access
  ],
  
  [ROLES.TEAM_LEAD]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_CATEGORY_DASHBOARD,
    PERMISSIONS.VIEW_PROJECTS,
    PERMISSIONS.VIEW_CATEGORY_PROJECTS,
    PERMISSIONS.EDIT_PROJECTS,
    PERMISSIONS.ASSIGN_PROJECTS,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.VIEW_CATEGORY_TEAM,
    PERMISSIONS.VIEW_ACTIVITY_LOGS,
    PERMISSIONS.VIEW_CHAT,
    // No finance, setup, or settings access
  ],
  
  [ROLES.EMPLOYEE]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_OWN_DASHBOARD,
    PERMISSIONS.VIEW_PROJECTS,
    PERMISSIONS.VIEW_OWN_PROJECTS,
    PERMISSIONS.VIEW_TEAM,
    PERMISSIONS.VIEW_OWN_PROFILE,
    PERMISSIONS.VIEW_CHAT,
    // No finance, setup, settings, or activity logs access
  ],
  
  [ROLES.CLIENT]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_OWN_DASHBOARD,
    PERMISSIONS.VIEW_PROJECTS,
    PERMISSIONS.VIEW_OWN_PROJECTS,
    PERMISSIONS.CREATE_PROJECTS,
    PERMISSIONS.VIEW_CHAT,
    // No finance, team, setup, settings, or activity logs access
  ],
};

// Sidebar Navigation Items
export const NAV_ITEMS = {
  dashboard: { id: 'dashboard', label: 'Dashboard', icon: 'LayoutDashboard', permission: PERMISSIONS.VIEW_DASHBOARD },
  projects: { id: 'projects', label: 'Projects', icon: 'Briefcase', permission: PERMISSIONS.VIEW_PROJECTS },
  hr: { id: 'hr', label: 'Team', icon: 'Users', permission: PERMISSIONS.VIEW_TEAM },
  finance: { id: 'finance', label: 'Finance', icon: 'Wallet', permission: PERMISSIONS.VIEW_FINANCE },
  setup: { id: 'setup', label: 'Setup', icon: 'Settings', permission: PERMISSIONS.VIEW_SETUP },
  activity: { id: 'activity', label: 'Activity Logs', icon: 'Activity', permission: PERMISSIONS.VIEW_ACTIVITY_LOGS },
  // Chat is currently in beta and the full realtime system is paused.
  // We keep the nav item visible but clearly marked as Beta / coming soon.
  chat: { id: 'chat', label: 'Chat (Beta)', icon: 'MessageSquare', permission: PERMISSIONS.VIEW_CHAT },
  users: { id: 'users', label: 'Users', icon: 'Users', permission: PERMISSIONS.VIEW_SETTINGS }, // Only admin can see this
  settings: { id: 'settings', label: 'Settings', icon: 'Settings', permission: PERMISSIONS.VIEW_SETTINGS },
  archives: { id: 'archives', label: 'Monthly Archives', icon: 'Archive', permission: PERMISSIONS.VIEW_MONTHLY_ARCHIVES },
};

/**
 * Normalize roles to array format (backward compatible with single role strings)
 * @param {string|string[]|null} roles - Single role string, array of roles, or null
 * @param {string} defaultValue - Default role to use if roles is null/empty (default: 'admin')
 * @returns {string[]} Array of role strings
 */
export function normalizeRoles(roles, defaultValue = 'admin') {
  if (!roles) return defaultValue ? [defaultValue] : [];
  if (Array.isArray(roles)) {
    const filtered = roles.filter(Boolean);
    return filtered.length > 0 ? filtered : (defaultValue ? [defaultValue] : []);
  }
  if (typeof roles === 'string') {
    // Try to parse as JSON array first (for stored multi-role format)
    try {
      const parsed = JSON.parse(roles);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter(Boolean);
        return filtered.length > 0 ? filtered : (defaultValue ? [defaultValue] : []);
      }
    } catch {
      // Not JSON, treat as single role string
    }
    return [roles];
  }
  return defaultValue ? [defaultValue] : [];
}

/**
 * Get the primary role from a user's roles (highest priority role)
 * @param {string|string[]|null} roles - Single role string, array of roles, or null
 * @param {string} defaultValue - Default role if no roles found (default: 'admin')
 * @returns {string} Primary role string
 */
export function getPrimaryRole(roles, defaultValue = 'admin') {
  const normalizedRoles = normalizeRoles(roles, defaultValue);
  if (normalizedRoles.length === 0) return defaultValue || 'admin';
  
  // Role priority (higher number = higher priority)
  const rolePriority = { 
    admin: 5, 
    manager: 4, 
    teamlead: 3, 
    employee: 2, 
    client: 1 
  };
  
  return normalizedRoles.reduce((highest, role) => {
    const currentPriority = rolePriority[role] || 0;
    const highestPriority = rolePriority[highest] || 0;
    return currentPriority > highestPriority ? role : highest;
  }, normalizedRoles[0]);
}

/**
 * Check if user has a specific permission
 * Supports both single role (backward compatible) and multiple roles
 * @param {string|string[]|null} userRole - Single role string, array of roles, or null
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has the permission
 */
export function hasPermission(userRole, permission) {
  if (!userRole || !permission) return false;
  
  const roles = normalizeRoles(userRole);
  if (roles.length === 0) return false;
  
  // Check if ANY of the user's roles has the permission
  return roles.some(role => {
    const rolePermissions = ROLE_PERMISSIONS[role];
    return rolePermissions && rolePermissions.includes(permission);
  });
}

/**
 * Check if user has any of the specified roles
 * @param {string|string[]|null} userRole - Single role string, array of roles, or null
 * @param {string|string[]} targetRoles - Single role or array of roles to check
 * @returns {boolean} True if user has any of the target roles
 */
export function hasRole(userRole, targetRoles) {
  if (!userRole || !targetRoles) return false;
  
  const userRoles = normalizeRoles(userRole);
  const targetRolesArray = normalizeRoles(targetRoles);
  
  if (userRoles.length === 0 || targetRolesArray.length === 0) return false;
  
  return userRoles.some(role => targetRolesArray.includes(role));
}

/**
 * Check if user can access a navigation item
 * Supports multiple roles
 */
export function canAccessNavItem(userRole, navItemId) {
  const navItem = NAV_ITEMS[navItemId];
  if (!navItem) return false;
  return hasPermission(userRole, navItem.permission);
}

/**
 * Get filtered navigation items based on role(s)
 * Supports multiple roles
 */
export function getFilteredNavItems(userRole) {
  return Object.values(NAV_ITEMS).filter(item => canAccessNavItem(userRole, item.id));
}

/**
 * Get role color class
 */
export function getRoleColorClass(role) {
  const color = ROLE_COLORS[role] || 'gray';
  const colorMap = {
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    violet: 'text-violet-500 bg-violet-500/10 border-violet-500/20',
    green: 'text-green-500 bg-green-500/10 border-green-500/20',
    gray: 'text-gray-500 bg-gray-500/10 border-gray-500/20',
    gold: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20',
  };
  return colorMap[color] || colorMap.gray;
}

/**
 * Get role badge component props
 */
export function getRoleBadgeProps(role) {
  const color = ROLE_COLORS[role] || 'gray';
  const colorMap = {
    blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
    violet: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', border: 'border-violet-300 dark:border-violet-700' },
    green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', border: 'border-green-300 dark:border-green-700' },
    gray: { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-700' },
    gold: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-700' },
  };
  return colorMap[color] || colorMap.gray;
}
