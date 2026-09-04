/**
 * Notification System
 * Handles in-app and browser notifications
 */

// Notification types
export const NOTIFICATION_TYPES = {
  PROJECT_ASSIGNED: 'project_assigned',
  PROJECT_UPDATED: 'project_updated',
  PROJECT_COMPLETED: 'project_completed',
  PROJECT_DEADLINE: 'project_deadline',
  EMPLOYEE_ADDED: 'employee_added',
  SETTINGS_CHANGED: 'settings_changed',
  SYSTEM: 'system',
  CHAT_MESSAGE: 'chat_message',
};

// Notification priorities
export const NOTIFICATION_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
};

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Show browser notification
 */
export async function showBrowserNotification(title, options = {}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  const defaultOptions = {
    icon: '/logo.png',
    badge: '/logo.png',
    tag: options.tag || 'nexvoide-notification',
    requireInteraction: options.priority === NOTIFICATION_PRIORITY.URGENT,
    ...options,
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, defaultOptions);
      return true;
    }

    const notification = new Notification(title, defaultOptions);
    
    // Auto-close after 5 seconds (unless urgent)
    if (defaultOptions.priority !== NOTIFICATION_PRIORITY.URGENT) {
      setTimeout(() => {
        notification.close();
      }, 5000);
    }

    // Handle click
    notification.onclick = () => {
      window.focus();
      notification.close();
      if (options.onClick) {
        options.onClick();
      }
    };

    return notification;
  } catch (error) {
    console.error('Error showing browser notification:', error);
    return null;
  }
}

/**
 * Create notification object
 */
export function createNotification({
  id = null,
  type,
  title,
  message,
  priority = NOTIFICATION_PRIORITY.MEDIUM,
  userId = null,
  role = null,
  data = {},
  read = false,
  createdAt = new Date().toISOString(),
}) {
  return {
    id: id || `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    title,
    message,
    priority,
    userId,
    role,
    data,
    read,
    createdAt,
  };
}

/**
 * Check if user should receive notification based on role
 */
export function shouldUserReceiveNotification(notification, user, userRole) {
  // If notification has specific userId, only that user gets it
  if (notification.userId && user?.id && notification.userId !== user.id) {
    return false;
  }

  // If notification has specific role, only users with that role get it
  if (notification.role && userRole !== notification.role) {
    return false;
  }

  // If no filters, everyone gets it (for system-wide notifications)
  return true;
}

/**
 * Format notification message based on type
 */
export function formatNotificationMessage(type, data) {
  switch (type) {
    case NOTIFICATION_TYPES.PROJECT_ASSIGNED:
      return `You have been assigned to project: ${data.projectName || 'New Project'}`;
    
    case NOTIFICATION_TYPES.PROJECT_UPDATED:
      return `Project "${data.projectName || 'Project'}" has been updated`;
    
    case NOTIFICATION_TYPES.PROJECT_COMPLETED:
      return `Project "${data.projectName || 'Project'}" has been completed`;
    
    case NOTIFICATION_TYPES.PROJECT_DEADLINE:
      return `Project "${data.projectName || 'Project'}" deadline is approaching`;
    
    case NOTIFICATION_TYPES.EMPLOYEE_ADDED:
      return `New employee "${data.employeeName || 'Employee'}" has been added`;
    
    case NOTIFICATION_TYPES.SETTINGS_CHANGED:
      return `System settings have been updated`;
    
    default:
      return data.message || 'New notification';
  }
}



