import { supabase, TABLES, isSupabaseConfigured, initializeSupabase, isSupabaseReady } from './supabase.js';
import { queryCache } from './cache.js';

// Helper to handle Supabase errors
const handleError = (error, operation) => {
  console.error(`Error in ${operation}:`, error);
  // Provide more detailed error message
  const errorMessage = error?.message || error?.error_description || 'Unknown error';
  const detailedError = new Error(`${operation} failed: ${errorMessage}`);
  detailedError.originalError = error;
  throw detailedError;
};

// localStorage fallback helpers
const getStorageKey = (table) => `nexvoide_${table}`;

export const localStorageGet = (table) => {
  try {
    const data = localStorage.getItem(getStorageKey(table));
    if (!data) return [];
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const localStorageSet = (table, data) => {
  try {
    localStorage.setItem(getStorageKey(table), JSON.stringify(data));
  } catch (error) {
    console.error(`Failed to save to localStorage (${table}):`, error);
  }
};

// Projects
export const dbProjects = {
  // Fast local cache read (no network)
  getCached() {
    return localStorageGet(TABLES.projects);
  },
  async getAll() {
    // Check in-memory cache first (fastest)
    const cacheKey = queryCache.getKey('PROJECTS');
    const cached = queryCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    if (!isSupabaseConfigured) {
      const data = localStorageGet(TABLES.projects);
      const result = Array.isArray(data) ? data : [];
      // Cache the result
      queryCache.set(cacheKey, result, queryCache.getTTL('PROJECTS'));
      return result;
    }
    
    // Ensure Supabase is connected (fast check)
    await initializeSupabase();
    
    try {
      // Fast query with 5 second timeout (reduced from 15s)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      );
      
      // Only get non-archived projects
      const queryPromise = supabase
        .from(TABLES.projects)
        .select('*')
        .eq('archived', false)
        .order('created_at', { ascending: false });
      
      let result = await Promise.race([queryPromise, timeoutPromise]);
      let { data, error } = result || {};
      
      // If archived column doesn't exist, get all projects
      if (error && (error.message?.includes('column') || error.message?.includes('does not exist') || error.code === '42703')) {
        const fallbackPromise = supabase
          .from(TABLES.projects)
          .select('*')
          .order('created_at', { ascending: false });
        result = await Promise.race([fallbackPromise, timeoutPromise]);
        if (result.error) throw result.error;
        data = result.data;
        error = null;
      } else if (error) {
        throw error;
      }
      
      const supabaseData = Array.isArray(data) ? data : [];
      localStorageSet(TABLES.projects, supabaseData);
      // Cache the result
      queryCache.set(cacheKey, supabaseData, queryCache.getTTL('PROJECTS'));
      return supabaseData;
    } catch (error) {
      console.error('Failed to load projects from Supabase:', error.message);
      // Return cached data on error (don't block UI)
      const data = localStorageGet(TABLES.projects);
      const result = Array.isArray(data) ? data.filter(p => !p.archived) : [];
      // Cache the fallback result too
      queryCache.set(cacheKey, result, queryCache.getTTL('PROJECTS'));
      return result;
    }
  },

  async create(project) {
    // Invalidate cache on create
    queryCache.invalidatePattern('PROJECTS');
    if (!isSupabaseConfigured) {
      const newProject = { ...project, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.projects);
      all.unshift(newProject);
      localStorageSet(TABLES.projects, all);
      return newProject;
    }
    try {
      // Only include fields that exist in the schema
      // Handle assigned field - it might be a string (from DB) or an array (from form)
      let assignedValue = '[]';
      if (project.assigned) {
        if (typeof project.assigned === 'string') {
          assignedValue = project.assigned;
        } else {
          assignedValue = JSON.stringify(project.assigned);
        }
      }
      
      // Handle attachments field
      let attachmentsValue = '[]';
      if (project.attachments) {
        if (typeof project.attachments === 'string') {
          attachmentsValue = project.attachments;
        } else {
          attachmentsValue = JSON.stringify(project.attachments);
        }
      }
      
      const projectData = {
        platform: project.platform || null,
        profile_id: project.profile_id || null,
        agency_id: project.agency_id || null,
        brand_id: project.brand_id || null,
        client_name: project.client_name || '',
        project_name: project.project_name || '',
        service: project.service || null,
        quantity: project.quantity !== undefined ? (project.quantity === null ? null : (typeof project.quantity === 'string' ? project.quantity : String(project.quantity))) : null,
        revision_quantity: project.revision_quantity !== undefined ? (project.revision_quantity === null ? null : (typeof project.revision_quantity === 'string' ? project.revision_quantity : String(project.revision_quantity))) : null,
        amount: project.amount !== undefined ? Number(project.amount) : 0,
        currency: project.currency || 'USD',
        status: project.status || 'In Progress',
        is_revision: project.is_revision !== undefined ? Boolean(project.is_revision) : false,
        start_date: project.start_date || null,
        end_date: project.end_date || null,
        deadline: project.deadline || null,
        assigned: assignedValue,
        raw_source_link: project.raw_source_link || project.rawSourceLink || null,
        attachments: attachmentsValue,
      };
      const { data, error } = await supabase
        .from(TABLES.projects)
        .insert(projectData)
        .select()
        .single();
      if (error) throw error;
      // Always sync to localStorage when Supabase insert succeeds
      const all = localStorageGet(TABLES.projects);
      all.unshift(data);
      localStorageSet(TABLES.projects, all);
      // Invalidate cache on create
      queryCache.invalidatePattern('PROJECTS');
      return data;
    } catch (error) {
      console.warn('Supabase create failed, using localStorage:', error);
      const newProject = { ...project, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.projects);
      all.unshift(newProject);
      localStorageSet(TABLES.projects, all);
      return newProject;
    }
  },

  async update(id, updates) {
    // Normalize ID to string for consistent comparison
    const projectId = String(id);
    
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.projects);
      const index = all.findIndex(p => String(p.id) === projectId);
      if (index === -1) {
        console.error('Project not found in localStorage:', projectId, 'Available IDs:', all.map(p => String(p.id)));
        throw new Error('Project not found');
      }
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.projects, all);
      return all[index];
    }
    try {
      // Build update object with only fields that are being updated
      const projectData = {};
      
      // Only include fields that are actually in the updates
      if (updates.platform !== undefined) projectData.platform = updates.platform;
      if (updates.profile_id !== undefined) projectData.profile_id = updates.profile_id;
      if (updates.agency_id !== undefined) projectData.agency_id = updates.agency_id;
      if (updates.brand_id !== undefined) projectData.brand_id = updates.brand_id;
      if (updates.client_name !== undefined) projectData.client_name = updates.client_name;
      if (updates.project_name !== undefined) projectData.project_name = updates.project_name;
      if (updates.service !== undefined) projectData.service = updates.service;
      if (updates.quantity !== undefined) {
        // Handle quantity: if null, set to null; if string, keep as string; otherwise convert to string
        projectData.quantity = updates.quantity === null ? null : (typeof updates.quantity === 'string' ? updates.quantity : String(updates.quantity));
      }
      if (updates.revision_quantity !== undefined) {
        // Handle revision_quantity: if null, set to null; if string, keep as string; otherwise convert to string
        projectData.revision_quantity = updates.revision_quantity === null ? null : (typeof updates.revision_quantity === 'string' ? updates.revision_quantity : String(updates.revision_quantity));
      }
      if (updates.amount !== undefined) projectData.amount = Number(updates.amount);
      if (updates.currency !== undefined) projectData.currency = updates.currency;
      if (updates.status !== undefined) projectData.status = updates.status;
      if (updates.is_revision !== undefined) projectData.is_revision = Boolean(updates.is_revision);
      if (updates.start_date !== undefined) projectData.start_date = updates.start_date;
      if (updates.end_date !== undefined) projectData.end_date = updates.end_date;
      if (updates.deadline !== undefined) projectData.deadline = updates.deadline;
      
      // Handle assigned field - it might be a string (from DB) or an array (from form)
      if (updates.assigned !== undefined) {
        if (typeof updates.assigned === 'string') {
          projectData.assigned = updates.assigned;
        } else {
          projectData.assigned = JSON.stringify(updates.assigned);
        }
      }
      
      // Handle attachments field
      if (updates.attachments !== undefined) {
        if (typeof updates.attachments === 'string') {
          projectData.attachments = updates.attachments;
        } else {
          projectData.attachments = JSON.stringify(updates.attachments);
        }
      }
      
      // Handle rawSourceLink (camelCase) or raw_source_link (snake_case)
      if (updates.rawSourceLink !== undefined) {
        projectData.raw_source_link = updates.rawSourceLink;
      } else if (updates.raw_source_link !== undefined) {
        projectData.raw_source_link = updates.raw_source_link;
      }
      
      const { data, error } = await supabase
        .from(TABLES.projects)
        .update(projectData)
        .eq('id', projectId)
        .select()
        .single();
      if (error) throw error;
      // Always sync to localStorage when Supabase update succeeds
      const all = localStorageGet(TABLES.projects);
      const index = all.findIndex(p => String(p.id) === projectId);
      if (index !== -1) {
        all[index] = data;
      } else {
        all.unshift(data);
      }
      localStorageSet(TABLES.projects, all);
      // Invalidate cache on update
      queryCache.invalidatePattern('PROJECTS');
      return data;
    } catch (error) {
      console.warn('Supabase update project failed, using localStorage:', error);
      const all = localStorageGet(TABLES.projects);
      const index = all.findIndex(p => String(p.id) === projectId);
      if (index === -1) {
        console.error('Project not found in localStorage after fallback:', projectId, 'Available IDs:', all.map(p => String(p.id)));
        throw new Error('Project not found');
      }
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.projects, all);
      return all[index];
    }
  },

  async delete(id) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.projects);
      const filtered = all.filter(p => String(p.id) !== String(id));
      localStorageSet(TABLES.projects, filtered);
      return;
    }
    try {
      const { error } = await supabase
        .from(TABLES.projects)
        .delete()
        .eq('id', id);
      if (error) throw error;
      // Always sync to localStorage when Supabase delete succeeds
      const all = localStorageGet(TABLES.projects);
      const filtered = all.filter(p => String(p.id) !== String(id));
      localStorageSet(TABLES.projects, filtered);
      // Invalidate cache on delete
      queryCache.invalidatePattern('PROJECTS');
    } catch (error) {
      console.warn('Supabase delete failed, using localStorage:', error);
      const all = localStorageGet(TABLES.projects);
      const filtered = all.filter(p => String(p.id) !== String(id));
      localStorageSet(TABLES.projects, filtered);
    }
  },
};

