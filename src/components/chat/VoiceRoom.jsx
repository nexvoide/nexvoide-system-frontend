import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, PhoneOff, Users, Monitor, MonitorOff, X, Maximize2 } from 'lucide-react';
import { useVoiceRoomSocket as useVoiceRoom } from '../../hooks/useVoiceRoomSocket.js';
import Avatar from '../Avatar.jsx';
import { useChatStore } from '../../stores/chatStore.js';

export default function VoiceRoom({ channel, userId, userName, userAvatar, allUsers = [], employees = [], currentParticipantCount = 0 }) {
  const { selectChannel, channels } = useChatStore();
  const {
    participants,
    isMuted,
    isDeafened,
    isConnected,
    isConnecting,
    connectionStatus,
    roomFullError,
    speakingUsers,
    isScreenSharing,
    screenShareStream,
    screenSharingUsers,
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
  } = useVoiceRoom(channel?.id, userId, userName, userAvatar, channel?.userLimit);
  
  // Check if room is full
  const userLimit = channel?.userLimit;
  const currentUserCount = participants.length + (isConnected ? 1 : 0); // +1 for current user if connected
  const isRoomFull = userLimit && currentUserCount >= userLimit;
  const remainingSlots = userLimit ? Math.max(0, userLimit - currentUserCount) : null;

  const audioRefs = useRef({});
  const previousChannelIdRef = useRef(null);
  const isLeavingRef = useRef(false); // Track if we're currently leaving a channel to prevent multiple leave operations
  const screenShareVideoRefs = useRef({}); // Store video element refs for screen shares
  const [expandedScreenShare, setExpandedScreenShare] = useState(null); // userId of expanded screen share, or 'local' for own

  // Auto-join on mount or when channel changes - instant switching for voice channels
  // IMPORTANT: Users can only be in ONE voice channel at a time
  useEffect(() => {
    if (!channel?.id || !userId) {
      return;
    }

    const currentChannelId = channel.id;
    const previousChannelId = previousChannelIdRef.current;

    // If switching to a different channel, leave the previous one FIRST
    // This ensures users are never in multiple voice channels simultaneously
    if (previousChannelId && previousChannelId !== currentChannelId && !isLeavingRef.current) {
      console.log('🔄 Voice channel switch detected: leaving', previousChannelId, 'and joining', currentChannelId);
      
      // Set flag to prevent multiple leave operations
      isLeavingRef.current = true;
      
      // IMPORTANT: Update reference AFTER we've handled the leave
      // But we need to track the previous channel ID for the leave broadcast
      const previousChannelIdForLeave = previousChannelId;
      previousChannelIdRef.current = currentChannelId;
      
      // Leave previous room completely - this will broadcast user-left event
      // We need to ensure the leave completes before joining the new room
      console.log('🚪 Leaving previous voice channel:', previousChannelIdForLeave);
      
      // IMPORTANT: We need to leave the PREVIOUS channel, not the current one
      // Since leaveRoom uses the current channelId prop, we need to temporarily
      // store the previous channel ID and ensure leaveRoom uses it
      // The leaveRoom function will use channelRef.current which should still point to the old channel
      
      // Call leaveRoom which will handle cleanup and broadcast
      // Note: leaveRoom uses channelRef.current, which should still be connected to the previous channel
      // This will disconnect from the previous channel
      leaveRoom();
      
      // After leaving, we'll join the new channel in the timeout below
      
      // Wait for leave to complete (broadcast sent, cleanup done)
      // Then join the new channel
      const switchTimeout = setTimeout(() => {
        // Reset leaving flag
        isLeavingRef.current = false;
        
        if (channel?.id === currentChannelId && userId) {
          console.log('✅ Previous channel left, now joining new channel:', currentChannelId);
          
          // Check room capacity BEFORE joining - strict check
          const userLimit = channel?.userLimit;
          if (userLimit && userLimit > 0) {
            const currentCount = currentParticipantCount || 0;
            // If current count >= limit, room is FULL (no more users can join)
            if (currentCount >= userLimit) {
              const errorMsg = `Room is full! Maximum ${userLimit} user${userLimit !== 1 ? 's' : ''} allowed. Currently ${currentCount} user${currentCount !== 1 ? 's' : ''} in room.`;
              alert(errorMsg);
              console.warn('❌ Cannot join - Room is full:', errorMsg, 'Current:', currentCount, 'Limit:', userLimit);
              // Don't join - select a different channel or deselect
              const textChannel = channels.find(ch => ch.type !== 'voice');
              if (textChannel) {
                selectChannel(textChannel.id);
              } else {
                selectChannel(null);
              }
              return;
            }
          }
          
          // Now join the new channel
          console.log('✅ Joining new voice channel:', currentChannelId);
          joinRoom();
        }
      }, 50); // Ultra-fast channel switching (50ms)
      
      return () => {
        clearTimeout(switchTimeout);
        isLeavingRef.current = false;
      };
    }

    // First time joining this channel or re-mounting - check capacity first
    if (!previousChannelId || previousChannelId === currentChannelId) {
      previousChannelIdRef.current = currentChannelId;
      
      // Check room capacity BEFORE joining - strict check
      const userLimit = channel?.userLimit;
      if (userLimit && userLimit > 0) {
        const currentCount = currentParticipantCount || 0;
        // If current count >= limit, room is FULL (no more users can join)
        if (currentCount >= userLimit) {
          const errorMsg = `Room is full! Maximum ${userLimit} user${userLimit !== 1 ? 's' : ''} allowed. Currently ${currentCount} user${currentCount !== 1 ? 's' : ''} in room.`;
          alert(errorMsg);
          console.warn('❌ Cannot join - Room is full:', errorMsg, 'Current:', currentCount, 'Limit:', userLimit);
          // Don't join - select a different channel or deselect
          const textChannel = channels.find(ch => ch.type !== 'voice');
          if (textChannel) {
            selectChannel(textChannel.id);
          } else {
            selectChannel(null);
          }
          return;
        }
      }
      
      // Join immediately if not already connected and room is not full
      if (!isConnected && !isConnecting) {
        console.log('🎯 VoiceRoom: Calling joinRoom() for channel:', currentChannelId);
        console.log('🎯 Current state - isConnected:', isConnected, 'isConnecting:', isConnecting);
        joinRoom();
      } else {
        console.log('⚠️ VoiceRoom: Not calling joinRoom - isConnected:', isConnected, 'isConnecting:', isConnecting);
      }
    }
    
    // SAFETY: If we've been connecting for more than 10 seconds, force completion
    if (isConnecting && !isConnected) {
      const timeout = setTimeout(() => {
        console.warn('⚠️ Connection timeout in VoiceRoom - forcing completion after 10 seconds');
        // Force connection state - this is a last resort
        // The hook should handle this, but if it doesn't, we do it here
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [channel?.id, channel?.userLimit, userId, isConnected, isConnecting, joinRoom, leaveRoom, currentParticipantCount, channels, selectChannel]);

  // NOTE: Removed auto-disconnect on unmount
  // Users will stay connected even when navigating away
  // They can only disconnect by pressing the red leave button
  // This allows multi-tasking while staying in the voice room
  
  // Cleanup screen share video refs on unmount (but don't disconnect from voice room)
  useEffect(() => {
    return () => {
      // Clean up all screen share video refs
      Object.values(screenShareVideoRefs.current).forEach(video => {
        if (video) {
          video.srcObject = null;
        }
      });
      screenShareVideoRefs.current = {};
      // NOTE: We intentionally DON'T call leaveRoom() here
      // Users stay connected even when component unmounts (e.g., navigating to another section)
    };
  }, []);

  // OPTIMIZED: Attach audio streams with low latency settings
  useEffect(() => {
    console.log('🔊 Audio setup effect - Participants:', participants.length, participants.map(p => ({ userId: p.userId, hasStream: !!p.stream })));
    
    participants.forEach(participant => {
      if (participant.stream) {
        const streamTracks = participant.stream.getTracks();
        const audioTracks = streamTracks.filter(t => t.kind === 'audio');
        console.log('🔊 Setting up audio for', participant.userId, '- Stream ID:', participant.stream.id, '- Audio tracks:', audioTracks.length, audioTracks.map(t => `ID:${t.id}, enabled:${t.enabled}, muted:${t.muted}, readyState:${t.readyState}`));
        
        if (audioTracks.length === 0) {
          console.warn('⚠️ No audio tracks in stream for', participant.userId);
          return;
        }
        
        let audio = audioRefs.current[participant.userId];
        
        if (!audio) {
          // Create new audio element with optimized settings
          audio = document.createElement('audio');
          audio.setAttribute('playsinline', '');
          audio.setAttribute('autoplay', '');
          audio.setAttribute('controls', 'false');
          audio.style.display = 'none';
          // OPTIMIZATION: Low latency audio settings
          audio.preload = 'auto';
          audio.crossOrigin = 'anonymous';
          document.body.appendChild(audio);
          audioRefs.current[participant.userId] = audio;
          console.log('✅ Created audio element for', participant.userId);
        }
        
        // Always update stream to ensure it's current
        // CRITICAL: Only update if stream actually changed to prevent unnecessary reloads
        if (!audio.srcObject || audio.srcObject.id !== participant.stream.id) {
          console.log('🔄 Updating audio srcObject for', participant.userId, '- Old:', audio.srcObject?.id, '- New:', participant.stream?.id);
          
          // Pause and clear old stream first to prevent conflicts
          if (audio.srcObject && audio.srcObject !== participant.stream) {
            audio.pause();
            // Don't set to null immediately - let it clear naturally
          }
          
          audio.srcObject = participant.stream;
          
          // Force reload the stream
          audio.load();
          
          // Add event listeners to monitor stream changes
          participant.stream.getTracks().forEach(track => {
            track.onended = () => {
              console.warn('⚠️ Audio track ended for', participant.userId);
            };
            track.onmute = () => {
              console.warn('⚠️ Audio track muted for', participant.userId);
            };
            track.onunmute = () => {
              console.log('✅ Audio track unmuted for', participant.userId);
            };
          });
          
          // Monitor stream track additions
          participant.stream.onaddtrack = (event) => {
            console.log('➕ Track added to stream for', participant.userId, '- Track:', event.track.kind, event.track.id);
            if (event.track.kind === 'audio') {
              event.track.enabled = true;
            }
          };
          
          participant.stream.onremovetrack = (event) => {
            console.warn('➖ Track removed from stream for', participant.userId, '- Track:', event.track.kind, event.track.id);
          };
        }
        
        // Ensure all audio tracks are enabled and active
        audioTracks.forEach(track => {
          if (!track.enabled) {
            console.log('🔧 Enabling audio track for', participant.userId, '- Track:', track.id);
            track.enabled = true;
          }
          // Check if track is muted (read-only property, but we can log it)
          if (track.muted) {
            console.warn('⚠️ Audio track is muted for', participant.userId, '- Track:', track.id, '- This will prevent audio playback');
            // Note: track.muted is read-only, but the track should unmute automatically when the remote peer unmutes
            // However, we can monitor for unmute events
            track.onunmute = () => {
              console.log('✅ Audio track unmuted for', participant.userId, '- Attempting to play');
              if (audio.paused) {
                audio.play().catch(err => console.warn('Failed to play after unmute:', err));
              }
            };
          }
          // Monitor track state
          if (track.readyState === 'ended') {
            console.warn('⚠️ Audio track ended for', participant.userId);
          }
        });
        
        // Set volume and ensure not muted
        audio.volume = isDeafened ? 0 : 1;
        audio.muted = false;
        
        // CRITICAL: Force play with aggressive retry and monitoring
        const forcePlayAudio = async () => {
          // Set all properties before playing
          audio.volume = isDeafened ? 0 : 1;
          audio.muted = false;
          
          // Ensure tracks are enabled
          audioTracks.forEach(track => {
            track.enabled = true;
          });
          
          try {
            // Always call play() - even if not paused, this ensures audio is active
            const playPromise = audio.play();
            
            if (playPromise !== undefined) {
              await playPromise;
              console.log('✅ Audio playing for', participant.userId, '- Volume:', audio.volume, '- Muted:', audio.muted, '- Paused:', audio.paused, '- ReadyState:', audio.readyState);
              
              // Verify it's actually playing
              if (audio.paused) {
                console.warn('⚠️ Audio element is paused after play() call for', participant.userId);
                // Retry after a short delay
                setTimeout(() => {
                  audio.play().catch(err => console.warn('Retry play failed:', err));
                }, 100);
              }
            }
          } catch (err) {
            console.error('❌ Audio play error for', participant.userId, ':', err.name, err.message);
            
            // For NotAllowedError, user interaction might be needed
            if (err.name === 'NotAllowedError') {
              console.warn('⚠️ Browser blocked autoplay for', participant.userId, '- User interaction may be required');
            } else if (err.name !== 'AbortError') {
              // Retry for other errors
              setTimeout(() => {
                audio.play().catch(e => {
                  if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                    console.warn('Retry failed:', e.name);
                  }
                });
              }, 500);
            }
          }
        };
        
        // Initial play attempt
        forcePlayAudio();
        
        // Set up continuous monitoring to ensure audio stays playing
        const monitorInterval = setInterval(() => {
          if (!participants.find(p => p.userId === participant.userId && p.stream)) {
            // Participant left, stop monitoring
            clearInterval(monitorInterval);
            return;
          }
          
          // If audio is paused, try to play again
          if (audio.paused && audio.srcObject) {
            console.log('🔄 Audio paused for', participant.userId, '- Attempting to resume');
            audio.play().catch(err => {
              if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                console.warn('Monitor play failed:', err.name);
              }
            });
          }
          
          // Verify volume and muted state
          if (audio.volume === 0 && !isDeafened) {
            console.log('🔧 Restoring volume for', participant.userId);
            audio.volume = 1;
          }
          if (audio.muted && !isDeafened) {
            console.log('🔧 Unmuting audio for', participant.userId);
            audio.muted = false;
          }
        }, 1000); // Check every second
        
        // Store interval for cleanup
        if (!audioRefs.current[`${participant.userId}_monitor`]) {
          audioRefs.current[`${participant.userId}_monitor`] = monitorInterval;
        }
      } else {
        console.log('⚠️ No stream for participant', participant.userId);
      }
    });

    // Remove audio elements for users who left
    Object.keys(audioRefs.current).forEach(key => {
      // Handle both userId and userId_monitor keys
      const userId = key.replace('_monitor', '');
      if (!participants.find(p => p.userId === userId)) {
        if (key.endsWith('_monitor')) {
          // Clear monitoring interval
          const interval = audioRefs.current[key];
          if (interval) {
            clearInterval(interval);
          }
          delete audioRefs.current[key];
        } else {
          // Remove audio element
          const audio = audioRefs.current[key];
          if (audio) {
            audio.pause();
            audio.srcObject = null;
            if (audio.parentNode) {
              audio.parentNode.removeChild(audio);
            }
            delete audioRefs.current[key];
          }
          // Also remove monitor interval if exists
          const monitorKey = `${key}_monitor`;
          if (audioRefs.current[monitorKey]) {
            clearInterval(audioRefs.current[monitorKey]);
            delete audioRefs.current[monitorKey];
          }
        }
      }
    });
  }, [participants, isDeafened]);

  // Debug: Log screen sharing state
  useEffect(() => {
    console.log('🎥 Screen sharing state updated:', {
      isScreenSharing,
      hasLocalStream: !!screenShareStream,
      remoteScreenShares: screenSharingUsers.size,
      remoteUserIds: Array.from(screenSharingUsers.keys()),
      remoteStreams: Array.from(screenSharingUsers.entries()).map(([id, stream]) => ({
        userId: id,
        hasStream: !!stream,
        trackCount: stream?.getTracks?.()?.length || 0,
        trackStates: stream?.getTracks?.()?.map(t => ({ kind: t.kind, readyState: t.readyState, enabled: t.enabled })) || []
      }))
    });
  }, [isScreenSharing, screenShareStream, screenSharingUsers]);

  // Cleanup screen share video refs when streams change to prevent flickering
  useEffect(() => {
    // Clean up refs for users who stopped sharing
    const currentSharingUserIds = new Set();
    if (isScreenSharing) currentSharingUserIds.add('local');
    screenSharingUsers.forEach((_, userId) => currentSharingUserIds.add(userId));
    
    Object.keys(screenShareVideoRefs.current).forEach(refKey => {
      if (!currentSharingUserIds.has(refKey) && !refKey.endsWith('-expanded')) {
        const video = screenShareVideoRefs.current[refKey];
        if (video) {
          video.srcObject = null;
          delete screenShareVideoRefs.current[refKey];
        }
      }
    });
  }, [isScreenSharing, screenSharingUsers]);

  // Helper function to resolve avatar from allUsers and employees (similar to useEnhancedRealtimeChat)
  const resolveUserAvatar = (userId, userName, allUsersList = [], employeesList = []) => {
    // First, try to find in allUsers
    if (allUsersList && allUsersList.length > 0) {
      // Try to find user by ID first
      let foundUser = allUsersList.find(u => {
        const uId = u.id || u.username || u.user_id;
        const searchId = userId;
        return uId === searchId || String(uId) === String(searchId);
      });
      
      // If not found by ID, try by name (case-insensitive)
      if (!foundUser && userName) {
        foundUser = allUsersList.find(u => {
          const uName = (u.name || '').trim().toLowerCase();
          const searchName = userName.trim().toLowerCase();
          return uName === searchName;
        });
      }
      
      // If still not found, try by username
      if (!foundUser && userName) {
        foundUser = allUsersList.find(u => {
          const uUsername = (u.username || '').trim().toLowerCase();
          const searchName = userName.trim().toLowerCase();
          return uUsername === searchName;
        });
      }
      
      if (foundUser) {
        // Check multiple possible avatar field names
        const avatar = foundUser.avatar || 
                       foundUser.profile_picture || 
                       foundUser.profilePicture || 
                       foundUser.avatar_url || 
                       foundUser.avatarUrl ||
                       foundUser.image ||
                       foundUser.photo ||
                       foundUser.picture;
        if (avatar) {
          console.log('VoiceRoom - Found avatar in allUsers for:', { userId, userName, avatar });
          return avatar;
        }
      }
    }
    
    // If not found in users, try employees (matching by name or ID)
    if (employeesList && employeesList.length > 0 && userName) {
      const searchName = userName.trim().toLowerCase();
      const foundEmployee = employeesList.find(emp => {
        const empName = (emp.name || emp.employee_name || '').trim().toLowerCase();
        const empId = String(emp.id || '').toLowerCase();
        const userIdStr = String(userId || '').toLowerCase();
        
        return empName === searchName || 
               empId === userIdStr ||
               empName.includes(searchName) ||
               searchName.includes(empName);
      });
      
      if (foundEmployee) {
        const avatar = foundEmployee.avatar || 
                       foundEmployee.employee_avatar || 
                       foundEmployee.avatar_url || 
                       foundEmployee.avatarUrl ||
                       foundEmployee.image ||
                       foundEmployee.photo ||
                       foundEmployee.picture;
        if (avatar) {
          console.log('VoiceRoom - Found avatar in employees for:', { userId, userName, avatar });
          return avatar;
        }
      }
    }
    
    return null;
  };

  // Get user info for participant
  const getParticipantInfo = (participantUserId, participantUserName) => {
    // First try to find in allUsers
    let user = allUsers.find(u => {
      const uId = u.id || u.username || u.user_id;
      return uId === participantUserId || String(uId) === String(participantUserId);
    });
    
    // If not found by ID, try by name
    if (!user && participantUserName) {
      user = allUsers.find(u => {
        const uName = (u.name || '').trim().toLowerCase();
        const searchName = participantUserName.trim().toLowerCase();
        return uName === searchName;
      });
    }
    
    // If still not found, try by username
    if (!user && participantUserName) {
      user = allUsers.find(u => {
        const uUsername = (u.username || '').trim().toLowerCase();
        const searchName = participantUserName.trim().toLowerCase();
        return uUsername === searchName;
      });
    }
    
    // Resolve avatar using the helper function (check both allUsers and employees)
    const avatar = resolveUserAvatar(participantUserId, participantUserName, allUsers, employees);
    
    return {
      name: user?.name || participantUserName || participantUserId,
      avatar: avatar || user?.avatar || user?.image || user?.profile_picture || user?.profilePicture || user?.avatar_url || user?.avatarUrl || null,
      role: user?.role || null,
    };
  };

  // Resolve current user's avatar from allUsers/employees
  const currentUserResolvedAvatar = resolveUserAvatar(userId, userName, allUsers, employees);
  const currentUserAvatar = currentUserResolvedAvatar || userAvatar || null;

  const allParticipants = [
    { 
      userId, 
      userName, 
      userAvatar: currentUserAvatar,
      avatar: currentUserAvatar,
      isLocal: true 
    },
    ...participants.map(p => {
      const participantInfo = getParticipantInfo(p.userId, p.userName);
      return {
        ...p,
        ...participantInfo,
        // Use resolved avatar if available, otherwise fall back to participant's userAvatar
        avatar: participantInfo.avatar || p.userAvatar || null,
        isLocal: false,
      };
    }),
  ];

  return (
    <div className="flex-1 flex flex-col bg-[#010333] text-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-800/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
            <Mic size={20} className="text-[#3b82f6]" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{channel?.name || 'Voice Room'}</h2>
            <p className="text-sm text-slate-400">
              {isConnected ? (
                <>
                  {allParticipants.length} participant{allParticipants.length !== 1 ? 's' : ''}
                  {userLimit && (
                    <span className={isRoomFull ? ' text-red-400' : ''}>
                      {' '}/ {userLimit} max
                      {remainingSlots !== null && remainingSlots > 0 && (
                        <span className="text-green-400"> ({remainingSlots} slot{remainingSlots !== 1 ? 's' : ''} left)</span>
                      )}
                      {isRoomFull && <span className="text-red-400"> - Room Full</span>}
                    </span>
                  )}
                </>
              ) : isConnecting ? (
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  <span className="text-sm">{connectionStatus || 'Connecting...'}</span>
                </span>
              ) : (
                'Not connected'
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-slate-400">
            <Users size={16} />
            <span className="text-sm">{allParticipants.length}</span>
          </div>
        </div>
      </div>

      {/* Expanded Screen Share Modal - Discord-like UI */}
      {expandedScreenShare && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center" onClick={() => setExpandedScreenShare(null)}>
          <div className="relative w-full h-full flex flex-col bg-[#1e1f22]" onClick={(e) => e.stopPropagation()}>
            {/* Top Bar */}
            <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
              {expandedScreenShare === 'local' && isScreenSharing && screenShareStream ? (
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                  <span className="text-white font-semibold text-sm">You are sharing your screen</span>
                </div>
              ) : (
                (() => {
                  const sharingUser = allParticipants.find(p => p.userId === expandedScreenShare);
                  return (
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></div>
                      <span className="text-white font-semibold text-sm">
                        {sharingUser?.userName || sharingUser?.name || 'Screen Share'}
                      </span>
                      <span className="text-slate-400 text-xs">is sharing their screen</span>
                    </div>
                  );
                })()
              )}
              <button
                onClick={() => setExpandedScreenShare(null)}
                className="w-8 h-8 bg-black/60 hover:bg-red-500 text-white rounded-lg flex items-center justify-center transition-all backdrop-blur-sm border border-slate-700/50 shadow-lg"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Container */}
            <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
              {expandedScreenShare === 'local' && isScreenSharing && screenShareStream && (
                <video
                  key="expanded-local-screen-share"
                  ref={(video) => {
                    if (video && screenShareStream) {
                      const existingRef = screenShareVideoRefs.current['local-expanded'];
                      if (existingRef !== video) {
                        screenShareVideoRefs.current['local-expanded'] = video;
                        video.srcObject = screenShareStream;
                        video.setAttribute('playsinline', '');
                        video.setAttribute('autoplay', '');
                        video.muted = true;
                        video.play().catch(err => console.warn('Error playing screen share:', err));
                      }
                    }
                  }}
                  className="w-full h-full object-contain"
                  style={{ imageRendering: 'auto' }}
                  playsInline
                  autoPlay
                  muted
                />
              )}
              {expandedScreenShare !== 'local' && screenSharingUsers.has(expandedScreenShare) && (
                <video
                  key={`expanded-screen-share-${expandedScreenShare}`}
                  ref={(video) => {
                    if (video) {
                      const stream = screenSharingUsers.get(expandedScreenShare);
                      if (stream) {
                        const existingRef = screenShareVideoRefs.current[`${expandedScreenShare}-expanded`];
                        if (existingRef !== video || video.srcObject !== stream) {
                          screenShareVideoRefs.current[`${expandedScreenShare}-expanded`] = video;
                          video.srcObject = stream;
                          video.setAttribute('playsinline', '');
                          video.setAttribute('autoplay', '');
                          video.muted = false; // Allow audio if screen share has audio
                          video.play().catch(err => {
                            console.warn('Error playing remote screen share:', err);
                            // Retry after a short delay
                            setTimeout(() => {
                              if (video && video.srcObject === stream) {
                                video.play().catch(e => console.error('Retry failed:', e));
                              }
                            }, 500);
                          });
                        }
                      } else {
                        console.warn('No stream found for expanded screen share:', expandedScreenShare);
                      }
                    }
                  }}
                  className="w-full h-full object-contain bg-black"
                  style={{ imageRendering: 'auto' }}
                  playsInline
                  autoPlay
                />
              )}
            </div>

            {/* Bottom Control Bar - Discord-like */}
            <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 via-black/80 to-transparent p-4">
              <div className="flex items-center justify-center gap-3">
                {/* Mute/Unmute Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleMute();
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    isMuted
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-slate-700/80 hover:bg-slate-600/80 text-white'
                  }`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {/* Deafen/Undeafen Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDeafen();
                  }}
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-lg ${
                    isDeafened
                      ? 'bg-red-500 hover:bg-red-600 text-white'
                      : 'bg-slate-700/80 hover:bg-slate-600/80 text-white'
                  }`}
                  title={isDeafened ? 'Undeafen' : 'Deafen'}
                >
                  {isDeafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>

                {/* Stop Sharing Button (only for local user) */}
                {expandedScreenShare === 'local' && isScreenSharing && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      stopScreenShare();
                      setExpandedScreenShare(null);
                    }}
                    className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
                    title="Stop Sharing"
                  >
                    <MonitorOff size={20} />
                  </button>
                )}

                {/* Leave Voice Channel Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    leaveRoom();
                    setExpandedScreenShare(null);
                    const textChannel = channels.find(ch => ch.type !== 'voice');
                    if (textChannel) {
                      selectChannel(textChannel.id);
                    } else {
                      selectChannel(null);
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all shadow-lg"
                  title="Leave Voice Room"
                >
                  <PhoneOff size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Participants Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isConnected ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            <AnimatePresence>
              {/* Screen Share Thumbnail Cards */}
              {isScreenSharing && screenShareStream && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-slate-800/50 rounded-xl p-3 border-2 border-green-500/50 hover:border-green-500 transition-all cursor-pointer group shadow-lg"
                  onClick={() => setExpandedScreenShare('local')}
                >
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-2">
                    <video
                      ref={(video) => {
                        if (video && screenShareStream) {
                          const existingRef = screenShareVideoRefs.current['local-thumb'];
                          // Only update if video element changed OR stream changed
                          if (existingRef !== video || video.srcObject !== screenShareStream) {
                            screenShareVideoRefs.current['local-thumb'] = video;
                            // Don't reload if stream is the same
                            if (video.srcObject !== screenShareStream) {
                              video.srcObject = screenShareStream;
                            }
                            video.setAttribute('playsinline', '');
                            video.setAttribute('autoplay', '');
                            video.muted = true;
                            // Only play if not already playing
                            if (video.paused) {
                              video.play().catch(err => {
                                if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                                  console.warn('Error playing screen share thumb:', err);
                                }
                              });
                            }
                          }
                        }
                      }}
                      className="w-full h-full object-cover"
                      playsInline
                      autoPlay
                      muted
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 size={32} className="text-white drop-shadow-lg" />
                    </div>
                    <div className="absolute top-2 left-2 bg-red-500/90 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 shadow-lg">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                      LIVE
                    </div>
                    <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium">
                      Your Screen
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-xs text-white flex items-center justify-center gap-1">
                      <Monitor size={14} className="text-green-400" />
                      Screen Share
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">Click to expand</div>
                  </div>
                </motion.div>
              )}
              {Array.from(screenSharingUsers.entries()).map(([sharingUserId, stream]) => {
                console.log('🎬 Rendering screen share card for', sharingUserId, 'Stream:', stream, 'Tracks:', stream?.getTracks().length);
                const sharingUser = allParticipants.find(p => p.userId === sharingUserId);
                if (!stream || (stream.getTracks && stream.getTracks().length === 0)) {
                  console.warn('⚠️ Empty or invalid stream for screen share card:', sharingUserId);
                  return null;
                }
                return (
                  <motion.div
                    key={`screen-share-thumb-${sharingUserId}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-slate-800/50 rounded-xl p-3 border-2 border-green-500/50 hover:border-green-500 transition-all cursor-pointer group shadow-lg"
                    onClick={() => setExpandedScreenShare(sharingUserId)}
                  >
                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-2">
                      <video
                        ref={(video) => {
                          if (video && stream) {
                            const existingRef = screenShareVideoRefs.current[`${sharingUserId}-thumb`];
                            // Update if video element changed OR if stream changed
                            if (existingRef !== video || video.srcObject !== stream) {
                              screenShareVideoRefs.current[`${sharingUserId}-thumb`] = video;
                              // Only set srcObject if it's different to avoid reload
                              if (video.srcObject !== stream) {
                                video.srcObject = stream;
                              }
                              video.setAttribute('playsinline', '');
                              video.setAttribute('autoplay', '');
                              video.muted = false;
                              console.log('📺 Attaching screen share stream to thumbnail for', sharingUserId, 'Stream tracks:', stream.getTracks().length);
                              // Only play if not already playing
                              if (video.paused) {
                                video.play().catch(err => {
                                  if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
                                    console.warn('Error playing remote screen share thumb:', err);
                                    // Retry after delay
                                    setTimeout(() => {
                                      if (video && video.srcObject === stream && video.paused) {
                                        video.play().catch(e => {
                                          if (e.name !== 'AbortError' && e.name !== 'NotAllowedError') {
                                            console.error('Retry failed:', e);
                                          }
                                        });
                                      }
                                    }, 500);
                                  }
                                });
                              }
                            }
                          } else if (video && !stream) {
                            console.warn('No stream available for screen share thumbnail:', sharingUserId);
                          }
                        }}
                        className="w-full h-full object-cover bg-black"
                        playsInline
                        autoPlay
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Maximize2 size={32} className="text-white drop-shadow-lg" />
                      </div>
                      <div className="absolute top-2 left-2 bg-red-500/90 text-white px-2 py-1 rounded text-xs font-bold flex items-center gap-1.5 shadow-lg">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        LIVE
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-medium">
                        {sharingUser?.userName || sharingUser?.name || 'Screen Share'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-xs text-white flex items-center justify-center gap-1">
                        <Monitor size={14} className="text-green-400" />
                        Screen Share
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">Click to expand</div>
                    </div>
                  </motion.div>
                );
              })}
              
              {allParticipants.map((participant) => (
                <motion.div
                  key={participant.userId}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50 hover:border-[#3b82f6]/50 transition-all"
                >
                  <div className="flex flex-col items-center gap-3">
                    {/* Avatar */}
                    <div className="relative">
                      {/* Speaking wave effect - minimal */}
                      {speakingUsers.has(participant.userId) && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="absolute w-16 h-16 rounded-full border-2 border-green-400/50 animate-ping"></div>
                          <div className="absolute w-20 h-20 rounded-full border-2 border-green-400/30 animate-ping" style={{ animationDelay: '0.15s' }}></div>
                        </div>
                      )}
                      <Avatar
                        src={participant.avatar || participant.userAvatar}
                        name={participant.userName || participant.name}
                        size="lg"
                      />
                      {/* Speaking indicator */}
                      {!participant.isLocal && participant.stream && (
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-800 animate-pulse"></div>
                      )}
                      {/* Muted indicator */}
                      {participant.isLocal && isMuted && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-red-500 rounded-full border-2 border-slate-800 flex items-center justify-center">
                          <MicOff size={12} />
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <div className="text-center">
                      <div className="font-medium text-sm">
                        {participant.userName || participant.name}
                        {participant.isLocal && ' (You)'}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center gap-2 text-xs">
                      {participant.isLocal ? (
                        <>
                          {isMuted ? (
                            <span className="text-red-400 flex items-center gap-1">
                              <MicOff size={12} />
                              Muted
                            </span>
                          ) : (
                            <span className="text-green-400 flex items-center gap-1">
                              <Mic size={12} />
                              Speaking
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-green-400 flex items-center gap-1">
                          <Mic size={12} />
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              {roomFullError ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <Mic size={32} className="text-red-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-red-400">Room is Full</h3>
                  <p className="text-slate-400 mb-4">{roomFullError}</p>
                  <button
                    onClick={() => {
                      const textChannel = channels.find(ch => ch.type !== 'voice');
                      if (textChannel) {
                        selectChannel(textChannel.id);
                      } else {
                        selectChannel(null);
                      }
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                  >
                    Go Back
                  </button>
                </>
              ) : isConnecting ? (
                <>
                  <div className="w-16 h-16 rounded-full bg-[#3b82f6]/20 flex items-center justify-center mx-auto mb-4 animate-pulse">
                    <Mic size={32} className="text-[#3b82f6]" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Connecting to Voice Room...</h3>
                  <p className="text-slate-400 mb-2 text-sm">{connectionStatus || 'Please wait...'}</p>
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  {/* Only show microphone prompt if status indicates we're still requesting access */}
                  {connectionStatus && connectionStatus.includes('Requesting microphone') && (
                    <p className="text-xs text-slate-500 mt-4">Please allow microphone access when prompted</p>
                  )}
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                    <Mic size={32} className="text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Not Connected</h3>
                  <p className="text-slate-400">Click to join the voice room</p>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 border-t border-slate-800/50 bg-slate-900/50">
        <div className="flex items-center justify-center gap-4">
          {/* Mute/Unmute */}
          <button
            onClick={toggleMute}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Deafen/Undeafen */}
          <button
            onClick={toggleDeafen}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isDeafened
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
            title={isDeafened ? 'Undeafen' : 'Deafen'}
          >
            {isDeafened ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          {/* Screen Share */}
          <button
            onClick={isScreenSharing ? stopScreenShare : startScreenShare}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${
              isScreenSharing
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            }`}
            title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
          >
            {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
          </button>

          {/* Leave */}
          <button
            onClick={() => {
              leaveRoom();
              // Navigate away from voice room - select first text channel or null
              const textChannel = channels.find(ch => ch.type !== 'voice');
              if (textChannel) {
                selectChannel(textChannel.id);
              } else {
                selectChannel(null);
              }
            }}
            className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-all"
            title="Leave Voice Room"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

