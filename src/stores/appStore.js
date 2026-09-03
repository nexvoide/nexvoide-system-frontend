import { create } from "zustand";
import * as db from "../lib/db.js";
import { logActivity, createProjectDescription, createEmployeeDescription, createEntityDescription, createSettingDescription } from "../utils/activityLogger.js";
import { normalizeRoles, getPrimaryRole } from "../utils/permissions.js";

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
  authInitialized: false,

  // Initialize - load all data from Supabase (optimized for speed)
  async initialize() {
    if (get().initialized) return;
    
    // Mark as initialized immediately to prevent duplicate calls
    set({ initialized: true });
    
    // 1) Hydrate instantly from local cache (no network, no blocking)
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
      });
    } catch (_) {
      // ignore cache errors
    }

    // 2) Load everything in parallel (non-blocking, updates incrementally)
    // Don't wait for Supabase connection - let each query handle it
    const hasAnyCache = (
      (get().projects?.length || 0) +
      (get().employees?.length || 0) +
      (get().profiles?.length || 0) +
      (get().agencies?.length || 0) +
      (get().brands?.length || 0)
    ) > 0;
    
    if (!hasAnyCache) set({ loading: true });

    // Load everything in parallel - no blocking
    Promise.allSettled([
      // Settings (non-blocking)
      Promise.all([
        db.dbSettings.get('currency').then(currency => currency && set({ currency })),
        db.dbSettings.get('rate').then(rate => rate && set({ rate: Number(rate) || 280 })),
      ]),
      
      // Data (updates state immediately as each completes)
      db.dbProjects.getAll().then(data => {
        const camel = Array.isArray(data) ? toCamel(data) : [];
        set({ projects: camel });
      }).catch(() => {}),
      
      db.dbEmployees.getAll().then(data => {
        const camel = Array.isArray(data) ? toCamel(data) : [];
        set({ employees: camel });
      }).catch(() => {}),
      
      db.dbProfiles.getAll().then(data => {
        const camel = Array.isArray(data) ? toCamel(data) : [];
        set({ profiles: camel });
      }).catch(() => {}),
      
      db.dbAgencies.getAll().then(data => {
        const camel = Array.isArray(data) ? toCamel(data) : [];
        set({ agencies: camel });
      }).catch(() => {}),
      
      db.dbBrands.getAll().then(data => {
        const camel = Array.isArray(data) ? toCamel(data) : [];
        set({ brands: camel });
      }).catch(() => {}),
      
      db.dbActivityLogs.getAll(100).then(data => {
        const camel = Array.isArray(data) ? toCamel(data) : [];
        set({ activityLogs: camel });
      }).catch(() => {}),
      
      db.dbUsers.getAll().then(data => {
        const camel = Array.isArray(data) ? toCamel(data) : [];
        set({ allUsers: camel });
      }).catch(() => {}),
    ]).then(() => {
      set({ loading: false });
    }).catch(() => {
      set({ loading: false });
    });
  },

  // Refresh projects from database (optimized)
  async refreshProjects() {
    try {
      const data = await db.dbProjects.getAll();
      const camel = Array.isArray(data) ? toCamel(data) : [];
      set({ projects: camel });
      return camel;
    } catch (error) {
      // Don't throw - just log and return current state
      return get().projects || [];
    }
  },

  // Refresh employees from database (optimized)
  async refreshEmployees() {
    try {
      const data = await db.dbEmployees.getAll();
      const camel = Array.isArray(data) ? toCamel(data) : [];
      set({ employees: camel });
      return camel;
    } catch (error) {
      // Don't throw - just log and return current state
      return get().employees || [];
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
      const oldEmployee = get().employees.find(e => e.id === id);
      if (!oldEmployee) {
        throw new Error(`Employee with id ${id} not found`);
      }
      
      const data = toSnake(updates);
      const updated = await db.dbEmployees.update(id, data);
      const camel = toCamel(updated);
      
      // Merge updates with existing employee to preserve all fields
      const mergedEmployee = {
        ...oldEmployee,
        ...camel,
        ...updates, // Also merge original updates to ensure all fields are included
      };
      
      const currentEmployees = get().employees;
      const updatedEmployees = currentEmployees.map(e => e.id === id ? mergedEmployee : e);
      
      // Force a new array reference to ensure Zustand detects the change
      set({
        employees: [...updatedEmployees],
      });
      
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
  },

  async loadUser() {
    try {
      const { supabase } = await import('../lib/supabase.js');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user?.id) {
        set({ user: null, userRole: null, authInitialized: true });
        return null;
      }
      const { data: profile, error } = await supabase.from('users')
        .select('id, username, name, email, role, avatar, active, service, user_id, auth_user_id')
        .eq('auth_user_id', session.user.id).eq('active', true).single();
      if (error || !profile) throw error || new Error('Authenticated profile not found');
      const roles = normalizeRoles(profile.role, 'employee');
      const user = {
        id: profile.id,
        authUserId: profile.auth_user_id,
        role: roles,
        name: profile.name,
        email: profile.email || session.user.email || '',
        avatar: profile.avatar || null,
        service: profile.service || '',
        userId: profile.user_id || '',
        username: profile.username,
      };
      set({ user, userRole: getPrimaryRole(roles, 'employee'), authInitialized: true });
      return user;
    } catch (e) {
      console.error('Failed to restore authenticated user:', e);
      set({ user: null, userRole: null, authInitialized: true });
      return null;
    }
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
    const { supabase } = await import('../lib/supabase.js');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    set({ user: null, userRole: null });
    localStorage.removeItem('nexvoide_user');
  },

  // Login function - Simple and straightforward
  async login(username, password) {
    try {
      // Ensure Supabase is ready before attempting login
      const { initializeSupabase, isSupabaseConfigured, supabase } = await import('../lib/supabase.js');
      
      if (!isSupabaseConfigured) {
        throw new Error('Database is not configured. Please contact administrator.');
      }
      
      // Wait for Supabase connection
      const isReady = await initializeSupabase();
      if (!isReady) {
        throw new Error('Unable to connect to database. Please check your connection and try again.');
      }
      
      const normalizedUsername = username.trim();
      if (!normalizedUsername || !password) throw new Error('Invalid username or password');
      const { data, error: functionError } = await supabase.functions.invoke('chat-auth', {
        body: { username: normalizedUsername, password: String(password) },
      });
      if (functionError || !data?.access_token || !data?.refresh_token) {
        throw new Error('Invalid username or password');
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionError) throw new Error('Unable to establish secure session');
      const userData = await get().loadUser();
      if (!userData) throw new Error('Authenticated profile not found');
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
