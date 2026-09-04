/**
 * Custom hooks for role-based data filtering
 */

import { useMemo } from 'react';
import { useAppStore } from "../stores/appStore.js";
import { ROLES, PERMISSIONS, hasPermission, normalizeRoles, hasRole } from '../utils/permissions.js';

/**
 * Filter projects based on user role
 */
export function useFilteredProjects() {
  const { projects, employees, user } = useAppStore();

  return useMemo(() => {
    if (!user || !user.role) return projects;
    
    const roles = normalizeRoles(user.role);
    if (roles.length === 0) return [];

    // If user has ADMIN or MANAGER role, see all projects
    if (hasRole(roles, [ROLES.ADMIN, ROLES.MANAGER])) {
        return projects;
    }

    // For multiple roles, combine results (union of all matching projects)
    const matchingProjects = new Set();
    
    // If user has TEAM_LEAD role, include projects in their service category
    if (hasRole(roles, ROLES.TEAM_LEAD)) {
      if (user.service) {
        projects.filter(p => p.service === user.service).forEach(p => matchingProjects.add(p.id));
      }
    }

    // If user has EMPLOYEE role, include projects assigned to them
    if (hasRole(roles, ROLES.EMPLOYEE)) {
      const normalizeIdentity = (value) => String(value || '').trim().toLowerCase();
      const employeeIdentities = new Set(
        [user.id, user.userId, user.user_id, user.name]
          .map(normalizeIdentity)
          .filter(Boolean)
      );
      employees.forEach((employee) => {
        const employeeName = normalizeIdentity(employee?.name || employee?.employee_name);
        if (employeeName && employeeIdentities.has(employeeName)) {
          [employee.id, employee.name, employee.employee_name]
            .map(normalizeIdentity)
            .filter(Boolean)
            .forEach((identity) => employeeIdentities.add(identity));
        }
      });

      projects.filter((project) => {
        let assigned = project.assigned;
        if (typeof assigned === 'string') {
          try {
            assigned = JSON.parse(assigned);
          } catch {
            assigned = [];
          }
        }
        if (!Array.isArray(assigned)) return false;

        return assigned.some((assignee) =>
          [assignee?.employeeId, assignee?.employee_id, assignee?.id, assignee?.name]
            .map(normalizeIdentity)
            .filter(Boolean)
            .some((identity) => employeeIdentities.has(identity))
        );
      }).forEach(project => matchingProjects.add(project.id));
    }

    // If user has CLIENT role, include their own projects
    if (hasRole(roles, ROLES.CLIENT)) {
      if (user.userId || user.user_id || user.name) {
        const userId = user.userId || user.user_id || user.name || '';
        projects.filter(p => {
          // Handle both camelCase and snake_case field names
          const clientName = p.clientName || p.client_name || '';
          const agencyId = p.agencyId || p.agency_id;
          const brandId = p.brandId || p.brand_id;
          const profileId = p.profileId || p.profile_id;
          
          // Match by client name or brand/agency/profile ID
          return clientName.toLowerCase() === userId.toLowerCase() ||
                 String(brandId || '') === String(userId) ||
                 String(agencyId || '') === String(userId) ||
                 String(profileId || '') === String(userId);
        }).forEach(p => matchingProjects.add(p.id));
      }
    }

    // Return unique projects that match any of the user's roles
    return projects.filter(p => matchingProjects.has(p.id));
  }, [projects, employees, user]);
}

/**
 * Filter employees based on user role
 * Admin and Manager see all employees
 * Other users see only their own card (matched by Employee ID/Name)
 */
export function useFilteredEmployees() {
  const { employees, user, userRole } = useAppStore();

  return useMemo(() => {
    if (!user || !user.role) return [];
    
    const roles = normalizeRoles(user.role);
    if (roles.length === 0) return [];

    // If user has ADMIN or MANAGER role, see all employees
    if (hasRole(roles, [ROLES.ADMIN, ROLES.MANAGER])) {
        return employees;
    }

    // For other roles (TEAM_LEAD, EMPLOYEE, CLIENT), see only their own employee card
    // Match by user_id (Employee ID/Name) with employee name
    if (!user.userId && !user.user_id) return [];
    
    const userId = user.userId || user.user_id || '';
    if (!userId) return [];
    
    // Find employee card that matches the user's Employee ID/Name
    const ownEmployee = employees.find(emp => {
      const empName = emp.name || emp.employee_name || '';
      // Match by exact name or case-insensitive match
      return empName === userId || 
             empName.toLowerCase() === userId.toLowerCase() ||
             emp.id === userId;
    });
    
    return ownEmployee ? [ownEmployee] : [];
  }, [employees, user]);
}

/**
 * Filter profiles/agencies/brands based on user role
 */
export function useFilteredClients() {
  const { profiles, agencies, brands, user, userRole } = useAppStore();

  return useMemo(() => {
    if (!user || !user.role) {
      return { profiles, agencies, brands };
    }

    const roles = normalizeRoles(user.role);
    if (roles.length === 0) return { profiles: [], agencies: [], brands: [] };

    // If user has ADMIN or MANAGER role, see all clients
    if (hasRole(roles, [ROLES.ADMIN, ROLES.MANAGER])) {
        return { profiles, agencies, brands };
    }

        // Team Lead, Employee, and Client don't see client list
        return { profiles: [], agencies: [], brands: [] };
  }, [profiles, agencies, brands, user]);
}

/**
 * Check if user can view finance data
 */
export function useCanViewFinance() {
  const { user } = useAppStore();
  return useMemo(() => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.VIEW_FINANCE);
  }, [user]);
}

/**
 * Check if user can view finance details (costs, profits)
 */
export function useCanViewFinanceDetails() {
  const { user } = useAppStore();
  return useMemo(() => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.VIEW_FINANCE_DETAILS);
  }, [user]);
}

/**
 * Check if user can edit projects
 */
export function useCanEditProjects() {
  const { user } = useAppStore();
  return useMemo(() => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.EDIT_PROJECTS);
  }, [user]);
}

/**
 * Check if user can create projects
 */
export function useCanCreateProjects() {
  const { user } = useAppStore();
  return useMemo(() => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.CREATE_PROJECTS);
  }, [user]);
}

/**
 * Check if user can delete projects
 */
export function useCanDeleteProjects() {
  const { user } = useAppStore();
  return useMemo(() => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.DELETE_PROJECTS);
  }, [user]);
}

/**
 * Check if user can assign projects
 */
export function useCanAssignProjects() {
  const { user } = useAppStore();
  return useMemo(() => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.ASSIGN_PROJECTS);
  }, [user]);
}

/**
 * Check if user can view activity logs
 */
export function useCanViewActivityLogs() {
  const { user } = useAppStore();
  return useMemo(() => {
    if (!user || !user.role) return false;
    return hasPermission(user.role, PERMISSIONS.VIEW_ACTIVITY_LOGS);
  }, [user]);
}