// Employees
export const dbEmployees = {
  getCached() {
    return localStorageGet(TABLES.employees);
  },
  async getAll() {
    // Check in-memory cache first (fastest)
    const cacheKey = queryCache.getKey('EMPLOYEES');
    const cached = queryCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    if (!isSupabaseConfigured) {
      const data = localStorageGet(TABLES.employees);
      const result = Array.isArray(data) ? data : [];
      queryCache.set(cacheKey, result, queryCache.getTTL('EMPLOYEES'));
      return result;
    }
    
    // Ensure Supabase is connected (fast check)
    await initializeSupabase();
    
    try {
      // Fast query with 5 second timeout (reduced from 15s)
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      );
      
      const queryPromise = supabase
        .from(TABLES.employees)
        .select('id, name, role, email, phone, bank_name, bank_account, avatar, notes, active, rate_type, rate_value, street, city, state, country, zip, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data, error } = result || {};
      
      if (error) throw error;
      
      const supabaseData = Array.isArray(data) ? data : [];
      localStorageSet(TABLES.employees, supabaseData);
      // Cache the result
      queryCache.set(cacheKey, supabaseData, queryCache.getTTL('EMPLOYEES'));
      return supabaseData;
    } catch (error) {
      console.error('Failed to load employees from Supabase:', error.message);
      // Return cached data on error (don't block UI)
      const data = localStorageGet(TABLES.employees);
      const result = Array.isArray(data) ? data : [];
      queryCache.set(cacheKey, result, queryCache.getTTL('EMPLOYEES'));
      return result;
    }
  },

  async create(employee) {
    console.log('📝 dbEmployees.create called with:', employee);
    if (!isSupabaseConfigured) {
      console.log('💾 Using localStorage (Supabase not configured)');
      const newEmployee = { ...employee, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.employees);
      all.unshift(newEmployee);
      localStorageSet(TABLES.employees, all);
      console.log('✅ Created employee in localStorage:', newEmployee);
      return newEmployee;
    }
    try {
      // Only include fields that exist in the schema (allow address fields to be optional)
      // Handle both camelCase (from form) and snake_case (from toSnake conversion)
      const employeeData = {
        name: employee.name || employee.employee_name || '',
        role: employee.role || employee.employee_role || null,
        email: employee.email || employee.employee_email || null,
        phone: employee.phone || employee.employee_phone || null,
        bank_name: employee.bankName || employee.bank_name || null,
        bank_account: employee.bankAccount || employee.bank_account || null,
        avatar: employee.avatar || employee.employee_avatar || null,
        notes: employee.notes || null,
        active: employee.active !== undefined ? employee.active : true,
        rate_type: employee.rateType || employee.rate_type || 'fixed',
        rate_value: employee.rateValue !== undefined ? Number(employee.rateValue) || 0 : (employee.rate_value !== undefined ? Number(employee.rate_value) || 0 : 0),
      };
      
      // Add address fields if they exist (they may not be in the schema yet)
      const street = employee.street || employee.address_street;
      const city = employee.city || employee.address_city;
      const state = employee.state || employee.address_state;
      const country = employee.country || employee.address_country;
      const zip = employee.zip || employee.address_zip;
      
      // Only add address fields if they have values (to avoid errors if columns don't exist)
      if (street !== undefined && street !== null && street !== '') employeeData.street = street;
      if (city !== undefined && city !== null && city !== '') employeeData.city = city;
      if (state !== undefined && state !== null && state !== '') employeeData.state = state;
      if (country !== undefined && country !== null && country !== '') employeeData.country = country;
      if (zip !== undefined && zip !== null && zip !== '') employeeData.zip = zip;
      
      console.log('💾 Inserting to Supabase with data:', employeeData);
      let { data, error } = await supabase
        .from(TABLES.employees)
        .insert(employeeData)
        .select()
        .single();
      
      // If error mentions unknown column, retry without address fields
      if (error && (error.message?.includes('column') || error.message?.includes('does not exist') || error.code === '42703')) {
        console.warn('⚠️ Address columns may not exist, retrying without address fields:', error.message);
        const employeeDataNoAddress = { ...employeeData };
        delete employeeDataNoAddress.street;
        delete employeeDataNoAddress.city;
        delete employeeDataNoAddress.state;
        delete employeeDataNoAddress.country;
        delete employeeDataNoAddress.zip;
        
        console.log('💾 Retrying insert without address fields:', employeeDataNoAddress);
        const result = await supabase
          .from(TABLES.employees)
          .insert(employeeDataNoAddress)
          .select()
          .single();
        if (result.error) {
          console.error('❌ Supabase insert error (retry):', result.error);
          throw result.error;
        }
        data = result.data;
        error = null;
        console.log('✅ Insert successful (without address fields):', data);
      } else if (error) {
        console.error('❌ Supabase insert error:', error);
        throw error;
      } else {
        console.log('✅ Insert successful:', data);
      }
      
      // Sync cache (include address fields in cache even if not in Supabase)
      const finalData = { ...data, ...(street || city || state || country || zip ? {
        street: street || null,
        city: city || null,
        state: state || null,
        country: country || null,
        zip: zip || null,
      } : {}) };
      const all = localStorageGet(TABLES.employees);
      all.unshift(finalData);
      localStorageSet(TABLES.employees, all);
      // Invalidate cache on create
      queryCache.invalidatePattern('EMPLOYEES');
      console.log('✅ Cached employee in localStorage');
      return finalData;
    } catch (error) {
      console.warn('⚠️ Supabase create employee failed, using localStorage:', error);
      const newEmployee = { ...employee, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.employees);
      all.unshift(newEmployee);
      localStorageSet(TABLES.employees, all);
      console.log('✅ Created employee in localStorage (fallback):', newEmployee);
      return newEmployee;
    }
  },

  async update(id, updates) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.employees);
      const index = all.findIndex(e => e.id === id);
      if (index === -1) throw new Error('Employee not found');
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.employees, all);
      return all[index];
    }
    try {
      // Map camelCase to snake_case and only include defined fields
      // Handle both camelCase (from form) and snake_case (from toSnake conversion)
      const updateData = {};
      if (updates.name !== undefined || updates.employee_name !== undefined) updateData.name = updates.name || updates.employee_name || '';
      if (updates.role !== undefined || updates.employee_role !== undefined) updateData.role = updates.role || updates.employee_role || null;
      if (updates.email !== undefined || updates.employee_email !== undefined) updateData.email = updates.email || updates.employee_email || null;
      if (updates.phone !== undefined || updates.employee_phone !== undefined) updateData.phone = updates.phone || updates.employee_phone || null;
      if (updates.bankName !== undefined || updates.bank_name !== undefined) updateData.bank_name = updates.bankName || updates.bank_name || null;
      if (updates.bankAccount !== undefined || updates.bank_account !== undefined) updateData.bank_account = updates.bankAccount || updates.bank_account || null;
      if (updates.avatar !== undefined || updates.employee_avatar !== undefined) updateData.avatar = updates.avatar || updates.employee_avatar || null;
      if (updates.notes !== undefined) updateData.notes = updates.notes || null;
      if (updates.active !== undefined) updateData.active = updates.active;
      if (updates.rateType !== undefined || updates.rate_type !== undefined) updateData.rate_type = updates.rateType || updates.rate_type || 'fixed';
      if (updates.rateValue !== undefined || updates.rate_value !== undefined) updateData.rate_value = Number(updates.rateValue || updates.rate_value || 0);
      
      // Try update with address fields first
      const street = updates.street || updates.address_street;
      const city = updates.city || updates.address_city;
      const state = updates.state || updates.address_state;
      const country = updates.country || updates.address_country;
      const zip = updates.zip || updates.address_zip;
      if (street !== undefined && street !== null && street !== '') updateData.street = street;
      if (city !== undefined && city !== null && city !== '') updateData.city = city;
      if (state !== undefined && state !== null && state !== '') updateData.state = state;
      if (country !== undefined && country !== null && country !== '') updateData.country = country;
      if (zip !== undefined && zip !== null && zip !== '') updateData.zip = zip;
      
      let { data, error } = await supabase
        .from(TABLES.employees)
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      // If error mentions unknown column, retry without address fields
      if (error && (error.message?.includes('column') || error.message?.includes('does not exist') || error.code === '42703')) {
        console.warn('Address columns may not exist, retrying without address fields:', error.message);
        const updateDataNoAddress = { ...updateData };
        delete updateDataNoAddress.street;
        delete updateDataNoAddress.city;
        delete updateDataNoAddress.state;
        delete updateDataNoAddress.country;
        delete updateDataNoAddress.zip;
        
        const result = await supabase
          .from(TABLES.employees)
          .update(updateDataNoAddress)
          .eq('id', id)
          .select()
          .single();
        if (result.error) throw result.error;
        data = result.data;
        error = null;
      } else if (error) {
        throw error;
      }
      
      // Sync cache (include address fields in cache even if not in Supabase)
      const all = localStorageGet(TABLES.employees);
      const index = all.findIndex(e => String(e.id) === String(id));
      const cachedEmployee = index !== -1 ? all[index] : null;
      // Merge address fields: prefer updates, then cached, then null
      const finalData = { 
        ...data,
        street: street !== undefined ? street : (cachedEmployee?.street || cachedEmployee?.address_street || null),
        city: city !== undefined ? city : (cachedEmployee?.city || cachedEmployee?.address_city || null),
        state: state !== undefined ? state : (cachedEmployee?.state || cachedEmployee?.address_state || null),
        country: country !== undefined ? country : (cachedEmployee?.country || cachedEmployee?.address_country || null),
        zip: zip !== undefined ? zip : (cachedEmployee?.zip || cachedEmployee?.address_zip || null),
      };
      if (index !== -1) all[index] = finalData; else all.unshift(finalData);
      localStorageSet(TABLES.employees, all);
      // Invalidate cache on update
      queryCache.invalidatePattern('EMPLOYEES');
      return finalData;
    } catch (error) {
      console.warn('Supabase update employee failed, using localStorage:', error);
      const all = localStorageGet(TABLES.employees);
      const index = all.findIndex(e => e.id === id);
      if (index === -1) throw new Error('Employee not found');
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.employees, all);
      return all[index];
    }
  },

  async delete(id) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.employees);
      const filtered = all.filter(e => e.id !== id);
      localStorageSet(TABLES.employees, filtered);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from(TABLES.employees)
        .delete()
        .eq('id', id)
        .select();
      
      if (error) {
        console.error('Supabase delete error:', error);
        // Check for common error types
        if (error.code === '23503') {
          throw new Error('Cannot delete employee: This employee is referenced in other records (e.g., projects). Please remove all references first.');
        } else if (error.code === '42501') {
          throw new Error('Permission denied: You do not have permission to delete employees. Please check your role and permissions.');
        } else {
          throw new Error(`Failed to delete employee: ${error.message || 'Unknown error'}`);
        }
      }
      
      // Verify deletion was successful
      if (!data || data.length === 0) {
        console.warn('Delete operation returned no data - employee may not exist');
      }
      
      // Sync cache
      const all = localStorageGet(TABLES.employees);
      const filtered = all.filter(e => String(e.id) !== String(id));
      localStorageSet(TABLES.employees, filtered);
      // Invalidate cache on delete
      queryCache.invalidatePattern('EMPLOYEES');
    } catch (error) {
      console.error('Error in delete employee:', error);
      throw error;
    }
  },
};

