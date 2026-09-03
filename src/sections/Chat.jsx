import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Hash, MessageSquare, X, Menu } from 'lucide-react';
import { useChatStore } from '../stores/chatStore.js';
import { useAppStore } from '../stores/appStore.js';
import { ROLES } from '../utils/permissions.js';
import ChatSidebar from '../components/chat/ChatSidebar.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import ChannelDialog from '../components/chat/ChannelDialog.jsx';
import UserManagementDialog from '../components/chat/UserManagementDialog.jsx';
import SectionDialog from '../components/chat/SectionDialog.jsx';

export default function Chat() {
  const { user, userRole, allUsers = [] } = useAppStore();
  const {
    channels,
    selectedChannel,
    selectChannel,
    sections,
    getSortedSections,
    reorderSections,
    reorderChannels,
    deleteChannel,
    deleteSection,
    initialize,
    setupRealtimeSubscription,
    isLoading,
  } = useChatStore();

  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);

  const normalizedRole = String(userRole || '').trim().toLocaleLowerCase();
  const isAdmin = normalizedRole === ROLES.ADMIN;
  const hasManagementAccess = isAdmin || normalizedRole === ROLES.MANAGER;
  const userIdentitySet = new Set(
    [user?.id, user?.username, user?.userId, user?.user_id]
      .filter(Boolean)
      .map(value => String(value).trim().toLocaleLowerCase())
  );

  const normalizeMembers = value => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Support legacy PostgreSQL array strings such as {user-1,user-2}.
    }
    return value
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map(member => member.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  };

  const userChannels = channels.filter(channel => {
    if (channel.type === 'voice') return false;
    if (hasManagementAccess) return true;
    return normalizeMembers(channel.users).some(memberId =>
      userIdentitySet.has(String(memberId).trim().toLocaleLowerCase())
    );
  });

  // Get selected channel data
  const currentChannel = userChannels.find(ch => ch.id === selectedChannel);

  // Initialize store and load channels from Supabase - FIXED: Only run once on mount
  useEffect(() => {
    initialize();
    
    // Setup real-time subscription for channel changes
    const subscription = setupRealtimeSubscription();
    
    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array = only run on mount, preventing repeated initialization

  // Auto-select first channel if none selected
  useEffect(() => {
    if (!isLoading && !selectedChannel && userChannels.length > 0) {
      selectChannel(userChannels[0].id);
    }
  }, [selectedChannel, userChannels, selectChannel, isLoading]);

  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-120px)] md:h-[calc(100vh-120px)] bg-[#010333] text-white rounded-xl overflow-hidden relative">
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden flex items-center justify-between p-3 border-b border-slate-800/50 bg-[#0a0a1a]">
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
        >
          <Menu size={20} className="text-white" />
        </button>
        {currentChannel && (
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-[#3b82f6]" />
            <span className="font-semibold text-sm truncate">{currentChannel.name}</span>
          </div>
        )}
        {showSidebar && (
          <button
            onClick={() => setShowSidebar(false)}
            className="p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
          >
            <X size={20} className="text-white" />
          </button>
        )}
      </div>

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Left Sidebar */}
      <div className={`${
        showSidebar ? 'translate-x-0' : '-translate-x-full'
      } md:translate-x-0 fixed md:static inset-y-0 left-0 z-50 md:z-auto transition-transform duration-300 ease-in-out`}>
        <ChatSidebar
        channels={userChannels}
        sections={getSortedSections()}
        selectedChannel={selectedChannel}
        onSelectChannel={(channelId) => {
          selectChannel(channelId);
          setShowSidebar(false);
        }}
        isAdmin={isAdmin}
        onCreateChannel={() => setShowCreateChannel(true)}
        onCreateSection={() => setShowSectionDialog(true)}
        onManageUsers={(channel) => {
          setEditingChannel(channel);
          setShowUserManagement(true);
        }}
        onDeleteChannel={async (channelId) => {
          const success = await deleteChannel(channelId);
          if (!success) return;
          // If deleted channel was selected, clear selection
          if (selectedChannel === channelId) {
            selectChannel(null);
          }
        }}
        onDeleteSection={deleteSection}
        onReorderSections={reorderSections}
        onReorderChannels={reorderChannels}
        allUsers={allUsers}
      />
      </div>

      {/* Main Chat Window */}
      <div className="flex-1 flex flex-col bg-[#010333]">
        {selectedChannel && currentChannel ? (
          <ChatWindow
            channel={currentChannel}
            isAdmin={isAdmin}
            selectedChannelId={selectedChannel}
            onManageUsers={() => {
              setEditingChannel(currentChannel);
              setShowUserManagement(true);
            }}
            onEditChannel={() => {
              setEditingChannel(currentChannel);
              setShowCreateChannel(true);
            }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-bold mb-2">No Channel Selected</h3>
              <p className="text-slate-400">Select a channel from the sidebar to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Channel Dialog */}
      <AnimatePresence>
        {(showCreateChannel || editingChannel) && (
          <ChannelDialog
            onClose={() => {
              setShowCreateChannel(false);
              setEditingChannel(null);
            }}
            editing={editingChannel}
            sections={sections}
            userId={user?.id}
            onCreateSection={() => {
              setShowCreateChannel(false);
              setShowSectionDialog(true);
            }}
          />
        )}
      </AnimatePresence>

      {/* Section Management Dialog */}
      <AnimatePresence>
        {showSectionDialog && (
          <SectionDialog
            onClose={() => setShowSectionDialog(false)}
            sections={sections}
          />
        )}
      </AnimatePresence>

      {/* User Management Dialog */}
      <AnimatePresence>
        {showUserManagement && editingChannel && (
          <UserManagementDialog
            channel={editingChannel}
            allUsers={allUsers}
            onClose={() => {
              setShowUserManagement(false);
              setEditingChannel(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
