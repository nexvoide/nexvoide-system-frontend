import { create } from "zustand";
import * as db from "../lib/db.js";
import { logActivity, createProjectDescription, createEmployeeDescription, createEntityDescription, createSettingDescription } from "../utils/activityLogger.js";

// Helper to convert snake_case to camelCase
const toCamel = (obj) => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toCamel);
  if (typeof obj !== 'object') return obj;
  return Object.keys(obj).reduce((acc, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    let value = obj[key];
    
    // Parse assigned field if it's a JSON string
    if (key === 'assigned' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = [];
      }
    }
    
    // Parse attachments field if it's a JSON string
    if (key === 'attachments' && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        value = [];
      }
    }
    
    // Parse old_value and new_value in activity logs if they're JSON strings
    if ((key === 'old_value' || key === 'new_value') && typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        // Keep as string if parsing fails
      }
    }
    
    acc[camelKey] = toCamel(value);
    return acc;
  }, {});
};

// Helper to convert camelCase to snake_case
const toSnake = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(toSnake);
  return Object.keys(obj).reduce((acc, key) => {
    const snakeKey = key.replace(/[A-Z]/g, (letter, index) => (index === 0 ? '' : '_') + letter.toLowerCase());
    acc[snakeKey] = toSnake(obj[key]);
    return acc;
  }, {});
};

