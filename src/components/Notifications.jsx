import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Check, CheckCheck, Trash2, Settings } from 'lucide-react';
import { useNotificationStore } from '../stores/notificationStore.js';
import { useAppStore } from '../stores/appStore.js';
import { formatNotificationMessage, NOTIFICATION_TYPES } from '../utils/notifications.js';

export default function Notifications() {
  const [isOpen, setIsOpen] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const dropdownRef = useRef(null);
  const { user, userRole } = useAppStore();
  const {
    notifications,
    unreadCount,
    browserNotificationsEnabled,
    initBrowserNotifications,
    markAsRead,
    markAllAsRead,
    removeNotification,
    getUserNotifications,
    addNotification,
  } = useNotificationStore();

  // Get user-specific notifications
  const userNotifications = getUserNotifications(user, userRole);
  const userUnreadCount = userNotifications.filter(n => !n.read).length;

  // Check current permission status
  const notificationPermission = typeof window !== 'undefined' && 'Notification' in window 
    ? Notification.permission 
    : 'default';

  // Handle enable button click
  const handleEnableNotifications = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🔔 Enable notifications clicked, current permission:', notificationPermission);
    
    if (notificationPermission === 'granted') {
      // Already enabled, show test notification
      console.log('✅ Notifications already enabled, showing test notification');
      if (typeof window !== 'undefined' && 'Notification' in window) {
        try {
          new Notification('Notifications Enabled', {
            body: 'You will receive browser notifications from Nexvoide Management System',
            icon: '/logo.png',
            tag: 'test-notification',
          });
        } catch (err) {
          console.error('Error showing test notification:', err);
        }
      }
      return;
    }

    if (notificationPermission === 'denied') {
      console.warn('⚠️ Notifications are blocked');
      alert('Notifications are blocked. Please enable them in your browser settings and reload the page.');
      return;
    }

    console.log('🔄 Requesting notification permission...');
    setIsEnabling(true);
    
    try {
      const enabled = await initBrowserNotifications();
      console.log('📱 Permission request result:', enabled);
      
      // Check actual permission after request
      const actualPermission = typeof window !== 'undefined' && 'Notification' in window 
        ? Notification.permission 
        : 'default';
      console.log('📱 Actual permission after request:', actualPermission);
      
      if (enabled || actualPermission === 'granted') {
        console.log('✅ Notifications enabled successfully');
        // Show test notification
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
          setTimeout(() => {
            try {
              new Notification('Notifications Enabled', {
                body: 'You will receive browser notifications from Nexvoide Management System',
                icon: '/logo.png',
                tag: 'test-notification',
              });
              console.log('✅ Test notification shown');
            } catch (err) {
              console.error('Error showing test notification:', err);
            }
          }, 500);
        }
        // Add in-app notification
        addNotification({
          type: 'system',
          title: 'Browser Notifications Enabled',
          message: 'You will now receive desktop notifications when important events occur.',
          priority: 'low',
        }, user, userRole);
      } else {
        console.warn('❌ Failed to enable notifications');
        alert('Failed to enable notifications. Please check your browser settings.');
      }
    } catch (error) {
      console.error('❌ Error enabling notifications:', error);
      alert('Error enabling notifications: ' + (error.message || 'Please try again.'));
    } finally {
      setIsEnabling(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Format time ago
  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return 'border-red-500 bg-red-50 dark:bg-red-900/20';
      case 'high': return 'border-orange-500 bg-orange-50 dark:bg-orange-900/20';
      case 'medium': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      default: return 'border-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        title="Notifications"
      >
        <Bell size={20} className="text-slate-700 dark:text-slate-300" />
        {userUnreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center"
          >
            {userUnreadCount > 9 ? '9+' : userUnreadCount}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-96 max-h-[600px] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-slate-700 dark:text-slate-300" />
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Notifications
                  {userUnreadCount > 0 && (
                    <span className="ml-2 text-sm text-red-500">({userUnreadCount})</span>
                  )}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {userUnreadCount > 0 && (
                  <button
                    onClick={() => markAllAsRead()}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck size={16} className="text-slate-600 dark:text-slate-400" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={16} className="text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="overflow-y-auto max-h-[500px] scrollbar-thin">
              {userNotifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <Bell size={32} className="mx-auto mb-2 opacity-50" />
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {userNotifications.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-l-4 ${
                        notification.read 
                          ? getPriorityColor('low') 
                          : getPriorityColor(notification.priority)
                      } ${!notification.read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className={`font-semibold text-sm ${
                              notification.read 
                                ? 'text-slate-700 dark:text-slate-300' 
                                : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-500 dark:text-slate-500">
                              {getTimeAgo(notification.createdAt)}
                            </span>
                            <div className="flex items-center gap-1">
                              {!notification.read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                  title="Mark as read"
                                >
                                  <Check size={14} className="text-slate-600 dark:text-slate-400" />
                                </button>
                              )}
                              <button
                                onClick={() => removeNotification(notification.id)}
                                className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                title="Remove"
                              >
                                <Trash2 size={14} className="text-slate-600 dark:text-slate-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer - Always show notification settings */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                  {notificationPermission === 'granted' ? (
                    <>
                      <span className="text-green-600 dark:text-green-400">🔔</span>
                      <span>Browser notifications enabled</span>
                    </>
                  ) : notificationPermission === 'denied' ? (
                    <>
                      <span className="text-red-600 dark:text-red-400">🔕</span>
                      <span>Notifications blocked</span>
                    </>
                  ) : (
                    <>
                      <span>🔕</span>
                      <span>Browser notifications disabled</span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleEnableNotifications}
                  disabled={isEnabling || notificationPermission === 'denied'}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    notificationPermission === 'granted'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                      : notificationPermission === 'denied'
                      ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                  } ${isEnabling ? 'opacity-50 cursor-wait' : ''}`}
                  title={
                    notificationPermission === 'granted'
                      ? 'Click to test notification'
                      : notificationPermission === 'denied'
                      ? 'Notifications are blocked. Enable in browser settings.'
                      : 'Click to enable browser notifications'
                  }
                >
                  {isEnabling ? 'Enabling...' : notificationPermission === 'granted' ? 'Test' : 'Enable'}
                </button>
              </div>
              {notificationPermission === 'denied' && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Please enable notifications in your browser settings and reload the page.
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

