/**
 * Monthly Closing System Utilities
 * Handles archiving, project pull-forward, and month closing logic
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';
import { dbProjects } from '../lib/db.js';
import { convert } from "../stores/appStore.js";

/**
 * Get current month and year
 */
export function getCurrentMonthYear() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1, // 1-12
    monthLabel: now.toLocaleString('default', { month: 'long', year: 'numeric' })
  };
}

/**
 * Get the month that should normally be closed.
 * Example: on May 1, you usually close April.
 */
export function getClosableMonthYear() {
  const now = new Date();
  const closable = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    year: closable.getFullYear(),
    month: closable.getMonth() + 1,
    monthLabel: closable.toLocaleString('default', { month: 'long', year: 'numeric' })
  };
}

/**
 * Get month label from year and month
 */
export function getMonthLabel(year, month) {
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('default', { month: 'long', year: 'numeric' });
}

/**
 * Check if a project is completed
 */
export function isProjectCompleted(project) {
  const completedStatuses = ['Completed', 'completed', 'Done', 'done'];
  return completedStatuses.includes(project.status);
}

/**
 * Check if a project is incomplete
 */
export function isProjectIncomplete(project) {
  const incompleteStatuses = ['In Progress', 'in progress', 'Pending', 'pending', 'Revision', 'revision', 'Revising'];
  return incompleteStatuses.includes(project.status);
}

/**
 * Calculate project financials
 */
export function calculateProjectFinancials(project, currency = 'USD', rate = 280) {
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

  const order = convert(project.amount || 0, project.currency || 'USD', currency, rate);
  const assignedArray = ensureAssigned(project.assigned);
  let teamCost = 0;
  
  for (const a of assignedArray) {
    if (a.costType === 'percentage') {
      teamCost += order * (Number(a.costValue) || 0) / 100;
    } else {
      teamCost += convert(a.costValue || 0, 'PKR', currency, rate);
    }
  }
  
  const profit = order - teamCost;
  
  return {
    revenue: order,
    teamCost,
    profit,
    currency
  };
}

/**
 * Get projects for a specific month
 * This includes both active and archived projects for that month
 */
export async function getProjectsForMonth(year, month, includeArchived = true) {
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    
    // Get active (non-archived) projects
    const activeProjects = await dbProjects.getAll();
    
    // Also get archived projects for this month if needed
    let archivedProjects = [];
    if (includeArchived && isSupabaseConfigured && supabase) {
      try {
        // Find archived month for this year/month
        const { data: archivedMonth } = await supabase
          .from('archived_months')
          .select('id')
          .eq('year', year)
          .eq('month', month)
          .single();
        
        if (archivedMonth) {
          const { data: archived } = await supabase
            .from('archived_projects')
            .select('*')
            .eq('archived_month_id', archivedMonth.id);
          
          if (archived) archivedProjects = archived;
        }
      } catch (error) {
        console.warn('Error loading archived projects:', error);
      }
    }
    
    // Filter active projects for this month
    // IMPORTANT: Pulled-forward projects are ALWAYS included regardless of dates or status
    // This ensures that when you check a project in Review dialog, it's pulled forward
    const monthActiveProjects = activeProjects.filter(project => {
      const isPulledForward = project.pulled_forward === true || project.pulledForward === true;
      
      // If project is pulled forward, ALWAYS include it (regardless of dates or status)
      // This is the primary way to pull forward - based on checkbox selection in Review dialog
      if (isPulledForward) {
        return true;
      }
      
      // For non-pulled-forward projects, check if they were active during this month
      const projectStart = project.start_date ? new Date(project.start_date) : null;
      const projectEnd = project.end_date ? new Date(project.end_date) : null;
      const projectCreated = project.created_at ? new Date(project.created_at) : null;
      
      // Project is in month if:
      // 1. It was created in this month, OR
      // 2. It started in this month, OR
      // 3. It ended in this month, OR
      // 4. It spans this month (started before and ended after)
      if (projectCreated && projectCreated >= startDate && projectCreated <= endDate) {
        return true;
      }
      if (projectStart && projectStart >= startDate && projectStart <= endDate) {
        return true;
      }
      if (projectEnd && projectEnd >= startDate && projectEnd <= endDate) {
        return true;
      }
      if (projectStart && projectEnd && projectStart <= startDate && projectEnd >= endDate) {
        return true;
      }
      
      return false;
    });
    
    // Combine active and archived projects
    return [...monthActiveProjects, ...archivedProjects];
  } catch (error) {
    console.error('Error getting projects for month:', error);
    return [];
  }
}

