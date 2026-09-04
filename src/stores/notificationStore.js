import { create } from 'zustand';
import { 
  createNotification, 
  showBrowserNotification, 
  requestNotificationPermission,
  shouldUserReceiveNotification,
  NOTIFICATION_PRIORITY,
} from '../utils/notifications.js';

// Load from localStorage
const loadNotifications = () => {
  try {
    const stored = localStorage.getItem('nexvoide-notifications');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        notifications: parsed.notifications || [],
        browserNotificationsEnabled: parsed.browserNotificationsEnabled || false,
      };
    }
  } catch (e) {
    console.warn('Failed to load notifications from localStorage:', e);
  }
  return { notifications: [], browserNotificationsEnabled: false };
};

// Save to localStorage
const saveNotifications = (notifications, browserNotificationsEnabled) => {
  try {
    localStorage.setItem('nexvoide-notifications', JSON.stringify({
      notifications,
      browserNotificationsEnabled,
    }));
  } catch (e) {
    console.warn('Failed to save notifications to localStorage:', e);
  }
};

const initialState = loadNotifications();

export const useNotificationStore = create((set, get) => ({
  notifications: initialState.notifications,
  unreadCount: initialState.notifications.filter(n => !n.read).length,
  browserNotificationsEnabled: initialState.browserNotificationsEnabled,

  // Initialize browser notifications
  async initBrowserNotifications() {
    try {
      const enabled = await requestNotificationPermission();
      set({ browserNotificationsEnabled: enabled });
      saveNotifications(get().notifications, enabled);
      
      // Update state based on actual permission (in case it changed)
      if (typeof window !== 'undefined' && 'Notification' in window) {
        const actualPermission = Notification.permission;
        const actuallyEnabled = actualPermission === 'granted';
        if (actuallyEnabled !== enabled) {
          set({ browserNotificationsEnabled: actuallyEnabled });
          saveNotifications(get().notifications, actuallyEnabled);
          return actuallyEnabled;
        }
      }
      
      return enabled;
    } catch (error) {
      console.error('Error initializing browser notifications:', error);
      return false;
    }
  },

  // Add notification
  addNotification(notification, user = null, userRole = null) {
    const notif = typeof notification === 'string' 
      ? createNotification({ 
          type: 'system', 
          title: notification, 
          message: notification 
        })
      : createNotification(notification);

    // Check if user should receive this notification
    if (user && userRole && !shouldUserReceiveNotification(notif, user, userRole)) {
      return;
    }

    set((state) => {
      const newNotifications = [notif, ...state.notifications].slice(0, 100); // Keep last 100
      const unreadCount = newNotifications.filter(n => !n.read).length;

      // Show browser notification if enabled (even if not hidden, but prioritize when hidden)
      if (state.browserNotificationsEnabled) {
        // Always show for urgent, or show when tab is hidden
        if (notif.type === 'chat_message' || notif.priority === NOTIFICATION_PRIORITY.URGENT || document.hidden) {
          showBrowserNotification(notif.title, {
            body: notif.message,
            priority: notif.priority,
            tag: notif.id,
            data: notif.data,
            onClick: () => {
              window.focus();
            },
          });
        }
      }

      saveNotifications(newNotifications, state.browserNotificationsEnabled);

      return {
        notifications: newNotifications,
        unreadCount,
      };
    });

    return notif;
  },

  // Mark notification as read
  markAsRead(notificationId) {
    set((state) => {
      const updated = state.notifications.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      const unreadCount = updated.filter(n => !n.read).length;
      saveNotifications(updated, state.browserNotificationsEnabled);
      return {
        notifications: updated,
        unreadCount,
      };
    });
  },

  // Mark all as read
  markAllAsRead() {
    set((state) => {
      const updated = state.notifications.map(n => ({ ...n, read: true }));
      saveNotifications(updated, state.browserNotificationsEnabled);
      return {
        notifications: updated,
        unreadCount: 0,
      };
    });
  },

  // Remove notification
  removeNotification(notificationId) {
    set((state) => {
      const filtered = state.notifications.filter(n => n.id !== notificationId);
      const unreadCount = filtered.filter(n => !n.read).length;
      saveNotifications(filtered, state.browserNotificationsEnabled);
      return {
        notifications: filtered,
        unreadCount,
      };
    });
  },

  // Clear all notifications
  clearAll() {
    set({
      notifications: [],
      unreadCount: 0,
    });
    saveNotifications([], get().browserNotificationsEnabled);
  },

  // Get unread notifications for current user
  getUnreadNotifications(user, userRole) {
    const state = get();
    return state.notifications.filter(n => {
      if (n.read) return false;
      return shouldUserReceiveNotification(n, user, userRole);
    });
  },

  // Get all notifications for current user
  getUserNotifications(user, userRole) {
    const state = get();
    return state.notifications.filter(n => 
      shouldUserReceiveNotification(n, user, userRole)
    );
  },
}));
