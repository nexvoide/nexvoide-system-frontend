import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Users, Check } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore.js';

export default function UserManagementDialog({ channel, allUsers = [], onClose }) {
  const { updateChannelUsers } = useChatStore();
  
  // Initialize selected users from channel, but normalize them
  const initializeSelectedUsers = (channelUsers) => {
    if (!channelUsers || !Array.isArray(channelUsers) || channelUsers.length === 0) {
      return [];
    }
    
    // Normalize the channel users to match against allUsers
    const normalized = channelUsers.map(chUserId => String(chUserId).trim());
    
    console.log('UserManagementDialog - Initializing selected users:', {
      channelUsers,
      normalized,
      allUsersCount: allUsers.length
    });
    
    return normalized;
  };
  
  const [selectedUsers, setSelectedUsers] = useState(() => initializeSelectedUsers(channel?.users));

  useEffect(() => {
    const normalized = initializeSelectedUsers(channel?.users);
    console.log('UserManagementDialog - Channel changed, updating selected users:', {
      channelId: channel?.id,
      channelName: channel?.name,
      channelUsers: channel?.users,
      normalized
    });
    setSelectedUsers(normalized);
  }, [channel]);

  const toggleUser = (userId) => {
    if (!userId) return;
    
    // Find the user in allUsers to get all their ID formats
    const user = allUsers.find(u => {
      const uId = u.id || u.username || u.user_id;
      const normalizedUId = String(uId).trim().toLowerCase();
      const normalizedUserId = String(userId).trim().toLowerCase();
      
      if (normalizedUId === normalizedUserId) return true;
      
      // Also check all ID fields
      if (u.id && String(u.id).trim().toLowerCase() === normalizedUserId) return true;
      if (u.username && String(u.username).trim().toLowerCase() === normalizedUserId) return true;
      if (u.user_id && String(u.user_id).trim().toLowerCase() === normalizedUserId) return true;
      
      // Numeric match
      const uIdNum = Number(uId);
      const userIdNum = Number(userId);
      if (!isNaN(uIdNum) && !isNaN(userIdNum) && uIdNum === userIdNum) return true;
      
      return false;
    });
    
    // Get all ID formats for this user
    const userAllIds = user ? [
      user.id,
      user.username,
      user.user_id
    ].filter(Boolean).map(id => String(id).trim()) : [String(userId).trim()];
    
    setSelectedUsers(prev => {
      // Check if ANY of the user's IDs are in the selected list
      const isSelected = userAllIds.some(uid => {
        return prev.some(selectedId => {
          const normalizedSelected = String(selectedId).trim().toLowerCase();
          const normalizedUid = String(uid).trim().toLowerCase();
          
          if (normalizedSelected === normalizedUid) return true;
          
          // Numeric match
          const selectedNum = Number(selectedId);
          const uidNum = Number(uid);
          if (!isNaN(selectedNum) && !isNaN(uidNum) && selectedNum === uidNum) return true;
          
          return false;
        });
      });
      
      if (isSelected) {
        // Remove ALL ID formats for this user
        return prev.filter(selectedId => {
          return !userAllIds.some(uid => {
            const normalizedSelected = String(selectedId).trim().toLowerCase();
            const normalizedUid = String(uid).trim().toLowerCase();
            
            if (normalizedSelected === normalizedUid) return true;
            
            // Numeric match
            const selectedNum = Number(selectedId);
            const uidNum = Number(uid);
            if (!isNaN(selectedNum) && !isNaN(uidNum) && selectedNum === uidNum) return true;
            
            return false;
          });
        });
      } else {
        // Add ALL ID formats for this user to ensure matching works
        const toAdd = userAllIds.filter(uid => {
          // Don't add if already exists
          return !prev.some(selectedId => {
            const normalizedSelected = String(selectedId).trim().toLowerCase();
            const normalizedUid = String(uid).trim().toLowerCase();
            return normalizedSelected === normalizedUid;
          });
        });
        
        console.log('ToggleUser - Adding user:', {
          userName: user?.name,
          userId,
          userAllIds,
          toAdd,
          currentSelected: prev
        });
        
        return [...prev, ...toAdd];
      }
    });
  };

  const handleSave = () => {
    console.log('UserManagementDialog - Saving users:', {
      channelId: channel.id,
      channelName: channel.name,
      selectedUsers,
      allUsersInfo: allUsers.map(u => ({
        id: u.id,
        username: u.username,
        user_id: u.user_id,
        name: u.name,
        email: u.email
      }))
    });
    
    // Get all possible ID formats for each selected user to ensure matching works
    // We'll save ALL possible ID formats so matching works regardless of which one is used
    const userIdsToSave = [];
    
    selectedUsers.forEach(userId => {
      // Find the user in allUsers - check all possible ID fields
      const user = allUsers.find(u => {
        // Check all ID fields
        const allUserIds = [u.id, u.username, u.user_id].filter(Boolean);
        
        return allUserIds.some(uId => {
          const normalizedUId = String(uId).trim().toLowerCase();
          const normalizedUserId = String(userId).trim().toLowerCase();
          
          // Exact match
          if (normalizedUId === normalizedUserId) return true;
          
          // Numeric match
          const uIdNum = Number(uId);
          const userIdNum = Number(userId);
          if (!isNaN(uIdNum) && !isNaN(userIdNum) && uIdNum === userIdNum) return true;
          
          return false;
        });
      });
      
      if (user) {
        // Save ALL possible ID formats to ensure matching works
        // The order matches Chat.jsx: user?.id || user?.username || user?.userId || user?.user_id
        // We save all of them so matching works regardless of which one is used
        const idsToAdd = [];
        
        // Add in priority order (matching Chat.jsx logic: user?.id || user?.username || user?.userId)
        // Note: allUsers from database has user_id, but logged-in user object has userId
        if (user.id) idsToAdd.push(user.id);
        if (user.username && !idsToAdd.includes(user.username)) idsToAdd.push(user.username);
        // Check both user_id (from database) and userId (from logged-in user object)
        const userIdValue = user.user_id || user.userId;
        if (userIdValue && !idsToAdd.includes(userIdValue)) idsToAdd.push(userIdValue);
        
        // Remove duplicates (case-insensitive)
        const uniqueIds = [];
        idsToAdd.forEach(id => {
          const normalizedId = String(id).trim().toLowerCase();
          if (!uniqueIds.some(existing => String(existing).trim().toLowerCase() === normalizedId)) {
            uniqueIds.push(id);
          }
        });
        
        // Add all unique IDs
        uniqueIds.forEach(id => {
          if (!userIdsToSave.some(existing => String(existing).trim().toLowerCase() === String(id).trim().toLowerCase())) {
            userIdsToSave.push(id);
          }
        });
        
        console.log('Found user for ID', userId, ':', {
          name: user.name,
          primaryId: user.id || user.username || user.user_id,
          allIdsToSave: uniqueIds,
          allIds: { id: user.id, username: user.username, user_id: user.user_id }
        });
      } else {
        // User not found, add the original userId
        console.warn('User not found for ID:', userId, 'Available users:', allUsers.map(u => ({
          name: u.name,
          id: u.id,
          username: u.username,
          user_id: u.user_id
        })));
        if (!userIdsToSave.some(existing => String(existing).trim().toLowerCase() === String(userId).trim().toLowerCase())) {
          userIdsToSave.push(userId);
        }
      }
    });
    
    console.log('UserManagementDialog - Final user IDs to save:', userIdsToSave);
    
    updateChannelUsers(channel.id, userIdsToSave);
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
                // Use user.id as primary, fallback to username or user_id
                const userId = user.id || user.username || user.user_id;
                
                // Check if user is selected - need to match against ALL possible ID formats
                // The selectedUsers array might contain any of: user.id, user.username, user.user_id
                const isSelected = selectedUsers.some(selectedId => {
                  if (!selectedId || !userId) return false;
                  
                  const normalizedSelectedId = String(selectedId).trim().toLowerCase();
                  const normalizedUserId = String(userId).trim().toLowerCase();
                  
                  // Direct match with primary userId
                  if (normalizedSelectedId === normalizedUserId) {
                    return true;
                  }
                  
                  // Check against all possible user ID fields
                  const userIdsToCheck = [
                    user.id,
                    user.username,
                    user.user_id
                  ].filter(Boolean).map(id => String(id).trim().toLowerCase());
                  
                  // Check if selectedId matches any of the user's IDs
                  if (userIdsToCheck.some(uid => uid === normalizedSelectedId)) {
                    return true;
                  }
                  
                  // Try numeric comparison
                  const selectedIdNum = Number(selectedId);
                  const userIdNum = Number(userId);
                  if (!isNaN(selectedIdNum) && !isNaN(userIdNum) && selectedIdNum === userIdNum) {
                    return true;
                  }
                  
                  // Also check numeric against all user ID fields
                  for (const uid of [user.id, user.username, user.user_id]) {
                    if (uid) {
                      const uidNum = Number(uid);
                      if (!isNaN(selectedIdNum) && !isNaN(uidNum) && selectedIdNum === uidNum) {
                        return true;
                      }
                    }
                  }
                  
                  return false;
                });
                
                // Debug logging for first user to see matching logic
                if (allUsers.indexOf(user) === 0) {
                  console.log('UserManagementDialog - Checking user selection:', {
                    userName: user.name,
                    userId,
                    userIds: { id: user.id, username: user.username, user_id: user.user_id },
                    selectedUsers,
                    isSelected
                  });
                }
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