function isDateInRange(d, startDate, endDate) {
  if (!d) return false;
  return d >= startDate && d <= endDate;
}

function wasProjectActiveInMonth(project, startDate, endDate) {
  const projectStart = project.start_date ? new Date(project.start_date) : (project.startDate ? new Date(project.startDate) : null);
  const projectEnd = project.end_date ? new Date(project.end_date) : (project.endDate ? new Date(project.endDate) : null);
  const projectCreated = project.created_at ? new Date(project.created_at) : null;

  // Same “in month” logic used in getProjectsForMonth (minus pulled_forward shortcut)
  if (projectCreated && isDateInRange(projectCreated, startDate, endDate)) return true;
  if (projectStart && isDateInRange(projectStart, startDate, endDate)) return true;
  if (projectEnd && isDateInRange(projectEnd, startDate, endDate)) return true;
  if (projectStart && projectEnd && projectStart <= startDate && projectEnd >= endDate) return true;
  return false;
}

/**
 * Calculate monthly statistics
 */
export async function calculateMonthlyStats(year, month, currency = 'USD', rate = 280) {
  const projects = await getProjectsForMonth(year, month);
  
  let totalRevenue = 0;
  let totalExpenses = 0;
  let completedRevenue = 0;
  let pendingRevenue = 0;
  let inProgressRevenue = 0;
  let cancelledRevenue = 0;
  let revisionRevenue = 0;
  
  let totalProjects = projects.length;
  let completedProjects = 0;
  let inProgressProjects = 0;
  let pendingProjects = 0;
  let cancelledProjects = 0;
  let revisionProjects = 0;
  
  let totalTeamCost = 0;
  let totalBillingHours = 0;
  
  const platformRevenue = {};
  const serviceRevenue = {};
  const employeeCosts = {};
  
  for (const project of projects) {
    const financials = calculateProjectFinancials(project, currency, rate);
    totalRevenue += financials.revenue;
    totalExpenses += financials.teamCost;
    totalTeamCost += financials.teamCost;
    
    // Count by status
    const status = project.status || 'In Progress';
    if (status === 'Completed' || status === 'completed') {
      completedProjects++;
      completedRevenue += financials.revenue;
    } else if (status === 'Pending' || status === 'pending') {
      pendingProjects++;
      pendingRevenue += financials.revenue;
    } else if (status === 'In Progress' || status === 'in progress') {
      inProgressProjects++;
      inProgressRevenue += financials.revenue - financials.teamCost; // Net value
    } else if (status === 'Cancelled' || status === 'cancelled' || status === 'Cancel') {
      cancelledProjects++;
      cancelledRevenue += financials.revenue;
    } else if (status === 'Revision' || status === 'revision' || status === 'Revising') {
      revisionProjects++;
      revisionRevenue += financials.revenue - financials.teamCost; // Net value
    }
    
    // Platform breakdown
    const platform = project.platform || 'Direct';
    platformRevenue[platform] = (platformRevenue[platform] || 0) + financials.revenue;
    
    // Service breakdown
    const service = project.service || 'Other';
    serviceRevenue[service] = (serviceRevenue[service] || 0) + financials.revenue;
    
    // Employee costs
    const ensureAssigned = (assigned) => {
      if (Array.isArray(assigned)) return assigned;
      if (typeof assigned === 'string') {
        try {
          return JSON.parse(assigned);
        } catch {
          return [];
        }
      }
      return [];
    };
    
    const assignedArray = ensureAssigned(project.assigned);
    for (const a of assignedArray) {
      const empName = a.name || 'Unknown';
      if (!employeeCosts[empName]) {
        employeeCosts[empName] = { name: empName, cost: 0 };
      }
      if (a.costType === 'percentage') {
        employeeCosts[empName].cost += financials.revenue * (Number(a.costValue) || 0) / 100;
      } else {
        employeeCosts[empName].cost += convert(a.costValue || 0, 'PKR', currency, rate);
      }
    }
  }
  
  const netProfit = totalRevenue - totalExpenses;
  
  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    completedRevenue,
    pendingRevenue,
    inProgressRevenue,
    cancelledRevenue,
    revisionRevenue,
    totalProjects,
    completedProjects,
    inProgressProjects,
    pendingProjects,
    cancelledProjects,
    revisionProjects,
    totalTeamCost,
    totalBillingHours,
    platformRevenue,
    serviceRevenue,
    employeeCosts
  };
}