// Profiles
export const dbProfiles = {
  getCached() {
    return localStorageGet(TABLES.profiles);
  },
  async getAll() {
    if (!isSupabaseConfigured) {
      return localStorageGet(TABLES.profiles);
    }
    
    // Ensure Supabase is connected (fast check)
    await initializeSupabase();
    
    try {
      // Fast query with 5 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      );
      
      const queryPromise = supabase
        .from(TABLES.profiles)
        .select('id, name, service, platform, username, logo, notes, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data, error } = result || {};
      
      if (error) throw error;
      
      const supabaseData = Array.isArray(data) ? data : [];
      localStorageSet(TABLES.profiles, supabaseData);
      return supabaseData;
    } catch (error) {
      console.error('Failed to load profiles from Supabase:', error.message);
      return localStorageGet(TABLES.profiles);
    }
  },

  async create(profile) {
    if (!isSupabaseConfigured) {
      const newProfile = { ...profile, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.profiles);
      all.unshift(newProfile);
      localStorageSet(TABLES.profiles, all);
      return newProfile;
    }
    
    try {
      // Map camelCase to snake_case and include all fields
      const profileData = {
        name: profile.name || '',
        service: profile.service || null,
        platform: profile.platform || null,
        username: profile.username || null,
        logo: profile.logo || null,
        notes: profile.notes || null,
      };
      
      const { data, error } = await supabase
        .from(TABLES.profiles)
        .insert(profileData)
        .select()
        .single();
      
      if (error) {
        // If columns don't exist, try with only name
        if (error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.code === '42703') {
          console.warn('⚠️ Profile columns missing! Please run supabase-add-profile-fields.sql');
          console.warn('Creating profile with name only, other fields stored in localStorage');
          
          const { data: fallbackData, error: fallbackError } = await supabase
            .from(TABLES.profiles)
            .insert({ name: profile.name || '' })
            .select()
            .single();
          
          if (fallbackError) {
            handleError(fallbackError, 'create profile');
          } else {
            // Store full profile in localStorage
            const newProfile = { ...fallbackData, ...profile };
            const all = localStorageGet(TABLES.profiles);
            all.unshift(newProfile);
            localStorageSet(TABLES.profiles, all);
            return newProfile;
          }
        } else {
          handleError(error, 'create profile');
        }
      }
      
      // Sync to localStorage
      const all = localStorageGet(TABLES.profiles);
      all.unshift(data);
      localStorageSet(TABLES.profiles, all);
      
      return data;
    } catch (error) {
      handleError(error, 'create profile');
    }
  },

  async update(id, updates) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.profiles);
      const index = all.findIndex(p => p.id === id);
      if (index === -1) throw new Error('Profile not found');
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.profiles, all);
      return all[index];
    }
    
    try {
      // Try to save all fields first (in case columns exist)
      // Map camelCase to snake_case for database
      const profileData = {
        name: updates.name || updates.name || '',
        service: updates.service || null,
        platform: updates.platform || null,
        username: updates.username || null,
        logo: updates.logo || null,
        notes: updates.notes || null,
        updated_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase
        .from(TABLES.profiles)
        .update(profileData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        // If error mentions unknown column, try with only name field
        if (error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.code === '42703') {
          console.warn('⚠️ Profile columns missing! Please run supabase-add-profile-fields.sql');
          console.warn('Error:', error.message);
          
          // Try with only name field
          const { data: retryData, error: retryError } = await supabase
            .from(TABLES.profiles)
            .update({ name: updates.name || '', updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
          
          if (retryError) {
            handleError(retryError, 'update profile');
          } else {
            // Store all fields in localStorage even if they don't exist in Supabase
            const all = localStorageGet(TABLES.profiles);
            const index = all.findIndex(p => p.id === id);
            if (index !== -1) {
              all[index] = { ...all[index], ...updates };
              localStorageSet(TABLES.profiles, all);
            }
            // Return combined data
            return { ...retryData, ...updates };
          }
        } else {
          handleError(error, 'update profile');
        }
      }
      
      // Sync to localStorage
      const all = localStorageGet(TABLES.profiles);
      const index = all.findIndex(p => p.id === id);
      if (index !== -1) {
        all[index] = { ...all[index], ...updates };
        localStorageSet(TABLES.profiles, all);
      }
      
      return data;
    } catch (error) {
      handleError(error, 'update profile');
    }
  },

  async delete(id) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.profiles);
      const filtered = all.filter(p => p.id !== id);
      localStorageSet(TABLES.profiles, filtered);
      return;
    }
    try {
      const { error } = await supabase
        .from(TABLES.profiles)
        .delete()
        .eq('id', id);
      if (error) {
        handleError(error, 'delete profile');
        return;
      }
      // Sync to localStorage after successful delete
      const all = localStorageGet(TABLES.profiles);
      const filtered = all.filter(p => p.id !== id);
      localStorageSet(TABLES.profiles, filtered);
    } catch (error) {
      handleError(error, 'delete profile');
    }
  },
};

