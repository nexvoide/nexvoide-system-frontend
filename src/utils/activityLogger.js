/**
 * Activity Logger Utility
 * Handles logging of all CRUD operations and generates human-readable descriptions
 */

import * as db from '../lib/db.js';

/**
 * Log an activity to the database
 */
export async function logActivity({
  entityType,
  entityId,
  action,
  description,
  oldValue = null,
  newValue = null,
  userName = 'System'
}) {
  try {
    const activityData = {
      entity_type: entityType,
      entity_id: entityId ? String(entityId) : null,
      action,
      description,
      old_value: oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : null,
      new_value: newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null,
      user_name: userName,
    };

    await db.dbActivityLogs.create(activityData);
  } catch (error) {
    console.error('Failed to log activity:', error);
    // Don't throw - logging failures shouldn't break the app
  }
}

/**
 * Create a human-readable description for project actions
 */
export function createProjectDescription(action, project, oldProject = null) {
  const projectName = project?.projectName || project?.project_name || 'Unknown Project';
  const clientName = project?.clientName || project?.client_name || 'Unknown Client';
  
  switch (action) {
    case 'created':
      return `Created project "${projectName}" for client "${clientName}"`;
    case 'updated':
      if (oldProject) {
        const changes = [];
        if (oldProject.status !== project.status) {
          changes.push(`status from "${oldProject.status}" to "${project.status}"`);
        }
        if (oldProject.amount !== project.amount) {
          changes.push(`amount from ${oldProject.amount} to ${project.amount}`);
        }
        if (changes.length > 0) {
          return `Updated project "${projectName}": ${changes.join(', ')}`;
        }
      }
      return `Updated project "${projectName}"`;
    case 'deleted':
      return `Deleted project "${projectName}" for client "${clientName}"`;
    case 'status_changed':
      return `Changed status of project "${projectName}" to "${project.status}"`;
    default:
      return `${action} project "${projectName}"`;
  }
}

/**
 * Create a human-readable description for employee actions
 */
export function createEmployeeDescription(action, employee, oldEmployee = null) {
  const employeeName = employee?.name || 'Unknown Employee';
  
  switch (action) {
    case 'created':
      return `Created employee "${employeeName}"`;
    case 'updated':
      if (oldEmployee) {
        const changes = [];
        if (oldEmployee.name !== employee.name) {
          changes.push(`name from "${oldEmployee.name}" to "${employee.name}"`);
        }
        if (oldEmployee.rateValue !== employee.rateValue) {
          changes.push(`rate from ${oldEmployee.rateValue} to ${employee.rateValue}`);
        }
        if (changes.length > 0) {
          return `Updated employee "${employeeName}": ${changes.join(', ')}`;
        }
      }
      return `Updated employee "${employeeName}"`;
    case 'deleted':
      return `Deleted employee "${employeeName}"`;
    default:
      return `${action} employee "${employeeName}"`;
  }
}

/**
 * Create a human-readable description for entity actions (profiles, agencies, brands)
 */
export function createEntityDescription(action, entity, entityType) {
  const entityName = entity?.name || 'Unknown';
  const typeLabel = entityType || 'entity';
  
  switch (action) {
    case 'created':
      return `Created ${typeLabel} "${entityName}"`;
    case 'updated':
      return `Updated ${typeLabel} "${entityName}"`;
    case 'deleted':
      return `Deleted ${typeLabel} "${entityName}"`;
    default:
      return `${action} ${typeLabel} "${entityName}"`;
  }
}

/**
 * Create a human-readable description for setting changes
 */
export function createSettingDescription(settingKey, oldValue, newValue) {
  switch (settingKey) {
    case 'currency':
      return `Changed currency from ${oldValue} to ${newValue}`;
    case 'rate':
      return `Changed USD to PKR conversion rate from ${oldValue} to ${newValue}`;
    default:
      return `Changed setting "${settingKey}" from ${oldValue} to ${newValue}`;
  }
}