/**
 * Archive a project
 */
export async function archiveProject(project, archivedMonthId, currency = 'USD', rate = 280) {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, cannot archive project');
    return null;
  }
  
  const financials = calculateProjectFinancials(project, currency, rate);
  
  const archivedProject = {
    archived_month_id: archivedMonthId,
    original_project_id: project.id,
    platform: project.platform,
    profile_id: project.profile_id,
    agency_id: project.agency_id,
    brand_id: project.brand_id,
    client_name: project.client_name || project.clientName || '',
    project_name: project.project_name || project.projectName || '',
    service: project.service,
    quantity: project.quantity,
    revision_quantity: project.revision_quantity,
    amount: project.amount || 0,
    currency: project.currency || 'USD',
    status: 'Completed', // Archived projects are always marked as completed
    is_revision: project.is_revision || false,
    start_date: project.start_date || project.startDate,
    end_date: project.end_date || project.endDate,
    deadline: project.deadline,
    assigned: typeof project.assigned === 'string' ? project.assigned : JSON.stringify(project.assigned || []),
    raw_source_link: project.raw_source_link || project.rawSourceLink,
    attachments: typeof project.attachments === 'string' ? project.attachments : JSON.stringify(project.attachments || []),
    team_cost: financials.teamCost,
    profit: financials.profit,
    billing_hours: 0, // TODO: Calculate from time tracking if available
    original_created_at: project.created_at,
    original_updated_at: project.updated_at
  };
  
  try {
    const { data, error } = await supabase
      .from('archived_projects')
      .insert(archivedProject)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error archiving project:', error);
    throw error;
  }
}

/**
 * Pull forward a project to next month
 */
