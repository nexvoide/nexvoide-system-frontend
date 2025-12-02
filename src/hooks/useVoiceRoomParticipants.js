import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAppStore } from "../stores/appStore.js";

/**
 * Hook to track participant counts for all voice channels
 * Listens to Supabase broadcasts to track who's in each voice room
 */
export function useVoiceRoomParticipants(channels = [], currentUserId = null) {
  const { user, allUsers = [], employees = [] } = useAppStore();
  // Use provided currentUserId or get from store
  const userId = currentUserId || user?.id || user?.username || user?.userId;
  const [participantCounts, setParticipantCounts] = useState({});
  const [participantDetails, setParticipantDetails] = useState({}); // { channelId: [{ userId, userName, userAvatar }] }
  const channelsRef = useRef({}); // Store channel subscriptions: { channelId: channel }
  const currentUserChannelsRef = useRef({}); // Track which channels the current user is in: { channelId: true/false }
  const presenceRequestSentRef = useRef({}); // Track which channels we've sent presence requests to: { channelId: true/false }

  useEffect(() => {
    // Filter only voice channels
    const voiceChannels = channels.filter(ch => ch.type === 'voice');
    
    if (!supabase || voiceChannels.length === 0) {
      return;
    }

    // Subscribe to all voice room channels
    voiceChannels.forEach(channel => {
      const channelId = channel.id;
      const channelName = `voice-room-${channelId}`;
      
      // Skip if already subscribed
      if (channelsRef.current[channelId]) {
        return;
      }

      console.log('Subscribing to voice room for participant tracking:', channelName);
      // Enable receiving own broadcasts so we can track ourselves in participant count
      const supabaseChannel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true }, // Receive our own broadcasts
        },
      });

      // Track user joins - include ALL joins including self
      supabaseChannel.on('broadcast', { event: 'user-joined' }, ({ payload }) => {
        if (payload.channelId === channelId) {
          const { userId: joinedUserId, userName: joinedUserName, userAvatar: joinedUserAvatar } = payload;
          
          console.log('👤 User joined broadcast received:', { channelId, joinedUserId, joinedUserName });
          
          setParticipantCounts(prev => {
            const current = prev[channelId] || new Set();
            const updated = new Set(current);
            updated.add(joinedUserId);
            
            // Track if current user joined
            const normalizedPayloadUserId = String(joinedUserId).trim().toLowerCase();
            const normalizedCurrentUserId = String(userId).trim().toLowerCase();
            if (normalizedPayloadUserId === normalizedCurrentUserId) {
              currentUserChannelsRef.current[channelId] = true;
              console.log('useVoiceRoomParticipants - Current user joined:', channelId);
            }
            
            return {
              ...prev,
              [channelId]: updated,
            };
          });
          
          // Also track participant details (name and avatar) - use functional update to avoid stale state
          setParticipantDetails(prev => {
            const current = prev[channelId] || [];
            // Check if user already exists
            const userExists = current.find(p => {
              const normalizedPId = String(p.userId).trim().toLowerCase();
              const normalizedJId = String(joinedUserId).trim().toLowerCase();
              return normalizedPId === normalizedJId;
            });
            
            if (userExists) {
              console.log('User already in participant list, skipping:', joinedUserId);
              return prev; // User already in list
            }
            
            // Resolve avatar from allUsers/employees
            let resolvedAvatar = joinedUserAvatar;
            if (!resolvedAvatar) {
              // Try to find in allUsers
              const foundUser = allUsers.find(u => {
                const uId = u.id || u.username || u.user_id;
                const normalizedUId = String(uId).trim().toLowerCase();
                const normalizedJId = String(joinedUserId).trim().toLowerCase();
                return normalizedUId === normalizedJId;
              });
              
              if (foundUser) {
                resolvedAvatar = foundUser.avatar || 
                                foundUser.profile_picture || 
                                foundUser.profilePicture || 
                                foundUser.avatar_url || 
                                foundUser.avatarUrl ||
                                foundUser.image ||
                                foundUser.photo ||
                                foundUser.picture;
              } else if (employees && employees.length > 0) {
                // Try employees
                const foundEmployee = employees.find(emp => {
                  const empId = String(emp.id || '').toLowerCase();
                  const empName = (emp.name || emp.employee_name || '').trim().toLowerCase();
                  const userIdStr = String(joinedUserId || '').toLowerCase();
                  const userNameStr = (joinedUserName || '').trim().toLowerCase();
                  
                  return empId === userIdStr || empName === userNameStr;
                });
                
                if (foundEmployee) {
                  resolvedAvatar = foundEmployee.avatar || 
                                  foundEmployee.employee_avatar || 
                                  foundEmployee.avatar_url || 
                                  foundEmployee.avatarUrl ||
                                  foundEmployee.image ||
                                  foundEmployee.photo ||
                                  foundEmployee.picture;
                }
              }
            }
            
            return {
              ...prev,
              [channelId]: [...current, {
                userId: joinedUserId,
                userName: joinedUserName || joinedUserId,
                userAvatar: resolvedAvatar,
              }],
            };
          });
        }
      });

      // Track user leaves - include ALL leaves including self
      supabaseChannel.on('broadcast', { event: 'user-left' }, ({ payload }) => {
        if (payload.channelId === channelId) {
          const { userId: leftUserId, userName: leftUserName } = payload;
          
          console.log('👋 User left broadcast received:', { channelId, leftUserId, leftUserName });
          
          // Remove from participant counts - use functional update to ensure we have latest state
          setParticipantCounts(prev => {
            const current = prev[channelId] || new Set();
            const updated = new Set(current);
            
            // Try to delete using exact match first
            updated.delete(leftUserId);
            
            // Also try to delete using normalized IDs (in case of ID format mismatch)
            const normalizedLeftId = String(leftUserId).trim().toLowerCase();
            for (const id of current) {
              const normalizedId = String(id).trim().toLowerCase();
              if (normalizedId === normalizedLeftId) {
                updated.delete(id);
                console.log('Removed user from counts using normalized ID:', id, '->', leftUserId);
                break;
              }
            }
            
            // Track if current user left
            const normalizedPayloadUserId = String(leftUserId).trim().toLowerCase();
            const normalizedCurrentUserId = String(userId).trim().toLowerCase();
            if (normalizedPayloadUserId === normalizedCurrentUserId) {
              currentUserChannelsRef.current[channelId] = false;
              console.log('useVoiceRoomParticipants - Current user left:', channelId);
            }
            
            console.log('Updated participant counts:', { channelId, before: current.size, after: updated.size, leftUserId });
            
            return {
              ...prev,
              [channelId]: updated.size > 0 ? updated : undefined,
            };
          });
          
          // Also remove from participant details - use functional update
          setParticipantDetails(prev => {
            const current = prev[channelId] || [];
            const normalizedLeftId = String(leftUserId).trim().toLowerCase();
            
            const updated = current.filter(p => {
              const normalizedPId = String(p.userId).trim().toLowerCase();
              // Remove if IDs match (exact or normalized)
              return normalizedPId !== normalizedLeftId;
            });
            
            console.log('Removed user from participant details:', { 
              channelId, 
              leftUserId, 
              leftUserName,
              before: current.length, 
              after: updated.length,
              removedUser: current.find(p => String(p.userId).trim().toLowerCase() === normalizedLeftId)?.userName
            });
            
            // Force a re-render by always returning a new object
            const result = {
              ...prev,
              [channelId]: updated.length > 0 ? updated : undefined,
            };
            
            return result;
          });
        }
      });

      supabaseChannel.subscribe((status, err) => {
        if (err) {
          console.error('Error subscribing to voice room channel:', channelName, err);
          return;
        }
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscribed to voice room channel:', channelName);
          // Channel is now subscribed and ready to receive broadcasts
          
          // IMPORTANT: Request all existing users to re-broadcast their presence
          // This ensures we see all users who are already in the room
          // We do this by sending a "presence-request" broadcast
          // Only send once per channel to avoid spam
          if (!presenceRequestSentRef.current[channelId]) {
            setTimeout(() => {
              try {
                supabaseChannel.send({
                  type: 'broadcast',
                  event: 'presence-request',
                  payload: {
                    channelId,
                    requesterId: userId,
                    timestamp: new Date().toISOString(),
                  },
                });
                presenceRequestSentRef.current[channelId] = true;
                console.log('📡 Sent presence request for channel:', channelId);
                
                // Reset after 5 seconds so we can request again if needed
                setTimeout(() => {
                  presenceRequestSentRef.current[channelId] = false;
                }, 5000);
              } catch (error) {
                console.warn('Error sending presence request:', error);
              }
            }, 200); // Small delay to ensure subscription is fully established
          }
        }
      });
      channelsRef.current[channelId] = supabaseChannel;
      
      // Listen for presence requests - when received, re-broadcast our join if we're in this room
      supabaseChannel.on('broadcast', { event: 'presence-request' }, ({ payload }) => {
        if (payload.channelId === channelId && payload.requesterId !== userId) {
          // Someone is requesting presence - if we're in this room, re-broadcast our join
          // Check if current user is in this channel
          const isInChannel = currentUserChannelsRef.current[channelId];
          if (isInChannel) {
            console.log('📡 Presence request received, re-broadcasting join for channel:', channelId);
            // Re-broadcast our join so the requester can see us
            setTimeout(() => {
              try {
                supabaseChannel.send({
                  type: 'broadcast',
                  event: 'user-joined',
                  payload: {
                    userId,
                    userName: user?.name || user?.username || userId,
                    userAvatar: user?.avatar || user?.image,
                    channelId,
                    timestamp: new Date().toISOString(),
                    isReBroadcast: true, // Indicate this is a re-broadcast
                  },
                });
                console.log('✅ Re-broadcasted join for presence request');
              } catch (error) {
                console.warn('Error re-broadcasting join:', error);
              }
            }, 100);
          }
        }
      });
      
      // After subscribing, we'll receive broadcasts from all users who join
      // The broadcast handlers above will track all participants
    });

    // Cleanup: unsubscribe from channels that no longer exist
    Object.keys(channelsRef.current).forEach(channelId => {
      if (!voiceChannels.find(ch => ch.id === channelId)) {
        const channel = channelsRef.current[channelId];
        if (channel) {
          channel.unsubscribe();
          delete channelsRef.current[channelId];
        }
        setParticipantCounts(prev => {
          const updated = { ...prev };
          delete updated[channelId];
          return updated;
        });
      }
    });

    // Cleanup function
    return () => {
      Object.values(channelsRef.current).forEach(channel => {
        if (channel) {
          channel.unsubscribe();
        }
      });
      channelsRef.current = {};
    };
  }, [channels, userId, allUsers, employees]);

  // Convert Sets to counts
  // The count should include the current user if they're in the room
  const counts = {};
  Object.keys(participantCounts).forEach(channelId => {
    const participantSet = participantCounts[channelId];
    let count = participantSet?.size || 0;
    
    // Check if current user is in this channel
    // The participantSet should include all users including current user
    // But we need to make sure we're counting correctly
    if (userId && participantSet) {
      const normalizedCurrentUserId = String(userId).trim().toLowerCase();
      const hasCurrentUser = Array.from(participantSet).some(id => {
        const normalizedId = String(id).trim().toLowerCase();
        return normalizedId === normalizedCurrentUserId;
      });
      
      // If current user is marked as in channel but not in set, they might have just joined
      // In this case, the count from the set should already be correct
      // The set should include all users who have broadcasted their join
      
      // Log for debugging
      if (channelId === Object.keys(participantCounts)[0]) { // Only log for first channel to avoid spam
        console.log('useVoiceRoomParticipants - Count for channel:', {
          channelId,
          setSize: participantSet.size,
          hasCurrentUser,
          currentUserInChannel: currentUserChannelsRef.current[channelId],
          participantIds: Array.from(participantSet).map(id => String(id))
        });
      }
    }
    
    counts[channelId] = count;
  });

  return {
    counts,
    participantDetails, // Return participant details: { channelId: [{ userId, userName, userAvatar }] }
  };
}