// Agencies
export const dbAgencies = {
  getCached() {
    return localStorageGet(TABLES.agencies);
  },
  async getAll() {
    if (!isSupabaseConfigured) {
      return localStorageGet(TABLES.agencies);
    }
    
    // Ensure Supabase is connected (fast check)
    await initializeSupabase();
    
    try {
      // Fast query with 5 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      );
      
      const queryPromise = supabase
        .from(TABLES.agencies)
        .select('id, name, service, logo, contact, email, street, city, state, country, zip, active, notes, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data, error } = result || {};
      
      if (error) throw error;
      
      const supabaseData = Array.isArray(data) ? data : [];
      localStorageSet(TABLES.agencies, supabaseData);
      return supabaseData;
    } catch (error) {
      console.error('Failed to load agencies from Supabase:', error.message);
      return localStorageGet(TABLES.agencies);
    }
  },

  async create(agency) {
    if (!isSupabaseConfigured) {
      const newAgency = { ...agency, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.agencies);
      all.unshift(newAgency);
      localStorageSet(TABLES.agencies, all);
      return newAgency;
    }
    try {
      // Only include fields that exist in the schema
      const agencyData = {
        name: agency.name || '',
        service: agency.service || null,
        logo: agency.logo || null,
        contact: agency.contact || null,
        email: agency.email || null,
        street: agency.street || null,
        city: agency.city || null,
        state: agency.state || null,
        country: agency.country || null,
        zip: agency.zip || null,
        active: agency.active !== undefined ? agency.active : true,
        notes: agency.notes || null,
      };
      const { data, error } = await supabase
        .from(TABLES.agencies)
        .insert(agencyData)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Supabase create agency failed, using localStorage:', error);
      const newAgency = { ...agency, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.agencies);
      all.unshift(newAgency);
      localStorageSet(TABLES.agencies, all);
      return newAgency;
    }
  },

  async update(id, updates) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.agencies);
      const index = all.findIndex(a => a.id === id);
      if (index === -1) throw new Error('Agency not found');
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.agencies, all);
      return all[index];
    }
    try {
      const { data, error } = await supabase
        .from(TABLES.agencies)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Supabase update agency failed, using localStorage:', error);
      const all = localStorageGet(TABLES.agencies);
      const index = all.findIndex(a => a.id === id);
      if (index === -1) throw new Error('Agency not found');
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.agencies, all);
      return all[index];
    }
  },

  async delete(id) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.agencies);
      const filtered = all.filter(a => a.id !== id);
      localStorageSet(TABLES.agencies, filtered);
      return;
    }
    try {
      const { error } = await supabase
        .from(TABLES.agencies)
        .delete()
        .eq('id', id);
      if (error) throw error;
      // Sync to localStorage after successful delete
      const all = localStorageGet(TABLES.agencies);
      const filtered = all.filter(a => a.id !== id);
      localStorageSet(TABLES.agencies, filtered);
    } catch (error) {
      console.warn('Supabase delete agency failed, using localStorage:', error);
      const all = localStorageGet(TABLES.agencies);
      const filtered = all.filter(a => a.id !== id);
      localStorageSet(TABLES.agencies, filtered);
    }
  },
};