export async function pullForwardProject(projectId, fromYear, fromMonth, toYear, toMonth, userId, reason = '') {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('Supabase not configured, cannot pull forward project');
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('project_pull_forwards')
      .insert({
        project_id: projectId,
        from_year: fromYear,
        from_month: fromMonth,
        to_year: toYear,
        to_month: toMonth,
        pulled_by: userId,
        reason: reason || 'Incomplete project moved to next month'
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error pulling forward project:', error);
    throw error;
  }
}

/**
 * Close a month - main function
 */
export async function closeMonth(year, month, userId, options = {}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured. Cannot close month.');
  }
  
  const {
    currency = 'USD',
    rate = 280,
    projectsToArchive = [], // Array of project IDs to archive
    projectsToPullForward = [], // Array of project IDs to pull forward
    notes = ''
  } = options;
  
  // Check if month is already closed - if so, we'll update it instead
  const { data: existing } = await supabase
    .from('archived_months')
    .select('id')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle(); // Use maybeSingle to avoid error if not found
  
  let archivedMonthId;
  let isUpdate = false;
  
  // Calculate statistics first (before modifying projects)
  const stats = await calculateMonthlyStats(year, month, currency, rate);
  
  // Get all projects for the month
  const allProjects = await getProjectsForMonth(year, month);
  
  // Separate projects based on user's explicit selections
  // Only archive/pull forward projects that user explicitly selected
  // If user unchecks a project, it should NOT be archived/pulled forward
  
  // Normalize IDs to strings for consistent comparison
  const normalizeId = (id) => String(id || '').trim();
  const archiveIds = new Set(projectsToArchive.map(normalizeId));
  const pullForwardIds = new Set(projectsToPullForward.map(normalizeId));
  
  const completedProjects = allProjects.filter(p => {
    const projectId = normalizeId(p.id);
    return archiveIds.has(projectId);
  });
  
  // For pull forward: Get projects from allProjects that match the selected IDs
  // This ensures ANY project can be pulled forward, regardless of status
  const incompleteProjects = allProjects.filter(p => {
    const projectId = normalizeId(p.id);
    return pullForwardIds.has(projectId);
  });
  
  // Debug logging with detailed ID matching
  console.log('📋 Close Month - Project Selection:');
  console.log('  - Total projects for month:', allProjects.length);
  console.log('  - All project IDs:', allProjects.map(p => ({ id: p.id, name: p.project_name || p.projectName, status: p.status })));
  console.log('  - Projects to archive (IDs):', Array.from(archiveIds));
  console.log('  - Projects to pull forward (IDs):', Array.from(pullForwardIds));
  console.log('  - Filtered completed projects:', completedProjects.length);
  console.log('  - Filtered incomplete projects:', incompleteProjects.length);
  console.log('  - Incomplete project details:', incompleteProjects.map(p => ({ 
    id: p.id, 
    idNormalized: normalizeId(p.id),
    name: p.project_name || p.projectName, 
    status: p.status 
  })));
  
  // Check for missing projects
  const missingArchive = Array.from(archiveIds).filter(id => 
    !allProjects.some(p => normalizeId(p.id) === id)
  );
  const missingPullForward = Array.from(pullForwardIds).filter(id => 
    !allProjects.some(p => normalizeId(p.id) === id)
  );
  
  if (missingArchive.length > 0) {
    console.warn('⚠️ Projects to archive not found in month:', missingArchive);
  }
  if (missingPullForward.length > 0) {
    console.warn('⚠️ Projects to pull forward not found in month:', missingPullForward);
  }
  
  // Projects that are neither archived nor pulled forward will remain in the system as-is
  
  if (existing) {
    // Month already closed - we'll update it
    archivedMonthId = existing.id;
    isUpdate = true;
    
    // Get list of project IDs that will be archived/pulled forward in this update
    const newArchiveIds = new Set(completedProjects.map(p => p.id));
    const newPullForwardIds = new Set(incompleteProjects.map(p => p.id));
    
    // Delete existing archived projects and finance snapshot for this month
    // (we'll recreate them with fresh data)
    await supabase
      .from('archived_projects')
      .delete()
      .eq('archived_month_id', archivedMonthId);
    
    await supabase
      .from('monthly_finance_snapshots')
      .delete()
      .eq('archived_month_id', archivedMonthId);
    
    // Get all projects that were previously archived for this month
    const { data: previouslyArchived } = await supabase
      .from('projects')
      .select('id')
      .eq('archived_month_id', archivedMonthId);
    
    // Un-archive only projects that will be re-archived OR that are not in the new selection
    // This ensures unchecked projects stay archived (don't reappear)
    if (previouslyArchived && previouslyArchived.length > 0) {
      const previouslyArchivedIds = previouslyArchived.map(p => p.id);
      
      for (const projectId of previouslyArchivedIds) {
        if (newArchiveIds.has(projectId)) {
          // Will be re-archived - un-archive it first so it can be re-archived
          await supabase
            .from('projects')
            .update({ 
              archived: false,
              archived_month_id: null
            })
            .eq('id', projectId);
        }
        // If projectId is NOT in newArchiveIds, leave it archived (user unchecked it)
      }
    }
    
    // Reset pulled_forward for projects that were pulled forward from this month
    // Only reset if they're in the new pull-forward list (will be re-set)
    // OR if they're not in any list (user unchecked them)
    try {
      const { data: pullForwardRecords } = await supabase
        .from('project_pull_forwards')
        .select('project_id')
        .eq('from_year', year)
        .eq('from_month', month);
      
      if (pullForwardRecords && pullForwardRecords.length > 0) {
        const previousPullForwardIds = pullForwardRecords.map(p => p.project_id).filter(Boolean);
        
        for (const projectId of previousPullForwardIds) {
          if (newPullForwardIds.has(projectId) || (!newArchiveIds.has(projectId) && !newPullForwardIds.has(projectId))) {
            // Will be re-pulled forward OR unchecked - reset the flag
            await supabase
              .from('projects')
              .update({ pulled_forward: false })
              .eq('id', projectId);
          }
        }
      }
    } catch (error) {
      console.warn('Error resetting pulled_forward flags:', error);
    }
  }
  
  // Create or update archived month record
  const monthLabel = getMonthLabel(year, month);
  const monthData = {
    year,
    month,
    month_label: monthLabel,
    closed_by: userId,
    total_revenue: stats.totalRevenue,
    total_expenses: stats.totalExpenses,
    net_profit: stats.netProfit,
    completed_revenue: stats.completedRevenue,
    pending_revenue: stats.pendingRevenue,
    in_progress_revenue: stats.inProgressRevenue,
    cancelled_revenue: stats.cancelledRevenue,
    revision_revenue: stats.revisionRevenue,
    total_projects: stats.totalProjects,
    completed_projects: completedProjects.length,
    in_progress_projects: stats.inProgressProjects,
    pending_projects: stats.pendingProjects,
    cancelled_projects: stats.cancelledProjects,
    revision_projects: stats.revisionProjects,
    total_team_cost: stats.totalTeamCost,
    active_employees: Object.keys(stats.employeeCosts).length,
    total_billing_hours: stats.totalBillingHours,
    base_currency: currency,
    exchange_rate: rate,
    notes,
    closed_at: isUpdate ? undefined : new Date().toISOString() // Only set closed_at on first close
  };
  
  let archivedMonth;
  if (isUpdate) {
    // Update existing archived month
    const { data, error: monthError } = await supabase
      .from('archived_months')
      .update(monthData)
      .eq('id', archivedMonthId)
      .select()
      .single();
    
    if (monthError) throw monthError;
    archivedMonth = data;
  } else {
    // Create new archived month
    const { data, error: monthError } = await supabase
      .from('archived_months')
      .insert(monthData)
      .select()
      .single();
    
    if (monthError) throw monthError;
    archivedMonth = data;
    archivedMonthId = data.id;
  }
  
  // Archive completed projects - mark them as archived in the main table
  const archivedProjects = [];
  for (const project of completedProjects) {
    try {
      // Create archive record
      const archived = await archiveProject(project, archivedMonth.id, currency, rate);
      if (archived) archivedProjects.push(archived);
      
      // Mark project as archived in main projects table
      try {
        const updateResult = await supabase
          .from('projects')
          .update({ 
            archived: true,
            archived_month_id: archivedMonth.id,
            status: 'Completed', // Ensure status is Completed
            pulled_forward: false // Important: don't let completed projects appear in next month
          })
          .eq('id', project.id)
          .select(); // Select to verify update
        
        if (updateResult.error) {
          throw updateResult.error;
        }
        
        console.log(`✅ Marked project ${project.id} as archived:`, updateResult.data?.[0]?.archived);
      } catch (updateError) {
        // If archived column doesn't exist, that's okay - we still have the archive record
        if (updateError.message?.includes('column') || updateError.message?.includes('does not exist') || updateError.code === '42703') {
          console.error('❌ archived column not found in projects table!');
          console.error('Please run supabase-add-archived-field.sql in your Supabase SQL Editor');
          throw new Error('archived column not found. Please run supabase-add-archived-field.sql first.');
        } else {
          console.error(`❌ Error archiving project ${project.id}:`, updateError);
          throw updateError;
        }
      }
    } catch (error) {
      console.error(`Error archiving project ${project.id}:`, error);
    }
  }

  // Repair pass:
  // If any completed project that belongs to this month failed to archive (or wasn’t included),
  // archive it now so it doesn’t leak into the next month’s “Completed” list.
  try {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const monthCompleted = allProjects.filter(p => isProjectCompleted(p) && wasProjectActiveInMonth(p, startDate, endDate));
    const alreadyArchivedIds = new Set(archivedProjects.map(p => String(p.original_project_id || '').trim()).filter(Boolean));

    for (const project of monthCompleted) {
      const projectId = String(project.id || '').trim();
      if (!projectId) continue;
      if (alreadyArchivedIds.has(projectId)) continue;

      // Double-check current DB state to avoid duplicating archive rows
      const { data: dbRow } = await supabase
        .from('projects')
        .select('id, archived, archived_month_id, pulled_forward, status')
        .eq('id', projectId)
        .maybeSingle();

      if (dbRow?.archived === true && String(dbRow.archived_month_id || '') === String(archivedMonth.id)) {
        continue;
      }

      console.warn(`🛠️ Repair archive: archiving missed completed project ${projectId}`);

      try {
        await archiveProject(project, archivedMonth.id, currency, rate);
      } catch (e) {
        console.error(`🛠️ Repair archive failed to insert archived_projects for ${projectId}:`, e);
      }

      try {
        await supabase
          .from('projects')
          .update({
            archived: true,
            archived_month_id: archivedMonth.id,
            status: 'Completed',
            pulled_forward: false
          })
          .eq('id', projectId);
      } catch (e) {
        console.error(`🛠️ Repair archive failed to update projects row for ${projectId}:`, e);
      }
    }
  } catch (repairError) {
    console.warn('🛠️ Repair archive pass failed:', repairError);
  }
  
  // Pull forward projects - mark them as pulled forward
  // This works for ANY project the user explicitly selected, regardless of status
  const nextMonth = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  const pulledProjects = [];
  
  console.log(`🔄 Pulling forward ${incompleteProjects.length} projects to ${nextMonth.year}-${nextMonth.month}`);
  
  if (incompleteProjects.length === 0 && projectsToPullForward.length > 0) {
    console.error('❌ CRITICAL: Projects selected for pull forward but none found in allProjects!');
    console.error('  - Selected IDs:', projectsToPullForward);
    console.error('  - All project IDs in month:', allProjects.map(p => p.id));
    console.error('  - This might be an ID matching issue - check if IDs are in different format');
  }
  
  for (const project of incompleteProjects) {
    try {
      const projectId = project.id;
      const projectName = project.project_name || project.projectName || 'Unknown';
      
      console.log(`🔄 Processing pull forward: ${projectName} (ID: ${projectId}, Status: ${project.status})`);
      
      // Log the pull forward in project_pull_forwards table
      const pulled = await pullForwardProject(
        projectId,
        year,
        month,
        nextMonth.year,
        nextMonth.month,
        userId,
        `Project moved to next month (Status: ${project.status})`
      );
      if (pulled) {
        pulledProjects.push(pulled);
        console.log(`  ✅ Created pull forward record for ${projectId}`);
      } else {
        console.warn(`  ⚠️ Failed to create pull forward record for ${projectId}`);
      }
      
      // Mark project as pulled forward
      // IMPORTANT: We only set pulled_forward flag - we don't change dates or status
      // The project will be visible based on pulled_forward flag, not date filtering
      const updateData = {
        pulled_forward: true
        // Note: We do NOT change start_date, end_date, or status
        // The project keeps its current dates and status
        // It will be visible because pulled_forward = true (not filtered by date)
      };
      
      console.log(`  📅 Pulling forward to ${nextMonth.year}-${nextMonth.month} (keeping original dates and status)`);
      
      console.log(`  📝 Updating project ${projectId} with:`, updateData);
      
      try {
        const updateResult = await supabase
          .from('projects')
          .update(updateData)
          .eq('id', projectId)
          .select(); // Select to verify update
        
        if (updateResult.error) {
          console.error(`  ❌ Update error for ${projectId}:`, updateResult.error);
          throw updateResult.error;
        }
        
        if (!updateResult.data || updateResult.data.length === 0) {
          console.error(`  ❌ No project found with ID ${projectId} - update returned no rows`);
          throw new Error(`Project ${projectId} not found in database`);
        }
        
        const updatedProject = updateResult.data[0];
        console.log(`  ✅ Successfully updated project ${projectId}:`, {
          pulled_forward: updatedProject?.pulled_forward,
          start_date: updatedProject?.start_date,
          end_date: updatedProject?.end_date,
          status: updatedProject?.status,
          archived: updatedProject?.archived
        });
        
        // Verify the update worked
        if (updatedProject.pulled_forward !== true) {
          console.error(`  ❌ WARNING: pulled_forward is not true after update! Value: ${updatedProject.pulled_forward}`);
        }
        if (updatedProject.archived === true) {
          console.error(`  ❌ CRITICAL ERROR: Project ${projectId} is ARCHIVED but should be PULLED FORWARD!`);
          console.error(`  ⚠️ This will cause the project to be hidden from the Projects view`);
        }
        
        // Log that dates and status are preserved
        console.log(`  ✅ Project pulled forward - dates and status preserved:`, {
          start_date: updatedProject.start_date,
          end_date: updatedProject.end_date,
          status: updatedProject.status
        });
        
        // Double-check by querying the database directly after a short delay
        setTimeout(async () => {
          try {
            const verifyResult = await supabase
              .from('projects')
              .select('id, project_name, pulled_forward, start_date, archived, status')
              .eq('id', projectId)
              .single();
            
            if (verifyResult.data) {
              console.log(`  🔍 Verification query for ${projectId}:`, verifyResult.data);
              if (verifyResult.data.pulled_forward !== true) {
                console.error(`  ❌ CRITICAL: Project ${projectId} pulled_forward is FALSE in database!`);
              }
              if (verifyResult.data.archived === true) {
                console.error(`  ❌ CRITICAL: Project ${projectId} is ARCHIVED! It should not be archived if pulled forward.`);
              }
            } else {
              console.error(`  ❌ CRITICAL: Project ${projectId} not found in verification query!`);
            }
          } catch (verifyError) {
            console.error(`  ⚠️ Could not verify project ${projectId}:`, verifyError);
          }
        }, 500);
        
      } catch (updateError) {
        // If pulled_forward column doesn't exist, that's okay
        if (updateError.message?.includes('column') || updateError.message?.includes('does not exist') || updateError.code === '42703') {
          console.error('❌ pulled_forward column not found! Run supabase-add-archived-field.sql');
          throw new Error('pulled_forward column not found. Please run supabase-add-archived-field.sql first.');
        } else {
          console.error(`❌ Error pulling forward project ${projectId}:`, updateError);
          throw updateError;
        }
      }
    } catch (error) {
      console.error(`❌ Error pulling forward project ${project.id}:`, error);
      // Don't throw - continue with other projects, but log the error
    }
  }
  
  console.log(`✅ Successfully pulled forward ${pulledProjects.length} projects`);
  
  // Create or update finance snapshot
  const financeData = {
    archived_month_id: archivedMonth.id,
    fiverr_revenue: stats.platformRevenue['Fiverr'] || 0,
    upwork_revenue: stats.platformRevenue['Upwork'] || 0,
    direct_revenue: stats.platformRevenue['Direct'] || 0,
    agency_revenue: stats.platformRevenue['Agency'] || 0,
    service_revenue: stats.serviceRevenue,
    employee_costs: stats.employeeCosts,
    expenses: {},
    total_invoices: 0,
    paid_invoices: 0,
    unpaid_invoices: 0,
    invoice_details: []
  };
  
  let financeSnapshot;
  if (isUpdate) {
    // Check if finance snapshot exists
    const { data: existingSnapshot } = await supabase
      .from('monthly_finance_snapshots')
      .select('id')
      .eq('archived_month_id', archivedMonth.id)
      .maybeSingle();
    
    if (existingSnapshot) {
      // Update existing snapshot
      const { data, error: financeError } = await supabase
        .from('monthly_finance_snapshots')
        .update(financeData)
        .eq('id', existingSnapshot.id)
        .select()
        .single();
      
      if (financeError) {
        console.warn('Error updating finance snapshot:', financeError);
      } else {
        financeSnapshot = data;
      }
    } else {
      // Create new snapshot
      const { data, error: financeError } = await supabase
        .from('monthly_finance_snapshots')
        .insert(financeData)
        .select()
        .single();
      
      if (financeError) {
        console.warn('Error creating finance snapshot:', financeError);
      } else {
        financeSnapshot = data;
      }
    }
  } else {
    // Create new finance snapshot
    const { data, error: financeError } = await supabase
      .from('monthly_finance_snapshots')
      .insert(financeData)
      .select()
      .single();
    
    if (financeError) {
      console.warn('Error creating finance snapshot:', financeError);
    } else {
      financeSnapshot = data;
    }
  }
  
  return {
    archivedMonth,
    archivedProjects: archivedProjects.length,
    pulledProjects: pulledProjects.length,
    financeSnapshot,
    isUpdate // Return whether this was an update or new close
  };
}

