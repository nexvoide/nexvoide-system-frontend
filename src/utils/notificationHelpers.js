/**
 * Helper functions for sending notifications
 */

import { useNotificationStore } from '../stores/notificationStore.js';
import { NOTIFICATION_TYPES, NOTIFICATION_PRIORITY } from './notifications.js';
import { useAppStore } from '../stores/appStore.js';

/**
 * Send notification to assigned employees when project is assigned
 */
export function notifyProjectAssignment(newAssigned, oldAssigned, project, employees, allUsers) {
  const oldNames = (oldAssigned || []).map(a => a.name).filter(Boolean);
  const newlyAssignedNames = newAssigned
    .filter(a => a.name && !oldNames.includes(a.name))
    .map(a => a.name);

  if (newlyAssignedNames.length === 0) return;

  const notificationStore = useNotificationStore.getState();

  newlyAssignedNames.forEach(employeeName => {
    // Find employee
    const employee = employees.find(e => 
      (e.name || e.employee_name) === employeeName
    );

    if (!employee) return;

    // Try to find user by matching employee name with user name or user_id
    const user = allUsers?.find(u => 
      (u.name || '').toLowerCase() === employeeName.toLowerCase() ||
      (u.userId || '').toLowerCase() === employeeName.toLowerCase() ||
      (u.username || '').toLowerCase() === employeeName.toLowerCase()
    );

    // Send notification
    notificationStore.addNotification({
      type: NOTIFICATION_TYPES.PROJECT_ASSIGNED,
      title: 'Project Assigned',
      message: `You have been assigned to project: ${project.projectName || project.project_name || 'New Project'}`,
      priority: NOTIFICATION_PRIORITY.HIGH,
      userId: user?.id || null,
      data: {
        projectId: project.id,
        projectName: project.projectName || project.project_name,
        employeeName: employeeName,
      },
    }, user, user?.role);
  });
}

/**
 * Send notification when project status changes
 */
export function notifyProjectStatusChange(project, oldStatus, newStatus, allUsers) {
  const notificationStore = useNotificationStore.getState();

  // Notify assigned employees
  const assigned = Array.isArray(project.assigned) ? project.assigned : [];
  
  assigned.forEach(assignment => {
    const employeeName = assignment.name;
    if (!employeeName) return;

    // Find user by employee name
    const user = allUsers?.find(u => 
      (u.name || '').toLowerCase() === employeeName.toLowerCase() ||
      (u.userId || '').toLowerCase() === employeeName.toLowerCase()
    );

    if (user) {
      notificationStore.addNotification({
        type: NOTIFICATION_TYPES.PROJECT_UPDATED,
        title: 'Project Status Updated',
        message: `Project "${project.projectName || project.project_name}" status changed to ${newStatus}`,
        priority: NOTIFICATION_PRIORITY.MEDIUM,
        userId: user.id,
        data: {
          projectId: project.id,
          projectName: project.projectName || project.project_name,
          oldStatus,
          newStatus,
        },
      }, user, user.role);
    }
  });
}

/**
 * Send notification for approaching deadlines
 */
export function checkAndNotifyDeadlines(projects, allUsers) {
  const notificationStore = useNotificationStore.getState();
  const now = new Date();
  const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  projects.forEach(project => {
    if (!project.deadline) return;
    if (project.status === 'Completed' || project.status === 'Cancelled') return;

    // Parse deadline - handle Supabase TIMESTAMP (may not have timezone)
    let deadlineStr = String(project.deadline).trim();
    if (deadlineStr.includes('T') && !deadlineStr.endsWith('Z') && !deadlineStr.match(/[+-]\d{2}:\d{2}$/)) {
      deadlineStr = deadlineStr + 'Z';
    }
    const deadline = new Date(deadlineStr);
    const timeDiff = deadline - now;

    // Notify if deadline is within 24 hours
    if (timeDiff > 0 && timeDiff <= 24 * 60 * 60 * 1000) {
      const assigned = Array.isArray(project.assigned) ? project.assigned : [];
      
      assigned.forEach(assignment => {
        const employeeName = assignment.name;
        if (!employeeName) return;

        const user = allUsers?.find(u => 
          (u.name || '').toLowerCase() === employeeName.toLowerCase() ||
          (u.userId || '').toLowerCase() === employeeName.toLowerCase()
        );

        if (user) {
          notificationStore.addNotification({
            type: NOTIFICATION_TYPES.PROJECT_DEADLINE,
            title: 'Deadline Approaching',
            message: `Project "${project.projectName || project.project_name}" deadline is approaching`,
            priority: NOTIFICATION_PRIORITY.URGENT,
            userId: user.id,
            data: {
              projectId: project.id,
              projectName: project.projectName || project.project_name,
              deadline: project.deadline,
            },
          }, user, user.role);
        }
      });
    }
  });
}