// Brands
export const dbBrands = {
  getCached() {
    return localStorageGet(TABLES.brands);
  },
  async getAll() {
    if (!isSupabaseConfigured) {
      return localStorageGet(TABLES.brands);
    }
    
    // Ensure Supabase is connected (fast check)
    await initializeSupabase();
    
    try {
      // Fast query with 5 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      );
      
      const queryPromise = supabase
        .from(TABLES.brands)
        .select('id, name, service, logo, contact, email, street, city, state, country, zip, active, notes, created_at, updated_at')
        .order('created_at', { ascending: false });
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data, error } = result || {};
      
      if (error) throw error;
      
      const supabaseData = Array.isArray(data) ? data : [];
      localStorageSet(TABLES.brands, supabaseData);
      return supabaseData;
    } catch (error) {
      console.error('Failed to load brands from Supabase:', error.message);
      return localStorageGet(TABLES.brands);
    }
  },

  async create(brand) {
    if (!isSupabaseConfigured) {
      const newBrand = { ...brand, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.brands);
      all.unshift(newBrand);
      localStorageSet(TABLES.brands, all);
      return newBrand;
    }
    try {
      // Only include fields that exist in the schema
      const brandData = {
        name: brand.name || '',
        service: brand.service || null,
        logo: brand.logo || null,
        contact: brand.contact || null,
        email: brand.email || null,
        street: brand.street || null,
        city: brand.city || null,
        state: brand.state || null,
        country: brand.country || null,
        zip: brand.zip || null,
        active: brand.active !== undefined ? brand.active : true,
        notes: brand.notes || null,
      };
      const { data, error } = await supabase
        .from(TABLES.brands)
        .insert(brandData)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Supabase create brand failed, using localStorage:', error);
      const newBrand = { ...brand, id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const all = localStorageGet(TABLES.brands);
      all.unshift(newBrand);
      localStorageSet(TABLES.brands, all);
      return newBrand;
    }
  },

  async update(id, updates) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.brands);
      const index = all.findIndex(b => b.id === id);
      if (index === -1) throw new Error('Brand not found');
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.brands, all);
      return all[index];
    }
    try {
      const { data, error } = await supabase
        .from(TABLES.brands)
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } catch (error) {
      console.warn('Supabase update brand failed, using localStorage:', error);
      const all = localStorageGet(TABLES.brands);
      const index = all.findIndex(b => b.id === id);
      if (index === -1) throw new Error('Brand not found');
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet(TABLES.brands, all);
      return all[index];
    }
  },

  async delete(id) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet(TABLES.brands);
      const filtered = all.filter(b => b.id !== id);
      localStorageSet(TABLES.brands, filtered);
      return;
    }
    try {
      const { error } = await supabase
        .from(TABLES.brands)
        .delete()
        .eq('id', id);
      if (error) throw error;
      // Sync to localStorage after successful delete
      const all = localStorageGet(TABLES.brands);
      const filtered = all.filter(b => b.id !== id);
      localStorageSet(TABLES.brands, filtered);
    } catch (error) {
      console.warn('Supabase delete brand failed, using localStorage:', error);
      const all = localStorageGet(TABLES.brands);
      const filtered = all.filter(b => b.id !== id);
      localStorageSet(TABLES.brands, filtered);
    }
  },
};

