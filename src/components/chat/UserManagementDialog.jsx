import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Check } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore.js';

export default function UserManagementDialog({ channel, allUsers = [], onClose }) {
  const { updateChannelUsers } = useChatStore();
  
  const initializeSelectedUsers = (channelUsers) => {
    if (!Array.isArray(channelUsers)) return [];
    return [...new Set(channelUsers.map(String).map(id => id.trim()).filter(Boolean))];
  };
  
  const [selectedUsers, setSelectedUsers] = useState(() => initializeSelectedUsers(channel?.users));

  useEffect(() => {
    const normalized = initializeSelectedUsers(channel?.users);
    setSelectedUsers(normalized);
  }, [channel]);

  const toggleUser = (userId) => {
    if (!userId) return;
    const canonicalId = String(userId).trim();
    setSelectedUsers(prev => {
      const isSelected = prev.includes(canonicalId);
      return isSelected ? prev.filter(id => id !== canonicalId) : [...prev, canonicalId];
    });
  };

  const handleSave = async () => {
    const validUserIds = new Set(allUsers.map(user => String(user.id)).filter(Boolean));
    const canonicalUserIds = selectedUsers.filter(id => validUserIds.has(id));
    const success = await updateChannelUsers(channel.id, canonicalUserIds);
    if (!success) {
      alert('Failed to update channel users. Please try again.');
      return;
    }
    onClose();
  };

  const getUserInitials = (name) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[#0a0a1a] border-0 sm:border border-slate-800 rounded-none sm:rounded-xl w-full max-w-md shadow-2xl min-h-full sm:min-h-0 max-h-full sm:max-h-[90vh] flex flex-col my-0 sm:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0 sticky top-0 bg-[#0a0a1a] z-10">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Users size={20} className="text-[#3b82f6] flex-shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-white truncate">Manage Channel Users</h3>
              <p className="text-xs sm:text-sm text-slate-400 truncate">{channel.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center flex-shrink-0 ml-2"
          >
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* User List */}
        <div className="p-4 sm:p-6 flex-1 overflow-y-auto scrollbar-thin pb-safe">
          {allUsers && allUsers.length > 0 ? (
            <div className="space-y-2">
              {allUsers.map((user) => {
                const userId = String(user.id);
                const isSelected = selectedUsers.includes(userId);
                return (
                  <button
                    key={userId}
                    onClick={() => toggleUser(userId)}
                    className={`w-full p-3 rounded-lg border transition-all flex items-center gap-3 ${
                      isSelected
                        ? 'bg-[#3b82f6]/20 border-[#3b82f6]'
                        : 'bg-slate-800/30 border-slate-700 hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Avatar */}
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div
                      className={`w-10 h-10 rounded-full bg-[#3b82f6] flex items-center justify-center text-sm font-bold ${
                        user.avatar ? 'hidden' : ''
                      }`}
                    >
                      {getUserInitials(user.name)}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 text-left">
                      <div className="font-medium text-white">{user.name}</div>
                      {user.email && (
                        <div className="text-xs text-slate-400">{user.email}</div>
                      )}
                    </div>

                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-[#3b82f6] border-[#3b82f6]'
                          : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Users size={48} className="mx-auto mb-3 opacity-30" />
              <p>No users available</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 flex-shrink-0 sticky bottom-0 bg-[#0a0a1a]">
          <p className="text-xs sm:text-sm text-slate-400 text-center sm:text-left">
            {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
          </p>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors min-h-[44px] touch-manipulation flex-1 sm:flex-none"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg transition-colors font-medium min-h-[44px] touch-manipulation flex-1 sm:flex-none"
            >
              Save Changes
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
