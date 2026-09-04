import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessageSquare, Loader2 } from 'lucide-react';
import { useChatStore } from '../stores/chatStore.js';
import { useAppStore } from '../stores/appStore.js';
import { ROLES } from '../utils/permissions.js';
import ChatSidebar from '../components/chat/ChatSidebar.jsx';
import ChatWindow from '../components/chat/ChatWindow.jsx';
import ChannelDialog from '../components/chat/ChannelDialog.jsx';
import UserManagementDialog from '../components/chat/UserManagementDialog.jsx';
import SectionDialog from '../components/chat/SectionDialog.jsx';

export default function Chat({ onBack }) {
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
    [user?.id]
      .filter(Boolean)
      .map(value => String(value).trim().toLocaleLowerCase())
  );

  const userChannels = channels.filter(channel => {
    if (hasManagementAccess) return true;
    return channel.memberIds.some(memberId =>
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

  useEffect(() => {
    if (!window.matchMedia('(max-width: 767px)').matches) return undefined;

    if (!window.history.state?.nexvoideChat) {
      const chatHistoryState = { ...window.history.state, nexvoideChat: true };
      window.history.pushState(chatHistoryState, '', window.location.href);
    }

    const handleBrowserBack = () => {
      setShowSidebar(false);
      onBack?.();
    };

    window.addEventListener('popstate', handleBrowserBack);
    return () => window.removeEventListener('popstate', handleBrowserBack);
  }, [onBack]);

  if (isLoading) {
    return (
      <div className="chat-shell flex h-[calc(100dvh-92px)] md:h-[calc(100vh-104px)] min-h-0 overflow-hidden rounded-none md:rounded-[20px] border border-[#1b283d]/80 bg-[#090e1a] text-white">
        <div className="hidden md:flex w-[300px] lg:w-[320px] flex-col border-r border-slate-400/10 bg-[#080d18] p-6">
          <div className="h-6 w-36 rounded bg-slate-700/30 animate-pulse" />
          <div className="mt-8 h-11 w-full rounded-xl bg-slate-700/20 animate-pulse" />
          <div className="mt-8 space-y-3">
            <div className="h-4 w-24 rounded bg-slate-700/20 animate-pulse" />
            <div className="h-10 w-full rounded-lg bg-slate-700/15 animate-pulse" />
            <div className="h-10 w-4/5 rounded-lg bg-slate-700/15 animate-pulse" />
          </div>
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-center bg-[#060912]">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <Loader2 size={18} className="animate-spin text-blue-400" />
            Loading conversations…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-shell flex flex-col md:flex-row h-[calc(100dvh-92px)] md:h-[calc(100vh-104px)] min-h-0 bg-[#090e1a] text-white rounded-none md:rounded-[20px] overflow-hidden relative border border-[#1b283d]/80">

      {/* Mobile Sidebar Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden"
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
        onClose={() => setShowSidebar(false)}
      />
      </div>

      {/* Main Chat Window */}
      <div className="flex-1 min-w-0 min-h-0 overflow-hidden flex flex-col bg-[#010333]">
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
            onOpenSidebar={() => setShowSidebar(true)}
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