// Settings
export const dbSettings = {
  async get(key) {
    if (!isSupabaseConfigured) {
      try {
        const settings = JSON.parse(localStorage.getItem(getStorageKey(TABLES.settings)) || '{}');
        return settings[key] || null;
      } catch {
        return null;
      }
    }
    const { data, error } = await supabase
      .from(TABLES.settings)
      .select('value')
      .eq('key', key)
      .single();
    if (error && error.code !== 'PGRST116') handleError(error, 'get setting'); // PGRST116 = not found
    return data?.value || null;
  },

  async set(key, value) {
    if (!isSupabaseConfigured) {
      try {
        const settings = JSON.parse(localStorage.getItem(getStorageKey(TABLES.settings)) || '{}');
        settings[key] = value;
        localStorage.setItem(getStorageKey(TABLES.settings), JSON.stringify(settings));
        return;
      } catch (error) {
        console.error('Failed to save setting to localStorage:', error);
      }
    }
    const { error } = await supabase
      .from(TABLES.settings)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    if (error) handleError(error, 'set setting');
  },
};

// Activity Logs
export const dbActivityLogs = {
  getCached() {
    try {
      const data = localStorage.getItem('nexvoide_activity_logs');
      if (!data) return [];
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  async getAll(limit = 100) {
    if (!isSupabaseConfigured) {
      return this.getCached().slice(0, limit);
    }
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) {
        console.error('Supabase activity_logs getAll error:', error);
        throw error;
      }
      
      const supabaseData = Array.isArray(data) ? data : [];
      // Sync to localStorage
      try {
        localStorage.setItem('nexvoide_activity_logs', JSON.stringify(supabaseData.slice(0, 1000)));
      } catch (e) {
        console.warn('Failed to sync activity logs to localStorage:', e);
      }
      
      return supabaseData;
    } catch (error) {
      console.warn('Supabase getAll activity_logs failed, using localStorage:', error);
      return this.getCached().slice(0, limit);
    }
  },

  async create(activityData) {
    const newActivity = {
      ...activityData,
      id: activityData.id || crypto.randomUUID(),
      created_at: activityData.created_at || new Date().toISOString(),
    };
    
    if (!isSupabaseConfigured) {
      const all = this.getCached();
      all.unshift(newActivity);
      // Keep only last 1000 in localStorage
      const limited = all.slice(0, 1000);
      try {
        localStorage.setItem('nexvoide_activity_logs', JSON.stringify(limited));
      } catch (e) {
        console.warn('Failed to save activity log to localStorage:', e);
      }
      return newActivity;
    }
    
    try {
      // Map fields to match database schema
      // Schema has: id, user_id, action, entity_type, entity_id, details, created_at
      // Code sends: entity_type, entity_id, action, description, old_value, new_value, user_name
      const schemaData = {
        user_id: activityData.user_name || activityData.user_id || null,
        action: activityData.action,
        entity_type: activityData.entity_type,
        entity_id: activityData.entity_id,
        // Store description, old_value, new_value in details JSONB column
        details: {
          description: activityData.description || null,
          old_value: activityData.old_value || null,
          new_value: activityData.new_value || null,
          user_name: activityData.user_name || null
        }
      };
      
      const { data, error } = await supabase
        .from('activity_logs')
        .insert(schemaData)
        .select()
        .single();
      
      if (error) {
        // If error mentions unknown column, try storing everything in details
        if (error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.code === '42703') {
          console.warn('Activity log columns may not match schema, storing in details:', error.message);
          // Fallback: store everything in details JSONB
          const fallbackData = {
            user_id: activityData.user_name || activityData.user_id || null,
            action: activityData.action,
            entity_type: activityData.entity_type,
            entity_id: activityData.entity_id,
            details: activityData // Store all fields in details
          };
          
          const { data: fallbackResult, error: fallbackError } = await supabase
            .from('activity_logs')
            .insert(fallbackData)
            .select()
            .single();
          
          if (fallbackError) {
            console.error('Supabase activity_logs create error (fallback):', fallbackError);
            // Fallback to localStorage
            const all = this.getCached();
            all.unshift(newActivity);
            const limited = all.slice(0, 1000);
            try {
              localStorage.setItem('nexvoide_activity_logs', JSON.stringify(limited));
            } catch (e) {
              console.warn('Failed to save activity log to localStorage:', e);
            }
            return newActivity;
          }
          
          // Sync to localStorage
          const all = this.getCached();
          all.unshift(fallbackResult);
          const limited = all.slice(0, 1000);
          try {
            localStorage.setItem('nexvoide_activity_logs', JSON.stringify(limited));
          } catch (e) {
            console.warn('Failed to sync activity log to localStorage:', e);
          }
          return fallbackResult;
        }
        
        console.error('Supabase activity_logs create error:', error);
        // Fallback to localStorage
        const all = this.getCached();
        all.unshift(newActivity);
        const limited = all.slice(0, 1000);
        try {
          localStorage.setItem('nexvoide_activity_logs', JSON.stringify(limited));
        } catch (e) {
          console.warn('Failed to save activity log to localStorage:', e);
        }
        return newActivity;
      }
      
      // Sync to localStorage
      const all = this.getCached();
      all.unshift(data);
      const limited = all.slice(0, 1000);
      try {
        localStorage.setItem('nexvoide_activity_logs', JSON.stringify(limited));
      } catch (e) {
        console.warn('Failed to sync activity log to localStorage:', e);
      }
      
      return data;
    } catch (error) {
      console.warn('Supabase create activity_log failed, using localStorage:', error);
      // Fallback to localStorage
      const all = this.getCached();
      all.unshift(newActivity);
      const limited = all.slice(0, 1000);
      try {
        localStorage.setItem('nexvoide_activity_logs', JSON.stringify(limited));
      } catch (e) {
        console.warn('Failed to save activity log to localStorage:', e);
      }
      return newActivity;
    }
  },
};