/**
 * Get archived months
 */
export async function getArchivedMonths(limit = 100) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('archived_months')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(limit);
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting archived months:', error);
    return [];
  }
}

/**
 * Get archived projects for a month
 */
export async function getArchivedProjects(archivedMonthId) {
  if (!isSupabaseConfigured || !supabase) {
    return [];
  }
  
  try {
    const { data, error } = await supabase
      .from('archived_projects')
      .select('*')
      .eq('archived_month_id', archivedMonthId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting archived projects:', error);
    return [];
  }
}

/**
 * Get finance snapshot for a month
 */
export async function getFinanceSnapshot(archivedMonthId) {
  if (!isSupabaseConfigured || !supabase) {
    return null;
  }
  
  try {
    const { data, error } = await supabase
      .from('monthly_finance_snapshots')
      .select('*')
      .eq('archived_month_id', archivedMonthId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
    return data;
  } catch (error) {
    console.error('Error getting finance snapshot:', error);
    return null;
  }
}

/**
 * Restore an archived month back to active projects.
 * - Unarchives linked projects (by original_project_id)
 * - Removes archived month snapshot (cascade removes archived projects/snapshots)
 */
export async function restoreArchivedMonth(archivedMonthId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured. Cannot restore archived month.');
  }

  // Load archived projects for this month first (needed before cascade delete)
  const { data: archivedProjects, error: archivedError } = await supabase
    .from('archived_projects')
    .select('id, original_project_id, status')
    .eq('archived_month_id', archivedMonthId);

  if (archivedError) throw archivedError;

  let restoredCount = 0;
  let skippedCount = 0;

  const projectIds = (archivedProjects || [])
    .map(p => p.original_project_id)
    .filter(Boolean);

  if (projectIds.length > 0) {
    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update({
        archived: false,
        archived_month_id: null,
        pulled_forward: false
      })
      .in('id', projectIds)
      .select('id');

    if (updateError) throw updateError;
    restoredCount = updated?.length || 0;
    skippedCount = projectIds.length - restoredCount;
  }

  // Delete archived month record (cascades archived_projects + finance snapshot)
  const { error: deleteMonthError } = await supabase
    .from('archived_months')
    .delete()
    .eq('id', archivedMonthId);

  if (deleteMonthError) throw deleteMonthError;

  return {
    restoredCount,
    skippedCount,
    archivedProjectCount: archivedProjects?.length || 0
  };
}

/**
 * Permanently delete an archived month snapshot.
 * Note: This does NOT restore projects; it only removes archive records.
 */
export async function deleteArchivedMonth(archivedMonthId) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase not configured. Cannot delete archived month.');
  }

  const { error } = await supabase
    .from('archived_months')
    .delete()
    .eq('id', archivedMonthId);

  if (error) throw error;
  return { deleted: true };
}

