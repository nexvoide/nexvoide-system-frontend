"use client";

import { ChatMessageItem } from "./chat-message";
import { useChatScroll } from "../../hooks/useChatScroll";
import { useEnhancedRealtimeChat } from "../../hooks/useEnhancedRealtimeChat";
import MessageInput from "./MessageInput";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../../stores/appStore.js";
import { playNotificationSound, shouldNotify } from "../../utils/chatUtils";
import { supabase, TABLES } from "../../lib/supabase";
import { Hash } from "lucide-react";

/**
 * Enhanced realtime chat component with:
 * - Unread message tracking
 * - @Mention system
 * - Single/Double tick (delivery status)
 * - Real-time updates
 * - Notification sounds
 * - Premium UI with animations
 */
export const RealtimeChat = ({
  roomName,
  readOnly = false,
  isAdmin = false,
  selectedChannelId = null,
}) => {
  const { containerRef, scrollToBottom } = useChatScroll();
  const { user, allUsers = [], employees = [] } = useAppStore();
  const [replyToMessage, setReplyToMessage] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const previousMessagesLengthRef = useRef(0);
  const [isTabFocused, setIsTabFocused] = useState(true);
  const [sendError, setSendError] = useState('');
  const messageMapRef = useRef({}); // Cache for reply-to messages

  // Track tab focus for notifications
  useEffect(() => {
    const handleFocus = () => setIsTabFocused(true);
    const handleBlur = () => setIsTabFocused(false);
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  useEffect(() => {
    let dismissTimer;
    const handleSendError = (event) => {
      setSendError(event.detail?.message || 'Message could not be sent.');
      window.clearTimeout(dismissTimer);
      dismissTimer = window.setTimeout(() => setSendError(''), 3500);
    };
    window.addEventListener('chat-send-error', handleSendError);
    return () => {
      window.clearTimeout(dismissTimer);
      window.removeEventListener('chat-send-error', handleSendError);
    };
  }, []);

  const { messages, sendMessage, isConnected, isLoading, markAsRead, updateMessage, onlineUsers } = useEnhancedRealtimeChat({
    roomName,
    username: user?.name || "Anonymous",
    userId: user?.id,
    userAvatar: user?.avatar || null,
    allUsers,
    employees,
  });

  // Build message map for reply-to lookups
  useEffect(() => {
    messages.forEach(msg => {
      messageMapRef.current[msg.id] = msg;
    });
  }, [messages]);

  // Scroll to bottom and mark as read when messages change
  useEffect(() => {
    scrollToBottom();
    
    // Mark latest messages as read when channel is open
    if (roomName === selectedChannelId && messages.length > 0) {
      const latestMessages = messages.slice(-5); // Mark last 5 messages as read
      latestMessages.forEach(msg => {
        if (msg.user?.id !== user?.id) {
          markAsRead(msg.id);
        }
      });
    }
  }, [messages, scrollToBottom, roomName, selectedChannelId, markAsRead, user]);

  // Mark channel as read when it's selected and messages are loaded/viewed
  useEffect(() => {
    if (roomName === selectedChannelId && messages.length > 0) {
      // Trigger markChannelAsRead via custom event
      const event = new CustomEvent('markChannelAsRead', { detail: { channelId: roomName } });
      window.dispatchEvent(event);
    }
  }, [roomName, selectedChannelId, messages.length]);

  // Play notification sound for new messages
  useEffect(() => {
    if (messages.length > previousMessagesLengthRef.current && previousMessagesLengthRef.current > 0) {
      const newMessages = messages.slice(previousMessagesLengthRef.current);
      
      newMessages.forEach(newMsg => {
        // Only notify if:
        // 1. Message is not from current user
        // 2. Channel is not open OR tab is not focused
        const isNotOwnMessage = newMsg.user?.id !== user?.id;
        const shouldPlaySound = shouldNotify(roomName, selectedChannelId, isTabFocused);
        
        if (isNotOwnMessage && shouldPlaySound) {
          console.log('🔔 Playing notification sound for new message');
          playNotificationSound();
        }
      });
    }
    
    previousMessagesLengthRef.current = messages.length;
  }, [messages, roomName, selectedChannelId, isTabFocused, user]);

  const handleSendMessage = useCallback(
    (content, attachments = []) => {
      if ((!content || !content.trim()) && (!attachments || attachments.length === 0)) return;
      if (!isConnected || (readOnly && !isAdmin)) return;
      
      // If editing, update the message instead of sending new one
      if (editingMessage) {
        updateMessage(editingMessage.id, content || '', attachments);
        setEditingMessage(null);
      } else {
        sendMessage(content || '', replyToMessage?.id, attachments);
        setReplyToMessage(null);
      }
    },
    [isConnected, sendMessage, readOnly, isAdmin, replyToMessage, editingMessage, updateMessage]
  );

  const handleReply = useCallback((message) => {
    setReplyToMessage(message);
    // Scroll to input and focus
    setTimeout(() => {
      const input = document.querySelector('textarea');
      input?.focus();
    }, 100);
  }, []);

  const handleEdit = useCallback(async (message) => {
    setEditingMessage(message);
    // Scroll to input and focus with message content
    setTimeout(() => {
      const input = document.querySelector('textarea');
      if (input) {
        input.value = message.content;
        input.focus();
      }
    }, 100);
  }, []);

  const handleDelete = useCallback(async (message) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    
    try {
      const { error } = await supabase
        .from(TABLES.messages)
        .delete()
        .eq('id', message.id)
        .eq('author_id', user?.id);
      
      if (error) {
        console.error('Failed to delete message:', error);
        alert('Failed to delete message');
      }
    } catch (e) {
      console.error('Error deleting message:', e);
      alert('Failed to delete message');
    }
  }, [user]);

  const handleCancelReply = useCallback(() => {
    setReplyToMessage(null);
    setEditingMessage(null);
  }, []);

  return (
    <div className='relative flex flex-col flex-1 min-h-0 h-0 w-full overflow-hidden antialiased'>
      <div className='hidden md:flex h-10 flex-none items-center justify-between px-6 border-b border-slate-400/10 bg-[#080d18] text-xs text-[#64748b]'>
        <div className='flex items-center gap-3 min-w-0'>
          <span className='flex items-center gap-2 flex-shrink-0'>
            <i className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-[#22c55e]' : 'bg-amber-400'}`} />
            {isConnected ? 'Live' : 'Reconnecting'}
          </span>
          {onlineUsers.length > 0 && (
            <div className='flex items-center' aria-label={`${onlineUsers.length} online`}>
              {onlineUsers.slice(0, 5).map((onlineUser, index) => (
                <div
                  key={onlineUser.id}
                  className={`relative w-7 h-7 rounded-full border-2 border-[#080d18] bg-[#1e293b] overflow-visible ${index > 0 ? '-ml-2' : ''}`}
                  title={`${onlineUser.name} · Online`}
                >
                  {onlineUser.avatar ? (
                    <img src={onlineUser.avatar} alt={onlineUser.name} className='w-full h-full rounded-full object-cover' />
                  ) : (
                    <span className='w-full h-full rounded-full flex items-center justify-center text-[10px] font-semibold text-slate-200'>
                      {onlineUser.name.trim().charAt(0).toUpperCase()}
                    </span>
                  )}
                  <i className='absolute right-[-1px] bottom-[-1px] w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#080d18]' />
                </div>
              ))}
              {onlineUsers.length > 5 && (
                <span className='-ml-2 w-7 h-7 rounded-full border-2 border-[#080d18] bg-[#1e293b] flex items-center justify-center text-[9px] text-slate-300'>
                  +{onlineUsers.length - 5}
                </span>
              )}
              <span className='ml-2 text-[#64748b]'>{onlineUsers.length} online</span>
            </div>
          )}
        </div>
      </div>
      {/* Connection Status Indicator */}
      {!isConnected && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className='absolute top-2 left-1/2 transform -translate-x-1/2 z-10 px-3 py-1.5 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-xs text-yellow-300 flex items-center gap-2'
        >
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
          {isLoading ? 'Loading messages...' : 'Connecting to chat...'}
        </motion.div>
      )}
      {sendError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className='absolute top-3 left-1/2 -translate-x-1/2 z-20 max-w-[calc(100%-24px)] rounded-lg border border-red-400/20 bg-red-950/95 px-3 py-2 text-center text-xs text-red-200 shadow-lg'
        >
          {sendError}
        </motion.div>
      )}
      
      {/* Messages */}
      <div
        ref={containerRef}
        className='chat-messages flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain px-3 sm:px-5 md:px-6 py-5 scrollbar-thin'>
        {isLoading && messages.length === 0 ? (
          <div className='text-center text-sm text-slate-400 py-12'>
            <div className="inline-flex items-center gap-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
            </div>
            <p className="text-xs text-slate-500 mt-2">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className='text-center py-12 px-4'>
            <div className="inline-block p-4 rounded-full bg-slate-800/50 mb-3">
              <Hash size={24} className="text-slate-400" />
            </div>
            <p className='text-sm text-slate-400 font-medium'>No messages yet</p>
            <p className='text-xs text-slate-500 mt-1'>Start the conversation!</p>
            {!isConnected && (
              <p className='text-xs text-red-400 mt-2'>⚠️ Not connected. Check your Supabase configuration.</p>
            )}
          </div>
        ) : (
          <div className='w-full mx-auto space-y-1'>
            {messages.map((message, index) => {
              const prevMessage = index > 0 ? messages[index - 1] : null;
              const showHeader =
                !prevMessage || 
                prevMessage.user?.id !== message.user?.id ||
                new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 300000; // 5 minutes

              // Check if we need to show date separator
              const showDateSeparator = (() => {
                if (!prevMessage) return false;
                const prevDate = new Date(prevMessage.createdAt);
                const currentDate = new Date(message.createdAt);
                return prevDate.toDateString() !== currentDate.toDateString();
              })();

              // Get reply-to message if exists
              const replyTo = message.replyTo ? messageMapRef.current[message.replyTo] : null;

              return (
                <React.Fragment key={message.id}>
                  {showDateSeparator && (
                    <div className="flex items-center justify-center my-4 px-4">
                      <div className="flex-1 h-px bg-slate-700/50"></div>
                      <span className="px-3 text-xs text-slate-400 font-medium">
                        {new Date(message.createdAt).toLocaleDateString("en-US", {
                          day: "numeric",
                          month: "long",
                          year: "numeric"
                        })}
                      </span>
                      <div className="flex-1 h-px bg-slate-700/50"></div>
                    </div>
                  )}
                  <ChatMessageItem
                    message={message}
                    isOwnMessage={message.user?.id === user?.id}
                    showHeader={showHeader}
                    replyToMessage={replyTo}
                    allUsers={allUsers}
                    onReply={handleReply}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <div className='chat-composer flex-none w-full px-3 sm:px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-transparent'>
      <div className='w-full mx-auto'>
      <MessageInput
        channelId={roomName}
        userId={user?.id}
        onSend={handleSendMessage}
        readOnly={readOnly}
        isAdmin={isAdmin}
        isConnected={isConnected}
        replyTo={replyToMessage}
        editingMessage={editingMessage}
        onCancelReply={handleCancelReply}
        allUsers={allUsers}
      />
      </div>
      </div>
    </div>
  );
};