// Users (Authentication)
export const dbUsers = {
  getCached() {
    return localStorageGet('users');
  },

  async getAll() {
    // Check in-memory cache first (fastest)
    const cacheKey = queryCache.getKey('USERS');
    const cached = queryCache.get(cacheKey);
    if (cached !== null) {
      return cached;
    }

    if (!isSupabaseConfigured) {
      const data = localStorageGet('users');
      const result = Array.isArray(data) ? data : [];
      queryCache.set(cacheKey, result, queryCache.getTTL('USERS'));
      return result;
    }
    
    // Ensure Supabase is connected (fast check)
    await initializeSupabase();
    
    try {
      // Fast query with 5 second timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout after 5 seconds')), 5000)
      );
      
      const queryPromise = supabase
        .from('users')
        .select('id, username, name, email, role, avatar, active, service, user_id, created_at, updated_at')
        .order('created_at', { ascending: false })
        .limit(1000);
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data, error } = result || {};
      
      if (error) throw error;
      
      const supabaseData = Array.isArray(data) ? data : [];
      localStorageSet('users', supabaseData);
      // Cache the result
      queryCache.set(cacheKey, supabaseData, queryCache.getTTL('USERS'));
      return supabaseData;
    } catch (error) {
      console.error('Failed to load users from Supabase:', error.message);
      // Return cached data on error (don't block UI)
      const data = localStorageGet('users');
      const result = Array.isArray(data) ? data : [];
      queryCache.set(cacheKey, result, queryCache.getTTL('USERS'));
      return result;
    }
  },

  async getByUsername(username) {
    // Always require Supabase for authentication - no localStorage fallback
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured. Please check your environment variables.');
    }
    
    // Ensure Supabase is connected before querying
    const isReady = await initializeSupabase();
    if (!isReady) {
      throw new Error('Supabase connection failed. Please check your network connection and try again.');
    }
    
    try {
      // Add timeout to fail fast if network is slow
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Query timeout - Supabase connection is slow')), 10000)
      );
      
      // First try exact match (fastest)
      const queryPromise = supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      
      const result = await Promise.race([queryPromise, timeoutPromise]);
      const { data: exactData, error: exactError } = result || {};
      
      if (exactError) {
        // PGRST116 = not found, which is OK (user doesn't exist)
        if (exactError.code === 'PGRST116') {
          return null;
        }
        // Other errors should be thrown
        throw exactError;
      }
      
      if (exactData) {
        // Update cache for faster subsequent loads (but don't use for auth)
        const cached = localStorageGet('users');
        if (Array.isArray(cached)) {
          const updated = cached.find(u => u.id === exactData.id) 
            ? cached.map(u => u.id === exactData.id ? exactData : u)
            : [exactData, ...cached];
          localStorageSet('users', updated);
        } else {
          localStorageSet('users', [exactData]);
        }
        return exactData;
      }
      
      // If exact match fails, try case-insensitive search
      const caseQueryPromise = supabase
        .from('users')
        .select('*')
        .ilike('username', username)
        .maybeSingle();
      
      const caseResult = await Promise.race([caseQueryPromise, timeoutPromise]);
      const { data: caseInsensitiveData, error: caseError } = caseResult || {};
      
      if (caseError) {
        if (caseError.code === 'PGRST116') {
          return null;
        }
        throw caseError;
      }
      
      if (caseInsensitiveData) {
        // Update cache
        const cached = localStorageGet('users');
        if (Array.isArray(cached)) {
          const updated = cached.find(u => u.id === caseInsensitiveData.id) 
            ? cached.map(u => u.id === caseInsensitiveData.id ? caseInsensitiveData : u)
            : [caseInsensitiveData, ...cached];
          localStorageSet('users', updated);
        } else {
          localStorageSet('users', [caseInsensitiveData]);
        }
        return caseInsensitiveData;
      }
      
      // User not found
      return null;
    } catch (error) {
      // Re-throw error - don't fallback to localStorage for authentication
      console.error('Supabase query error:', error);
      throw new Error(`Failed to query user: ${error.message}`);
    }
  },

  async create(userData) {
    if (!isSupabaseConfigured) {
      const newUser = { 
        ...userData, 
        id: crypto.randomUUID(), 
        created_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      };
      const all = localStorageGet('users');
      all.unshift(newUser);
      localStorageSet('users', all);
      return newUser;
    }
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    if (error) handleError(error, 'create user');
    // Sync to localStorage
    const all = localStorageGet('users');
    all.unshift(data);
    localStorageSet('users', all);
    return data;
  },

  async update(id, updates) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet('users');
      const index = all.findIndex(u => u.id === id);
      if (index === -1) throw new Error('User not found');
      all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
      localStorageSet('users', all);
      return all[index];
    }
    
    try {
      let data = null;
      const { data: updateData, error } = await supabase
        .from('users')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      
      // If error mentions unknown column (like 'avatar'), retry without that field
      if (error && (error.message?.includes('column') || error.message?.includes('does not exist') || error.message?.includes('schema cache') || error.code === '42703')) {
        console.warn('Avatar column may not exist, retrying without avatar field:', error.message);
        const updateDataNoAvatar = { ...updates };
        delete updateDataNoAvatar.avatar;
        
        const result = await supabase
          .from('users')
          .update({ ...updateDataNoAvatar, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        
        if (result.error) {
          handleError(result.error, 'update user');
        } else {
          // Store avatar in localStorage even if column doesn't exist in Supabase
          if (updates.avatar) {
            const all = localStorageGet('users');
            const index = all.findIndex(u => u.id === id);
            if (index !== -1) {
              all[index] = { ...all[index], avatar: updates.avatar };
              localStorageSet('users', all);
            }
          }
          data = result.data;
        }
      } else if (error) {
        handleError(error, 'update user');
      } else {
        data = updateData;
      }
      
      // Sync to localStorage (include avatar even if not in Supabase)
      const all = localStorageGet('users');
      const index = all.findIndex(u => u.id === id);
      if (index !== -1) {
        const cachedUser = { ...all[index], ...updates };
        if (data) {
          all[index] = { ...cachedUser, ...data };
        } else {
          all[index] = cachedUser;
        }
        localStorageSet('users', all);
      }
      
      return data || all[index];
    } catch (error) {
      console.error('Failed to update user:', error);
      // Fallback to localStorage if Supabase fails
      const all = localStorageGet('users');
      const index = all.findIndex(u => u.id === id);
      if (index !== -1) {
        all[index] = { ...all[index], ...updates, updated_at: new Date().toISOString() };
        localStorageSet('users', all);
        return all[index];
      }
      throw error;
    }
  },

  async delete(id) {
    if (!isSupabaseConfigured) {
      const all = localStorageGet('users');
      const filtered = all.filter(u => u.id !== id);
      localStorageSet('users', filtered);
      return;
    }
    const { error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);
    if (error) handleError(error, 'delete user');
    // Sync to localStorage
    const all = localStorageGet('users');
    const filtered = all.filter(u => u.id !== id);
    localStorageSet('users', filtered);
  },
};

