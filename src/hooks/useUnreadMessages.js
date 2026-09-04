import { useState, useEffect, useCallback } from 'react';
import { supabase, TABLES } from '../lib/supabase';
import { useAppStore } from "../stores/appStore.js";

/**
 * Hook to track unread message counts per channel
 */
export function useUnreadMessages(channels = [], selectedChannelId = null) {
  const { user } = useAppStore();
  const [unreadCounts, setUnreadCounts] = useState({});
  const [mentionCounts, setMentionCounts] = useState({});

  const userId = user?.id;

  // Load initial unread counts
  useEffect(() => {
    if (!userId || !supabase || channels.length === 0) return;

    const loadUnreadCounts = async () => {
      try {
        // Get unread counts for all channels
        const { data: readData, error: readError } = await supabase
          .from('user_channel_reads')
          .select('channel_id, unread_count, last_read_message_id')
          .eq('user_id', userId);

        if (readError) {
          console.warn('Failed to load unread counts:', readError);
          return;
        }

        const counts = {};
        readData?.forEach(item => {
          counts[item.channel_id] = item.unread_count || 0;
        });

        setUnreadCounts(counts);

        // Get mention counts
        const { data: mentionData, error: mentionError } = await supabase
          .from('user_mentions')
          .select('channel_id')
          .eq('user_id', userId)
          .eq('is_read', false);

        if (mentionError) {
          console.warn('Failed to load mention counts:', mentionError);
          return;
        }

        const mentionCountsMap = {};
        mentionData?.forEach(item => {
          mentionCountsMap[item.channel_id] = (mentionCountsMap[item.channel_id] || 0) + 1;
        });

        setMentionCounts(mentionCountsMap);
      } catch (e) {
        console.warn('Error loading unread counts:', e);
      }
    };

    loadUnreadCounts();
  }, [userId, channels.length]);

  // Mark channel as read
  const markChannelAsRead = useCallback(async (channelId) => {
    if (!userId || !supabase || !channelId) return;

    try {
      // Get the latest message ID for this channel
      // FIX: Use .maybeSingle() instead of .single() - it returns null if no rows instead of error
      const { data: latestMessage, error: msgError } = await supabase
        .from(TABLES.messages)
        .select('id')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(); // Returns single object or null (no error if no rows)

      if (msgError || !latestMessage) {
        // If no messages exist, still mark as read
        // Handle both PGRST116 (no rows) and 406 (not acceptable) errors
        if (msgError?.code === 'PGRST116' || msgError?.code === 'PGRST204' || !latestMessage) {
          // No messages found - still mark channel as read
          const { error } = await supabase
            .from('user_channel_reads')
            .upsert({
              user_id: userId,
              channel_id: channelId,
              last_read_at: new Date().toISOString(),
              unread_count: 0,
            }, {
              onConflict: 'user_id,channel_id'
            });

          if (!error) {
            setUnreadCounts(prev => ({
              ...prev,
              [channelId]: 0
            }));
            // Also clear mention counts for this channel
            setMentionCounts(prev => ({
              ...prev,
              [channelId]: 0
            }));
          }
        } else if (msgError) {
          // Log other errors but don't block
          console.warn('Error getting latest message (non-critical):', msgError);
        }
        return;
      }

      // Update or create read record
      const { error } = await supabase
        .from('user_channel_reads')
        .upsert({
          user_id: userId,
          channel_id: channelId,
          last_read_message_id: latestMessage.id,
          last_read_at: new Date().toISOString(),
          unread_count: 0,
        }, {
          onConflict: 'user_id,channel_id'
        });

      if (error) {
        console.warn('Failed to mark channel as read:', error);
        return;
      }

      // Update local state - clear unread count
      setUnreadCounts(prev => ({
        ...prev,
        [channelId]: 0
      }));

      // Also clear mention counts for this channel
      setMentionCounts(prev => ({
        ...prev,
        [channelId]: 0
      }));

      // Mark all mentions in this channel as read
      await supabase
        .from('user_mentions')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('channel_id', channelId)
        .eq('is_read', false);
    } catch (e) {
      console.warn('Error marking channel as read:', e);
    }
  }, [userId]);

  // Subscribe to real-time updates for unread counts
  useEffect(() => {
    if (!userId || !supabase) return;

    // Subscribe to new messages
    const messageChannel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: TABLES.messages,
        },
        async (payload) => {
          const newMessage = payload.new;
          const channelId = newMessage.channel_id;
          const messageUserId = newMessage.author_id;

          // Don't count own messages
          if (messageUserId === userId) return;

          // Only increment if this channel is not currently selected
          if (channelId !== selectedChannelId) {
            // Update unread count in database
            try {
              const { data: readData } = await supabase
                .from('user_channel_reads')
                .select('unread_count')
                .eq('user_id', userId)
                .eq('channel_id', channelId)
                .single();

              const currentCount = readData?.unread_count || 0;
              
              await supabase
                .from('user_channel_reads')
                .upsert({
                  user_id: userId,
                  channel_id: channelId,
                  unread_count: currentCount + 1,
                }, {
                  onConflict: 'user_id,channel_id'
                });

              // Update local state
              setUnreadCounts(prev => ({
                ...prev,
                [channelId]: currentCount + 1
              }));
            } catch (e) {
              // Fallback to local state if DB update fails
              setUnreadCounts(prev => ({
                ...prev,
                [channelId]: (prev[channelId] || 0) + 1
              }));
            }

            // Check if current user is mentioned
            if (newMessage.mentions && Array.isArray(newMessage.mentions)) {
              if (newMessage.mentions.includes(userId)) {
                setMentionCounts(prev => ({
                  ...prev,
                  [channelId]: (prev[channelId] || 0) + 1
                }));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      messageChannel.unsubscribe();
      supabase.removeChannel(messageChannel);
    };
  }, [userId, selectedChannelId]);

  // Auto-mark as read when channel is selected
  useEffect(() => {
    if (selectedChannelId) {
      // Small delay to ensure messages are loaded
      const timer = setTimeout(() => {
        markChannelAsRead(selectedChannelId);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [selectedChannelId, markChannelAsRead]);

  // Listen for custom event to mark channel as read when messages are viewed
  useEffect(() => {
    const handleMarkAsRead = (event) => {
      const { channelId } = event.detail;
      if (channelId) {
        markChannelAsRead(channelId);
      }
    };

    window.addEventListener('markChannelAsRead', handleMarkAsRead);
    return () => {
      window.removeEventListener('markChannelAsRead', handleMarkAsRead);
    };
  }, [markChannelAsRead]);

  return {
    unreadCounts,
    mentionCounts,
    markChannelAsRead,
    getUnreadCount: (channelId) => unreadCounts[channelId] || 0,
    getMentionCount: (channelId) => mentionCounts[channelId] || 0,
    hasUnread: (channelId) => (unreadCounts[channelId] || 0) > 0,
    hasMentions: (channelId) => (mentionCounts[channelId] || 0) > 0,
  };
}