export const useAppStore = create((set, get) => ({
  currency: "USD",
  rate: 280,
  projects: [],
  employees: [],
  profiles: [],
  agencies: [],
  brands: [],
  activityLogs: [],
  allUsers: [], // All users for notification matching
  initialized: false,
  loading: false,
  // User/Role state
  user: null, // { role (string|array), name, email, service?, userId? }
  userRole: null, // Primary user role (for backward compatibility, first role or highest priority)

  // Initialize - load all data from Supabase
  async initialize() {
    if (get().initialized) return;
    // 1) Hydrate instantly from local cache (no network)
    try {
      const cachedProjects = db.dbProjects.getCached ? db.dbProjects.getCached() : [];
      const cachedEmployees = db.dbEmployees.getCached ? db.dbEmployees.getCached() : [];
      const cachedProfiles = db.dbProfiles.getCached ? db.dbProfiles.getCached() : [];
      const cachedAgencies = db.dbAgencies.getCached ? db.dbAgencies.getCached() : [];
      const cachedBrands = db.dbBrands.getCached ? db.dbBrands.getCached() : [];
      const cachedActivityLogs = db.dbActivityLogs.getCached ? db.dbActivityLogs.getCached() : [];

      set({
        projects: toCamel(Array.isArray(cachedProjects) ? cachedProjects : []),
        employees: toCamel(Array.isArray(cachedEmployees) ? cachedEmployees : []),
        profiles: toCamel(Array.isArray(cachedProfiles) ? cachedProfiles : []),
        agencies: toCamel(Array.isArray(cachedAgencies) ? cachedAgencies : []),
        brands: toCamel(Array.isArray(cachedBrands) ? cachedBrands : []),
        activityLogs: toCamel(Array.isArray(cachedActivityLogs) ? cachedActivityLogs : []),
        initialized: true,
      });
    } catch (_) {
      // ignore cache errors
    }

    // 2) Load settings and refresh from DB in background
    // Only block UI if there is no cached data at all
    try {
      const hasAnyCache = (
        (get().projects?.length || 0) +
        (get().employees?.length || 0) +
        (get().profiles?.length || 0) +
        (get().agencies?.length || 0) +
        (get().brands?.length || 0)
      ) > 0;
      if (!hasAnyCache) set({ loading: true });
    } catch (_) {}
    try {
      // Load settings first
      const [currency, rate] = await Promise.all([
        db.dbSettings.get('currency'),
        db.dbSettings.get('rate'),
      ]);
      if (currency) set({ currency });
      if (rate) set({ rate: Number(rate) || 280 });

      // Load all data sources in parallel but update state incrementally
      // This prevents one slow request from blocking the UI
      const loadPromises = [
        db.dbProjects.getAll().then(data => {
          const camel = Array.isArray(data) ? toCamel(data) : [];
          set({ projects: camel });
          if (camel.length > 0) {
            console.log('✅ Loaded projects from Supabase:', camel.length);
          }
          return camel;
        }).catch(err => {
          console.error('Failed to load projects:', err);
          return [];
        }),
        
        db.dbEmployees.getAll().then(data => {
          const camel = Array.isArray(data) ? toCamel(data) : [];
          set({ employees: camel });
          if (camel.length > 0) {
            console.log('✅ Loaded employees from Supabase:', camel.length);
          }
          return camel;
        }).catch(err => {
          console.error('Failed to load employees:', err);
          return [];
        }),
        
        db.dbProfiles.getAll().then(data => {
          const camel = Array.isArray(data) ? toCamel(data) : [];
          set({ profiles: camel });
          if (camel.length > 0) {
            console.log('✅ Loaded profiles from Supabase:', camel.length);
          }
          return camel;
        }).catch(err => {
          console.error('Failed to load profiles:', err);
          return [];
        }),
        
        db.dbAgencies.getAll().then(data => {
          const camel = Array.isArray(data) ? toCamel(data) : [];
          set({ agencies: camel });
          if (camel.length > 0) {
            console.log('✅ Loaded agencies from Supabase:', camel.length);
          }
          return camel;
        }).catch(err => {
          console.error('Failed to load agencies:', err);
          return [];
        }),
        
        db.dbBrands.getAll().then(data => {
          const camel = Array.isArray(data) ? toCamel(data) : [];
          set({ brands: camel });
          if (camel.length > 0) {
            console.log('✅ Loaded brands from Supabase:', camel.length);
          }
          return camel;
        }).catch(err => {
          console.error('Failed to load brands:', err);
          return [];
        }),
        
        db.dbActivityLogs.getAll(100).then(data => {
          const camel = Array.isArray(data) ? toCamel(data) : [];
          set({ activityLogs: camel });
          if (camel.length > 0) {
            console.log('✅ Loaded activity logs from Supabase:', camel.length);
          }
          return camel;
        }).catch(err => {
          console.error('Failed to load activity logs:', err);
          return [];
        }),
        
        db.dbUsers.getAll().then(data => {
          const camel = Array.isArray(data) ? toCamel(data) : [];
          set({ allUsers: camel });
          if (camel.length > 0) {
            console.log('✅ Loaded users from Supabase:', camel.length);
          }
          return camel;
        }).catch(err => {
          console.error('Failed to load users:', err);
          return [];
        }),
      ];

      // Wait for all to complete (but state updates happen incrementally)
      await Promise.allSettled(loadPromises);
      
      // Final state update to ensure loading is false
      set({ loading: false });
      
      // Log final summary
      const finalState = get();
      console.log('✅ All data loaded from Supabase:', {
        projects: finalState.projects?.length || 0,
        employees: finalState.employees?.length || 0,
        profiles: finalState.profiles?.length || 0,
        agencies: finalState.agencies?.length || 0,
        brands: finalState.brands?.length || 0,
      });
    } catch (error) {
      console.error('Failed to refresh from DB:', error);
      // Even on error, ensure loading is false and arrays are initialized
      set({ 
        loading: false,
        projects: Array.isArray(get().projects) ? get().projects : [],
        employees: Array.isArray(get().employees) ? get().employees : [],
        profiles: Array.isArray(get().profiles) ? get().profiles : [],
        agencies: Array.isArray(get().agencies) ? get().agencies : [],
        brands: Array.isArray(get().brands) ? get().brands : [],
      });
    }
  },

  // Refresh projects from database
  async refreshProjects() {
    try {
      console.log('🔄 Refreshing projects from database...');
      
      // Clear cache first to force fresh load from Supabase
      // This ensures we don't show stale cached projects after closing a month
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.removeItem('nexvoide_projects');
        } catch (e) {
          // Ignore cache clear errors
        }
      }
      
      const data = await db.dbProjects.getAll();
      const camel = Array.isArray(data) ? toCamel(data) : [];
      set({ projects: camel });
      
      // Log pulled-forward projects for verification
      const pulledForward = camel.filter(p => p.pulled_forward === true || p.pulledForward === true);
      console.log('✅ Refreshed projects:', camel.length, '(excluding archived)');
      console.log('  - Pulled-forward projects:', pulledForward.length);
      if (pulledForward.length > 0) {
        console.log('  - Pulled-forward project details:', pulledForward.map(p => ({
          id: p.id,
          name: p.project_name || p.projectName,
          status: p.status,
          start_date: p.start_date || p.startDate,
          pulled_forward: p.pulled_forward || p.pulledForward
        })));
      }
      
      return camel;
    } catch (error) {
      console.error('Failed to refresh projects:', error);
      throw error;
    }
  },

  // Refresh employees from database
  async refreshEmployees() {
    try {
      console.log('🔄 Refreshing employees from database...');
      const data = await db.dbEmployees.getAll();
      const camel = Array.isArray(data) ? toCamel(data) : [];
      set({ employees: camel });
      console.log('✅ Refreshed employees:', camel.length);
      return camel;
    } catch (error) {
      console.error('Failed to refresh employees:', error);
      throw error;
    }
  },

  async setCurrency(c) {
    set({ currency: c });
    await db.dbSettings.set('currency', c);
  },

  async setRate(r) {
    const rate = Number(r) || 0;
    const oldRate = get().rate;
    set({ rate });
    await db.dbSettings.set('rate', String(rate));
    
    // Log activity
    await logActivity({
      entityType: 'setting',
      entityId: 'rate',
      action: 'updated',
      description: createSettingDescription('rate', oldRate, rate),
      oldValue: { rate: oldRate },
      newValue: { rate }
    });
  },

  async addProject(p) {
    try {
      const data = toSnake({ ...p });
      const created = await db.dbProjects.create(data);
      const camel = toCamel(created);
      set({ projects: [camel, ...get().projects] });
      
      // Log activity
      await logActivity({
        entityType: 'project',
        entityId: camel.id,
        action: 'created',
        description: createProjectDescription('created', camel),
        newValue: camel
      });
      
      return camel;
    } catch (error) {
      console.error('Failed to add project:', error);
      throw error;
    }
  },

  async updateProject(id, updates) {
    try {
      // Ensure ID is a string for consistent comparison
      const projectId = String(id);
      const oldProject = get().projects.find((p) => String(p.id) === projectId);
      const data = toSnake(updates);
      const updated = await db.dbProjects.update(projectId, data);
      const camel = toCamel(updated);
      set({
        projects: get().projects.map((p) => (String(p.id) === projectId ? camel : p)),
      });
      
      // Log activity
      const action = updates.status && oldProject && updates.status !== oldProject.status ? 'status_changed' : 'updated';
      await logActivity({
        entityType: 'project',
        entityId: camel.id,
        action,
        description: createProjectDescription(action, camel, oldProject),
        oldValue: oldProject,
        newValue: camel
      });
      
      return camel;
    } catch (error) {
      console.error('Failed to update project:', error);
      alert(`Failed to save project: ${error.message || 'Please try again.'}`);
      throw error;
    }
  },

  async deleteProject(id) {
    try {
      const project = get().projects.find((p) => p.id === id);
      await db.dbProjects.delete(id);
      set({ projects: get().projects.filter((p) => p.id !== id) });
      
      // Log activity
      if (project) {
        await logActivity({
          entityType: 'project',
          entityId: String(id),
          action: 'deleted',
          description: createProjectDescription('deleted', project),
          oldValue: project
        });
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      throw error;
    }
  },

  async addEmployee(e) {
    try {
      const data = toSnake({
        ...e,
        rateType: e.rateType || "fixed",
        rateValue: Number(e.rateValue) || 0,
        active: e.active ?? true,
      });
      
      // Save to database
      const created = await db.dbEmployees.create(data);
      const camel = toCamel(created);
      
      // Update state immediately (optimistic update) - this makes UI appear instantly
      const currentEmployees = get().employees;
      set({ employees: [camel, ...currentEmployees] });
      
      // Log activity (non-blocking, don't wait for it)
      logActivity({
        entityType: 'employee',
        entityId: camel.id,
        action: 'created',
        description: createEmployeeDescription('created', camel),
        newValue: camel
      }).catch(err => console.warn('Failed to log activity:', err));
      
      return camel;
    } catch (error) {
      console.error('Failed to add employee:', error);
      alert(`Failed to add employee: ${error.message || error}`);
      throw error;
    }
  },

  async updateEmployee(id, updates) {
    try {
      console.log('🔄 updateEmployee called:', { id, updates });
      const oldEmployee = get().employees.find(e => e.id === id);
      if (!oldEmployee) {
        console.error('❌ Employee not found in state:', id);
        throw new Error(`Employee with id ${id} not found`);
      }
      console.log('📋 Old employee:', oldEmployee);
      
      const data = toSnake(updates);
      console.log('💾 Saving to database with data:', data);
      const updated = await db.dbEmployees.update(id, data);
      console.log('✅ Database update returned:', updated);
      
      const camel = toCamel(updated);
      console.log('🔄 Converted to camelCase:', camel);
      
      // Merge updates with existing employee to preserve all fields
      const mergedEmployee = {
        ...oldEmployee,
        ...camel,
        ...updates, // Also merge original updates to ensure all fields are included
      };
      console.log('🔀 Merged employee:', mergedEmployee);
      
      const currentEmployees = get().employees;
      const updatedEmployees = currentEmployees.map(e => e.id === id ? mergedEmployee : e);
      console.log('📊 Updating state with', updatedEmployees.length, 'employees');
      console.log('📊 Current employees before update:', currentEmployees.length);
      console.log('📊 Updated employees array:', updatedEmployees.length);
      console.log('📊 Are arrays different?', currentEmployees !== updatedEmployees);
      
      // Force a new array reference to ensure Zustand detects the change
      set({
        employees: [...updatedEmployees],
      });
      
      // Verify the update after a brief delay to ensure state has updated
      setTimeout(() => {
        const verifyEmployee = get().employees.find(e => e.id === id);
        console.log('✅ State updated. Verifying after delay:', verifyEmployee);
        console.log('✅ All employees in state:', get().employees.length);
      }, 100);
      
      // Log activity
      await logActivity({
        entityType: 'employee',
        entityId: String(id),
        action: 'updated',
        description: createEmployeeDescription('updated', mergedEmployee, oldEmployee),
        oldValue: oldEmployee,
        newValue: mergedEmployee
      });
      
      return mergedEmployee;
    } catch (error) {
      console.error('❌ Failed to update employee:', error);
      alert(`Failed to update employee: ${error.message || error}`);
      throw error;
    }
  },

  async deleteEmployee(id) {
    try {
      const employee = get().employees.find(e => e.id === id);
      
      if (!employee) {
        throw new Error('Employee not found');
      }
      
      // Delete from database first
      await db.dbEmployees.delete(id);
      
      // Update state immediately (optimistic update)
      const currentEmployees = get().employees;
      set({ employees: currentEmployees.filter(e => e.id !== id) });
      
      // Log activity (non-blocking)
      logActivity({
        entityType: 'employee',
        entityId: String(id),
        action: 'deleted',
        description: createEmployeeDescription('deleted', employee),
        oldValue: employee
      }).catch(err => console.warn('Failed to log activity:', err));
      
      return true;
    } catch (error) {
      console.error('Failed to delete employee:', error);
      // Re-throw with a user-friendly message
      const message = error.message || 'Failed to delete employee. Please try again.';
      throw new Error(message);
    }
  },

  async addProfile(p) {
    try {
      const data = toSnake({
        ...p,
        platform: p.platform || "Fiverr",
        active: p.active ?? true,
      });
      const created = await db.dbProfiles.create(data);
      const camel = toCamel(created);
      set({ profiles: [camel, ...get().profiles] });
      
      // Log activity
      await logActivity({
        entityType: 'profile',
        entityId: camel.id,
        action: 'created',
        description: createEntityDescription('created', camel, 'profile'),
        newValue: camel
      });
      
      return camel;
    } catch (error) {
      console.error('Failed to add profile:', error);
      throw error;
    }
  },

  async updateProfile(id, updates) {
    try {
      const oldProfile = get().profiles.find(pr => pr.id === id);
      const data = toSnake(updates);
      const updated = await db.dbProfiles.update(id, data);
      const camel = toCamel(updated);
      set({
        profiles: get().profiles.map(pr => pr.id === id ? camel : pr),
      });
      
      // Log activity
      await logActivity({
        entityType: 'profile',
        entityId: String(id),
        action: 'updated',
        description: createEntityDescription('updated', camel, 'profile'),
        oldValue: oldProfile,
        newValue: camel
      });
      
      return camel;
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  },

  async deleteProfile(id) {
    try {
      const profile = get().profiles.find(pr => pr.id === id);
      await db.dbProfiles.delete(id);
      set({ profiles: get().profiles.filter(pr => pr.id !== id) });
      
      // Log activity
      if (profile) {
        await logActivity({
          entityType: 'profile',
          entityId: String(id),
          action: 'deleted',
          description: createEntityDescription('deleted', profile, 'profile'),
          oldValue: profile
        });
      }
    } catch (error) {
      console.error('Failed to delete profile:', error);
      throw error;
    }
  },

  async addAgency(a) {
    try {
      // Pass camelCase data directly - create function will handle mapping
      const created = await db.dbAgencies.create({
        ...a,
        active: a.active ?? true,
      });
      const camel = toCamel(created);
      set({ agencies: [camel, ...get().agencies] });
      
      // Log activity
      await logActivity({
        entityType: 'agency',
        entityId: camel.id,
        action: 'created',
        description: createEntityDescription('created', camel, 'agency'),
        newValue: camel
      });
      
      return camel;
    } catch (error) {
      console.error('Failed to add agency:', error);
      alert(`Failed to save agency: ${error.message || 'Please try again.'}`);
      throw error;
    }
  },

  async updateAgency(id, updates) {
    try {
      const oldAgency = get().agencies.find(ag => ag.id === id);
      const data = toSnake(updates);
      const updated = await db.dbAgencies.update(id, data);
      const camel = toCamel(updated);
      set({
        agencies: get().agencies.map(ag => ag.id === id ? camel : ag),
      });
      
      // Log activity
      await logActivity({
        entityType: 'agency',
        entityId: String(id),
        action: 'updated',
        description: createEntityDescription('updated', camel, 'agency'),
        oldValue: oldAgency,
        newValue: camel
      });
      
      return camel;
    } catch (error) {
      console.error('Failed to update agency:', error);
      throw error;
    }
  },

  async deleteAgency(id) {
    try {
      const agency = get().agencies.find(ag => ag.id === id);
      await db.dbAgencies.delete(id);
      set({ agencies: get().agencies.filter(ag => ag.id !== id) });
      
      // Log activity
      if (agency) {
        await logActivity({
          entityType: 'agency',
          entityId: String(id),
          action: 'deleted',
          description: createEntityDescription('deleted', agency, 'agency'),
          oldValue: agency
        });
      }
    } catch (error) {
      console.error('Failed to delete agency:', error);
      throw error;
    }
  },

  async addBrand(b) {
    try {
      // Pass camelCase data directly - create function will handle mapping
      const created = await db.dbBrands.create({
        ...b,
        active: b.active ?? true,
      });
      const camel = toCamel(created);
      set({ brands: [camel, ...get().brands] });
      
      // Log activity
      await logActivity({
        entityType: 'brand',
        entityId: camel.id,
        action: 'created',
        description: createEntityDescription('created', camel, 'brand'),
        newValue: camel
      });
      
      return camel;
    } catch (error) {
      console.error('Failed to add brand:', error);
      alert(`Failed to save brand: ${error.message || 'Please try again.'}`);
      throw error;
    }
  },

  async updateBrand(id, updates) {
    try {
      const oldBrand = get().brands.find(br => br.id === id);
      const data = toSnake(updates);
      const updated = await db.dbBrands.update(id, data);
      const camel = toCamel(updated);
      set({
        brands: get().brands.map(br => br.id === id ? camel : br),
      });
      
      // Log activity
      await logActivity({
        entityType: 'brand',
        entityId: String(id),
        action: 'updated',
        description: createEntityDescription('updated', camel, 'brand'),
        oldValue: oldBrand,
        newValue: camel
      });
      
      return camel;
    } catch (error) {
      console.error('Failed to update brand:', error);
      throw error;
    }
  },

  async deleteBrand(id) {
    try {
      const brand = get().brands.find(br => br.id === id);
      await db.dbBrands.delete(id);
      set({ brands: get().brands.filter(br => br.id !== id) });
      
      // Log activity
      if (brand) {
        await logActivity({
          entityType: 'brand',
          entityId: String(id),
          action: 'deleted',
          description: createEntityDescription('deleted', brand, 'brand'),
          oldValue: brand
        });
      }
    } catch (error) {
      console.error('Failed to delete brand:', error);
      throw error;
    }
  },

  // Load activity logs
  async loadActivityLogs(limit = 100) {
    try {
      const logs = await db.dbActivityLogs.getAll(limit);
      const camelLogs = logs.map(toCamel);
      set({ activityLogs: camelLogs });
      return camelLogs;
    } catch (error) {
      console.error('Failed to load activity logs:', error);
      return [];
    }
  },

  // User/Role management
  setUser(userData) {
    const user = {
      role: userData.role || 'admin',
      name: userData.name || 'User',
      email: userData.email || '',
      service: userData.service || '', // For Team Lead
      userId: userData.userId || '', // For Employee/Client
    };
    set({ user, userRole: user.role });
    // Save to localStorage
    try {
      localStorage.setItem('nexvoide_user', JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user to localStorage:', e);
    }
  },

  loadUser() {
    try {
      const saved = localStorage.getItem('nexvoide_user');
      if (saved) {
        const user = JSON.parse(saved);
        // Normalize role to array if it's a string (backward compatibility)
        if (typeof user.role === 'string') {
          try {
            const parsed = JSON.parse(user.role);
            if (Array.isArray(parsed)) {
              user.role = parsed;
            } else {
              user.role = [user.role];
            }
          } catch {
            user.role = [user.role];
          }
        } else if (!Array.isArray(user.role)) {
          user.role = [user.role || 'admin'];
        }
        
        // Get primary role
        const rolePriority = { admin: 5, manager: 4, teamlead: 3, employee: 2, client: 1 };
        const primaryRole = user.role.length > 0 
          ? user.role.reduce((highest, role) => {
              const currentPriority = rolePriority[role] || 0;
              const highestPriority = rolePriority[highest] || 0;
              return currentPriority > highestPriority ? role : highest;
            }, user.role[0])
          : 'admin';
        
        set({ user, userRole: primaryRole });
        return user;
      }
    } catch (e) {
      console.warn('Failed to load user from localStorage:', e);
    }
    // Default to admin if no user found
    const defaultUser = { role: ['admin'], name: 'Admin', email: '', service: '', userId: '' };
    set({ user: defaultUser, userRole: 'admin' });
    return defaultUser;
  },

  async clearUser() {
    const currentUser = get().user;
    if (currentUser) {
      // Remove user from online status when logging out
      try {
        const userId = currentUser.id || currentUser.username;
        if (userId) {
          const { dbUserOnlineStatus } = await import('../lib/db.js');
          await dbUserOnlineStatus.removeStatus(userId);
        }
      } catch (e) {
        console.warn('Failed to remove user from online status:', e);
      }
    }
    set({ user: null, userRole: null });
    try {
      localStorage.removeItem('nexvoide_user');
    } catch (e) {
      console.warn('Failed to clear user from localStorage:', e);
    }
  },

  // Login function - Optimized for speed
  async login(username, password) {
    try {
      // Normalize username (trim for matching - getByUsername now handles case-insensitive)
      const normalizedUsername = username.trim();
      
      // getByUsername now handles both exact and case-insensitive matching efficiently
      let user = await db.dbUsers.getByUsername(normalizedUsername);
      
      // If user not found, support a default bootstrap admin account for development
      if (!user && normalizedUsername === 'ahsan' && String(password).trim() === 'ahsan123') {
        try {
          const { hashPassword } = await import('../utils/password.js');
          const now = new Date().toISOString();
          
          const created = await db.dbUsers.create({
            username: 'ahsan',
            name: 'Admin',
            email: '',
            role: 'admin',
            active: true,
            password_hash: hashPassword('ahsan123'),
            created_at: now,
            updated_at: now,
          });
          
          user = created;
        } catch (e) {
          console.error('Failed to auto-create default admin user:', e);
        }
      }
      
      if (!user) {
        throw new Error('Invalid username or password');
      }
      
      // Handle both snake_case and camelCase field names
      const passwordHash = user.password_hash || user.passwordHash;
      const plainPassword = user.password || user.plain_password;
      
      // 1) If we have a hashed password, verify using hashing utility
      if (passwordHash) {
        const { verifyPassword } = await import('../utils/password.js');
        
        // Normalize potential whitespace issues
        const storedHash = String(passwordHash).trim();
        const provided = String(password).trim();
        
        const isHashedValid = verifyPassword(provided, storedHash);
        const isPlainValid = storedHash === provided;
        
        if (!isHashedValid && !isPlainValid) {
          throw new Error('Invalid username or password');
        }
      } else if (plainPassword !== undefined && plainPassword !== null) {
        // 2) Fallback: support legacy/plain-text passwords
        const storedPlain = String(plainPassword).trim();
        const providedPlain = String(password).trim();
        
        if (!storedPlain || storedPlain !== providedPlain) {
          throw new Error('Invalid username or password');
        }
      } else {
        // 3) No password stored at all – treat as invalid credentials
        throw new Error('Invalid username or password');
      }
      
      if (!user.active) {
        throw new Error('Account is inactive. Please contact administrator.');
      }
      
      // Set user in store immediately (don't wait for last_login update)
      // Normalize role to array format
      let roles = user.role || 'admin';
      if (typeof roles === 'string') {
        try {
          const parsed = JSON.parse(roles);
          if (Array.isArray(parsed)) {
            roles = parsed;
          } else {
            roles = [roles];
          }
        } catch {
          roles = [roles];
        }
      } else if (!Array.isArray(roles)) {
        roles = [roles || 'admin'];
      }
      
      // Get primary role
      const rolePriority = { admin: 5, manager: 4, teamlead: 3, employee: 2, client: 1 };
      const primaryRole = roles.length > 0 
        ? roles.reduce((highest, role) => {
            const currentPriority = rolePriority[role] || 0;
            const highestPriority = rolePriority[highest] || 0;
            return currentPriority > highestPriority ? role : highest;
          }, roles[0])
        : 'admin';
      
      const userData = {
        id: user.id,
        role: roles, // Store as array
        name: user.name,
        email: user.email || '',
        service: user.service || '',
        userId: user.user_id || '',
        username: user.username,
      };
      
      set({ user: userData, userRole: primaryRole });
      
      // Save to localStorage immediately
      try {
        localStorage.setItem('nexvoide_user', JSON.stringify(userData));
      } catch (e) {
        // Silent fail
      }
      
      // Update last login asynchronously (don't block login response)
      db.dbUsers.update(user.id, { last_login: new Date().toISOString() }).catch(() => {
        // Silent fail
      });
      
      return userData;
    } catch (error) {
      throw error;
    }
  },
}));

export function convert(amount, from, to, rate) {
  const a = Number(amount) || 0;
  if (from === to) return a;
  if (from === "USD" && to === "PKR") return a * rate;
  if (from === "PKR" && to === "USD") return a / (rate || 1);
  return a;
}