// User Online Status
export const dbUserOnlineStatus = {
  // Update user's online status (heartbeat)
  async updateStatus(userId) {
    if (!isSupabaseConfigured) {
      // Fallback to localStorage for offline mode
      try {
        const onlineStatusKey = 'nexvoide_online_status';
        let onlineStatus = {};
        const stored = localStorage.getItem(onlineStatusKey);
        if (stored) {
          onlineStatus = JSON.parse(stored);
        }
        onlineStatus[userId] = Date.now();
        // Clean up old entries
        const oneMinuteAgo = Date.now() - 60000;
        Object.keys(onlineStatus).forEach(key => {
          if (onlineStatus[key] < oneMinuteAgo) {
            delete onlineStatus[key];
          }
        });
        localStorage.setItem(onlineStatusKey, JSON.stringify(onlineStatus));
      } catch (e) {
        console.warn('Failed to update online status in localStorage:', e);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('user_online_status')
        .upsert({
          user_id: userId,
          last_seen: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });
      
      if (error) {
        // If table doesn't exist, fall back to localStorage
        console.warn('Failed to update online status in Supabase (table may not exist):', error);
        // Fallback to localStorage
        try {
          const onlineStatusKey = 'nexvoide_online_status';
          let onlineStatus = {};
          const stored = localStorage.getItem(onlineStatusKey);
          if (stored) {
            onlineStatus = JSON.parse(stored);
          }
          onlineStatus[userId] = Date.now();
          localStorage.setItem(onlineStatusKey, JSON.stringify(onlineStatus));
        } catch (e) {
          console.warn('Failed to update online status in localStorage:', e);
        }
      }
    } catch (error) {
      console.warn('Failed to update online status:', error);
    }
  },

  // Get all online users
  async getOnlineUsers(thresholdSeconds = 30) {
    if (!isSupabaseConfigured) {
      // Fallback to localStorage
      try {
        const onlineStatusKey = 'nexvoide_online_status';
        const stored = localStorage.getItem(onlineStatusKey);
        if (!stored) return new Set();
        
        const onlineStatus = JSON.parse(stored);
        const now = Date.now();
        const threshold = thresholdSeconds * 1000;
        const onlineIds = new Set();
        
        Object.keys(onlineStatus).forEach(userId => {
          const lastSeen = onlineStatus[userId];
          if (lastSeen && (now - lastSeen) <= threshold) {
            onlineIds.add(userId);
          }
        });
        
        return onlineIds;
      } catch (e) {
        console.warn('Failed to read online status from localStorage:', e);
        return new Set();
      }
    }

    try {
      const threshold = new Date(Date.now() - thresholdSeconds * 1000).toISOString();
      const { data, error } = await supabase
        .from('user_online_status')
        .select('user_id')
        .gte('last_seen', threshold);

      if (error) {
        // If table doesn't exist, fall back to localStorage
        console.warn('Failed to get online users from Supabase (table may not exist):', error);
        // Try localStorage fallback
        try {
          const onlineStatusKey = 'nexvoide_online_status';
          const stored = localStorage.getItem(onlineStatusKey);
          if (!stored) return new Set();
          
          const onlineStatus = JSON.parse(stored);
          const now = Date.now();
          const threshold = thresholdSeconds * 1000;
          const onlineIds = new Set();
          
          Object.keys(onlineStatus).forEach(userId => {
            const lastSeen = onlineStatus[userId];
            if (lastSeen && (now - lastSeen) <= threshold) {
              onlineIds.add(userId);
            }
          });
          
          return onlineIds;
        } catch (e) {
          console.warn('Failed to read online status from localStorage:', e);
          return new Set();
        }
      }

      const onlineIds = new Set();
      if (data && Array.isArray(data)) {
        data.forEach(row => {
          if (row.user_id) {
            onlineIds.add(row.user_id);
          }
        });
      }

      return onlineIds;
    } catch (error) {
      console.warn('Failed to get online users:', error);
      // Fallback to localStorage
      try {
        const onlineStatusKey = 'nexvoide_online_status';
        const stored = localStorage.getItem(onlineStatusKey);
        if (!stored) return new Set();
        
        const onlineStatus = JSON.parse(stored);
        const now = Date.now();
        const threshold = thresholdSeconds * 1000;
        const onlineIds = new Set();
        
        Object.keys(onlineStatus).forEach(userId => {
          const lastSeen = onlineStatus[userId];
          if (lastSeen && (now - lastSeen) <= threshold) {
            onlineIds.add(userId);
          }
        });
        
        return onlineIds;
      } catch (e) {
        console.warn('Failed to read online status from localStorage:', e);
        return new Set();
      }
    }
  },

  // Remove user's online status (on logout)
  async removeStatus(userId) {
    if (!isSupabaseConfigured) {
      // Fallback to localStorage
      try {
        const onlineStatusKey = 'nexvoide_online_status';
        const stored = localStorage.getItem(onlineStatusKey);
        if (stored) {
          const onlineStatus = JSON.parse(stored);
          delete onlineStatus[userId];
          localStorage.setItem(onlineStatusKey, JSON.stringify(onlineStatus));
        }
      } catch (e) {
        console.warn('Failed to remove online status from localStorage:', e);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('user_online_status')
        .delete()
        .eq('user_id', userId);
      
      if (error) {
        console.warn('Failed to remove online status from Supabase:', error);
        // Fallback to localStorage
        try {
          const onlineStatusKey = 'nexvoide_online_status';
          const stored = localStorage.getItem(onlineStatusKey);
          if (stored) {
            const onlineStatus = JSON.parse(stored);
            delete onlineStatus[userId];
            localStorage.setItem(onlineStatusKey, JSON.stringify(onlineStatus));
          }
        } catch (e) {
          console.warn('Failed to remove online status from localStorage:', e);
        }
      }
    } catch (error) {
      console.warn('Failed to remove online status:', error);
    }
  },
};

