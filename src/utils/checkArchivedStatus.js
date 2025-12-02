/**
 * Utility to check and fix archived project status
 * Use this to diagnose issues with archived projects
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase.js';

/**
 * Check if archived column exists in projects table
 */
export async function checkArchivedColumn() {
  if (!isSupabaseConfigured || !supabase) {
    return { exists: false, error: 'Supabase not configured' };
  }

  try {
    // Try to query with archived filter
    const { error } = await supabase
      .from('projects')
      .select('id, archived')
      .limit(1);
    
    if (error && (error.message?.includes('column') || error.message?.includes('does not exist') || error.code === '42703')) {
      return { exists: false, error: error.message };
    }
    
    return { exists: true };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

/**
 * Get count of archived vs non-archived projects
 */
export async function getArchivedStats() {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase not configured' };
  }

  try {
    // Get all projects
    const { data: allProjects, error } = await supabase
      .from('projects')
      .select('id, archived, status');
    
    if (error) {
      return { error: error.message };
    }

    const total = allProjects?.length || 0;
    const archived = allProjects?.filter(p => p.archived === true).length || 0;
    const notArchived = total - archived;
    const completed = allProjects?.filter(p => p.status === 'Completed' || p.status === 'completed').length || 0;
    const completedNotArchived = allProjects?.filter(p => 
      (p.status === 'Completed' || p.status === 'completed') && p.archived !== true
    ).length || 0;

    return {
      total,
      archived,
      notArchived,
      completed,
      completedNotArchived,
      projects: allProjects
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Manually mark completed projects as archived
 * Use this if projects weren't properly archived during month closing
 */
export async function manuallyArchiveCompletedProjects(archivedMonthId = null) {
  if (!isSupabaseConfigured || !supabase) {
    return { error: 'Supabase not configured' };
  }

  try {
    // First check if archived column exists
    const columnCheck = await checkArchivedColumn();
    if (!columnCheck.exists) {
      return { 
        error: 'archived column does not exist. Please run supabase-add-archived-field.sql first.',
        needsMigration: true
      };
    }

    // Get all completed projects that aren't archived
    const { data: completedProjects, error: fetchError } = await supabase
      .from('projects')
      .select('id, status, archived')
      .or('status.eq.Completed,status.eq.completed')
      .is('archived', null)
      .limit(1000); // Limit to prevent huge updates
    
    if (fetchError) {
      return { error: fetchError.message };
    }

    if (!completedProjects || completedProjects.length === 0) {
      return { message: 'No completed projects to archive', archived: 0 };
    }

    // Mark them as archived
    const projectIds = completedProjects.map(p => p.id);
    const updateData = {
      archived: true,
      status: 'Completed'
    };
    
    if (archivedMonthId) {
      updateData.archived_month_id = archivedMonthId;
    }

    const { data: updated, error: updateError } = await supabase
      .from('projects')
      .update(updateData)
      .in('id', projectIds)
      .select('id');
    
    if (updateError) {
      return { error: updateError.message };
    }

    return {
      message: `Successfully archived ${updated?.length || 0} completed projects`,
      archived: updated?.length || 0,
      projectIds: updated?.map(p => p.id) || []
    };
  } catch (error) {
    return { error: error.message };
  }
}

/**
 * Debug function to log current project status
 */
export async function debugProjectStatus() {
  const columnCheck = await checkArchivedColumn();
  console.log('📊 Archived Column Check:', columnCheck);
  
  const stats = await getArchivedStats();
  console.log('📊 Project Stats:', stats);
  
  if (stats.error) {
    console.error('❌ Error getting stats:', stats.error);
    return;
  }

  console.log(`Total Projects: ${stats.total}`);
  console.log(`Archived: ${stats.archived}`);
  console.log(`Not Archived: ${stats.notArchived}`);
  console.log(`Completed: ${stats.completed}`);
  console.log(`Completed but NOT Archived: ${stats.completedNotArchived}`);
  
  if (stats.completedNotArchived > 0) {
    console.warn(`⚠️ Found ${stats.completedNotArchived} completed projects that are NOT archived!`);
    const completedNotArchived = stats.projects?.filter(p => 
      (p.status === 'Completed' || p.status === 'completed') && p.archived !== true
    );
    console.log('Completed but not archived projects:', completedNotArchived);
  }
  
  return stats;
}





