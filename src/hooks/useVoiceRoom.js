import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';

/**
 * Hook for managing voice room connections using WebRTC
 * Handles peer-to-peer audio connections between users in a voice channel
 */
export function useVoiceRoom(channelId, userId, userName, userAvatar, userLimit = null, currentParticipantCountFromSidebar = 0) {
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false); // Track connecting state
  const [connectionStatus, setConnectionStatus] = useState(''); // Status message
  const [localStream, setLocalStream] = useState(null);
  const [roomFullError, setRoomFullError] = useState(null);
  const [speakingUsers, setSpeakingUsers] = useState(new Set()); // Track which users are currently speaking
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenSharingUsers, setScreenSharingUsers] = useState(new Map()); // { userId: stream }
  
  const peersRef = useRef({}); // Store peer connections: { userId: RTCPeerConnection }
  const localStreamRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const channelRef = useRef(null);
  const previousChannelIdRef = useRef(null); // Track previous channel ID for proper leave on switch
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speakingCheckIntervalRef = useRef(null);
  const remoteAnalysersRef = useRef({}); // { userId: AnalyserNode }

  // Detect if local user is speaking
  const startSpeakingDetection = useCallback(() => {
    if (speakingCheckIntervalRef.current) {
      clearInterval(speakingCheckIntervalRef.current);
    }
    
    speakingCheckIntervalRef.current = setInterval(() => {
      if (!analyserRef.current || isMuted) {
        setSpeakingUsers(prev => {
          const updated = new Set(prev);
          updated.delete(userId);
          return updated;
        });
        return;
      }
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate average volume
      const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
      const threshold = 30; // Adjust this value to change sensitivity
      
      setSpeakingUsers(prev => {
        const updated = new Set(prev);
        if (average > threshold) {
          updated.add(userId);
        } else {
          updated.delete(userId);
        }
        return updated;
      });
    }, 100); // Check every 100ms
  }, [userId, isMuted]);
  
  // Set up audio analysis for remote participants
  const setupRemoteAudioAnalysis = useCallback((userId, stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      const checkInterval = setInterval(() => {
        if (!remoteAnalysersRef.current[userId]) {
          clearInterval(checkInterval);
          return;
        }
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const threshold = 30;
        
        setSpeakingUsers(prev => {
          const updated = new Set(prev);
          if (average > threshold) {
            updated.add(userId);
          } else {
            updated.delete(userId);
          }
          return updated;
        });
      }, 100);
      
      remoteAnalysersRef.current[userId] = { analyser, audioContext, interval: checkInterval };
    } catch (error) {
      console.warn('Could not set up remote audio analysis for', userId, error);
    }
  }, []);

  // Initialize local audio stream with audio analysis
  const initializeLocalStream = useCallback(async () => {
    // Check if we already have a valid stream
    if (localStreamRef.current && localStreamRef.current.active) {
      console.log('✅ Reusing existing microphone stream');
      return localStreamRef.current;
    }

    try {
      console.log('🎤 Requesting microphone access...');
      
      // Check permissions first (if supported)
      let hasPermission = false;
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'microphone' });
          hasPermission = permissionStatus.state === 'granted';
          console.log('Microphone permission status:', permissionStatus.state);
        } catch (permError) {
          console.warn('Could not check microphone permissions:', permError);
        }
      }

      // Add timeout to prevent hanging (reduced to 5 seconds for faster feedback)
      const getUserMediaPromise = navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Microphone access timeout - took longer than 5 seconds'));
        }, 5000); // Reduced from 10000ms to 5000ms for faster feedback
      });

      const stream = await Promise.race([getUserMediaPromise, timeoutPromise]);
      
      console.log('✅ Microphone access granted, stream obtained');
      
      // CRITICAL: Update status IMMEDIATELY - this must be the first thing after getting the stream
      // Store stream first, then update status synchronously
      localStreamRef.current = stream;
      setLocalStream(stream);
      
      // Update status immediately - React will process this in the next render cycle
      setConnectionStatus('Microphone ready, connecting to voice room...');
      
      // Use requestAnimationFrame to ensure UI update happens on next frame
      // This helps ensure the status update is visible immediately
      if (typeof window !== 'undefined' && window.requestAnimationFrame) {
        requestAnimationFrame(() => {
          // Force a re-render by checking if status needs update
          // This is a no-op but ensures React processes the state update
        });
      }
      
      // Set up audio analysis for speaking detection
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        microphone.connect(analyser);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        
        // Start checking for speaking
        startSpeakingDetection();
        console.log('✅ Audio analysis set up');
      } catch (audioError) {
        console.warn('Could not set up audio analysis:', audioError);
        // Don't fail the whole connection if audio analysis fails
      }
      
      return stream;
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Could not access microphone. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.';
      } else if (error.message && error.message.includes('timeout')) {
        errorMessage += 'Request timed out. Please try again or check your microphone.';
      } else {
        errorMessage += 'Please check permissions and try again.';
      }
      
      alert(errorMessage);
      return null;
    }
  }, [startSpeakingDetection]);

  // Create peer connection for a user (OPTIMIZED for lowest latency and best quality)
  const createPeerConnection = useCallback((targetUserId) => {
    console.log('Creating optimized peer connection for', targetUserId);
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        // Multiple STUN servers for redundancy and faster connection
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'] },
        { urls: 'stun:stun4.l.google.com:19302' },
        // Additional public STUN servers for better NAT traversal
        { urls: 'stun:stun.stunprotocol.org:3478' },
        { urls: 'stun:stun.voiparound.com' },
        { urls: 'stun:stun.voipbuster.com' },
      ],
      iceCandidatePoolSize: 20, // Increased for faster connection (pre-gather more candidates)
      iceTransportPolicy: 'all', // Use both UDP and TCP for maximum compatibility
      bundlePolicy: 'max-bundle', // Bundle RTP streams for efficiency
      rtcpMuxPolicy: 'require', // Require RTCP multiplexing
      // Additional optimizations for low latency
      sdpSemantics: 'unified-plan', // Use unified plan for better compatibility
    });
    
    // OPTIMIZATION: Set connection constraints for low latency
    if (peerConnection.setConfiguration) {
      try {
        peerConnection.setConfiguration({
          iceServers: peerConnection.getConfiguration().iceServers,
          iceCandidatePoolSize: 20,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
        });
      } catch (e) {
        // Ignore if already set
      }
    }

    // OPTIMIZATION: Add local stream tracks with optimized settings
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        // Optimize audio track settings for low latency
        if (track.kind === 'audio') {
          // Set optimal audio constraints
          if (track.getSettings) {
            const settings = track.getSettings();
            // Ensure low latency mode
            if (track.applyConstraints) {
              track.applyConstraints({
                latency: 0.01, // 10ms latency
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              }).catch(err => console.warn('Could not apply audio constraints:', err));
            }
          }
        }
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }
    
    // Add screen share stream if available
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, screenShareStreamRef.current);
      });
    }

    // Handle incoming stream
    peerConnection.ontrack = (event) => {
      console.log('🎥 Received track from', targetUserId, 'Track:', event.track.kind, 'Label:', event.track.label, 'Stream ID:', event.streams[0]?.id, 'Event:', event);
      
      // Handle each track individually
      const track = event.track;
      const [remoteStream] = event.streams;
      
      if (!track) {
        console.warn('No track in ontrack event');
        return;
      }
      
      // Log all track details for debugging
      console.log('Track details:', {
        kind: track.kind,
        label: track.label,
        id: track.id,
        enabled: track.enabled,
        readyState: track.readyState,
        streamId: remoteStream?.id
      });
      
      // Check if this is a screen share track - be very lenient with detection
      const trackLabel = track.label ? track.label.toLowerCase() : '';
      
      // Check if it's definitely NOT a screen share (webcam/microphone)
      const isWebcam = trackLabel.includes('camera') || 
                       trackLabel.includes('webcam') || 
                       trackLabel.includes('front') ||
                       trackLabel.includes('back') ||
                       trackLabel.includes('facing');
      
      // Check if it's likely a screen share
      const hasScreenShareKeywords = trackLabel.includes('screen') || 
                                     trackLabel.includes('display') ||
                                     trackLabel.includes('window') ||
                                     trackLabel.includes('desktop') ||
                                     trackLabel.includes('monitor') ||
                                     trackLabel.includes('entire screen') ||
                                     trackLabel.includes('application');
      
      // Get current participants state to check if user already has audio stream
      // We need to check this outside the state update
      const currentParticipants = peersRef.current[targetUserId] ? 
        (() => {
          // Try to get from state - we'll use a ref for this
          const participantInfo = { hasAudioStream: false };
          // Check if we've received audio for this user by checking senders
          const senders = peersRef.current[targetUserId]?.getSenders() || [];
          participantInfo.hasAudioStream = senders.some(s => s.track && s.track.kind === 'audio');
          return participantInfo;
        })() : { hasAudioStream: false };
      
      // If it's a video track, treat it as screen share if:
      // 1. It has screen share keywords, OR
      // 2. It doesn't have webcam keywords AND the stream has no audio tracks (screen share typically has no audio), OR
      // 3. We already have an audio stream for this user (so this video track must be screen share)
      const isScreenShare = track.kind === 'video' && (
        hasScreenShareKeywords || 
        (!isWebcam && !remoteStream?.getAudioTracks().length) ||
        currentParticipants.hasAudioStream
      );
      
      console.log('🔍 Track detection for', targetUserId, {
        kind: track.kind,
        label: track.label,
        isWebcam,
        hasScreenShareKeywords,
        hasAudioTracks: remoteStream?.getAudioTracks().length || 0,
        hasAudioStream: currentParticipants.hasAudioStream,
        isScreenShare
      });
      
      if (isScreenShare) {
        // This is a screen share track
        console.log('✅ SCREEN SHARE DETECTED from', targetUserId, 'Track label:', track.label, 'Track state:', track.readyState);
        
        // Ensure track is enabled and active
        if (track.readyState === 'ended') {
          console.warn('Screen share track is ended for', targetUserId);
          setScreenSharingUsers(prev => {
            const updated = new Map(prev);
            updated.delete(targetUserId);
            return updated;
          });
          return;
        }
        
        // Enable the track if it's disabled
        if (!track.enabled) {
          track.enabled = true;
          console.log('Enabled screen share track for', targetUserId);
        }
        
        setScreenSharingUsers(prev => {
          const updated = new Map(prev);
          // Create or update the screen share stream with this video track
          let screenShareStream = updated.get(targetUserId);
          if (!screenShareStream) {
            screenShareStream = new MediaStream();
            updated.set(targetUserId, screenShareStream);
            console.log('✅ Created new screen share stream for', targetUserId);
          }
          // Add the track if it's not already in the stream
          if (!screenShareStream.getTracks().includes(track)) {
            screenShareStream.addTrack(track);
            console.log('✅ Added screen share track to stream for', targetUserId, 'Stream now has', screenShareStream.getTracks().length, 'tracks');
            console.log('📊 ScreenSharingUsers Map now has', updated.size, 'entries:', Array.from(updated.keys()));
            
            // Listen for track ending
            track.onended = () => {
              console.log('Screen share track ended for', targetUserId);
              setScreenSharingUsers(prev => {
                const updated = new Map(prev);
                updated.delete(targetUserId);
                return updated;
              });
            };
            
            // Also listen for track state changes
            track.onmute = () => {
              console.warn('Screen share track muted for', targetUserId);
            };
            track.onunmute = () => {
              console.log('Screen share track unmuted for', targetUserId);
            };
          } else {
            console.log('Screen share track already in stream for', targetUserId);
          }
          return updated;
        });
      } else if (track.kind === 'audio') {
        // Regular audio track (microphone)
        console.log('Remote audio track received from', targetUserId);
        if (remoteStream) {
          setParticipants(prev => {
            const existing = prev.find(p => p.userId === targetUserId);
            if (existing) {
              return prev.map(p => 
                p.userId === targetUserId 
                  ? { ...p, stream: remoteStream }
                  : p
              );
            }
            return [...prev, { userId: targetUserId, stream: remoteStream }];
          });
          
          // Set up audio analysis for remote participant
          setupRemoteAudioAnalysis(targetUserId, remoteStream);
        }
      } else if (track.kind === 'video' && !isScreenShare) {
        // Video track that's not a screen share (could be webcam, but we don't use that)
        console.log('⚠️ Received video track (not detected as screen share) from', targetUserId, 'Label:', track.label);
        // Try to treat it as screen share anyway if it's the only video track
        console.log('Attempting to add as screen share anyway...');
        setScreenSharingUsers(prev => {
          const updated = new Map(prev);
          let screenShareStream = updated.get(targetUserId);
          if (!screenShareStream) {
            screenShareStream = new MediaStream();
            updated.set(targetUserId, screenShareStream);
          }
          if (!screenShareStream.getTracks().includes(track)) {
            screenShareStream.addTrack(track);
            console.log('✅ Added video track as screen share for', targetUserId);
          }
          return updated;
        });
      }
    };
    
    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('Peer connection state for', targetUserId, ':', peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed') {
        console.error('Peer connection failed for', targetUserId);
      }
    };
    
    // Handle ICE connection state
    peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', targetUserId, ':', peerConnection.iceConnectionState);
    };

    // Handle ICE candidates - OPTIMIZATION: Use trickle ICE for faster connection
    // Send candidates immediately as they're generated, don't wait for all candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate immediately via channelRef (faster than creating new channel)
        if (channelRef.current) {
          try {
            channelRef.current.send({
              type: 'broadcast',
              event: 'ice-candidate',
              payload: {
                from: userId,
                to: targetUserId,
                candidate: event.candidate,
                channelId, // Include channelId to ensure room isolation
              },
            });
            // Don't log every candidate to avoid console spam
          } catch (error) {
            console.warn('Error sending ICE candidate:', error);
          }
        } else {
          // Fallback: create channel if ref not available (shouldn't happen)
          supabase?.channel(`voice-room-${channelId}`).send({
            type: 'broadcast',
            event: 'ice-candidate',
            payload: {
              from: userId,
              to: targetUserId,
              candidate: event.candidate,
              channelId,
            },
          });
        }
      } else {
        console.log('✅ ICE candidate gathering complete for', targetUserId);
      }
    };

    return peerConnection;
  }, [channelId, userId]);

  // Handle offer/answer exchange
  const handleOffer = useCallback(async (fromUserId, offer) => {
    if (fromUserId === userId) return;
    
    console.log('📥 Handling offer from', fromUserId);
    
    // Check if we already have a connection for this user
    let peerConnection = peersRef.current[fromUserId];
    
    // If connection exists, we need to handle renegotiation
    // Check both connectionState and signalingState
    const connectionState = peerConnection?.connectionState;
    const signalingState = peerConnection?.signalingState;
    
    console.log('Checking existing connection for', fromUserId, {
      exists: !!peerConnection,
      connectionState,
      signalingState
    });
    
    if (peerConnection) {
      console.log('🔄 Renegotiating existing connection for', fromUserId, 'ConnectionState:', connectionState, 'SignalingState:', signalingState);
      // This is a renegotiation - the offer includes new tracks (screen share)
      // Make sure we preserve existing audio tracks
      try {
        // Wait for signaling state to be stable if it's not (reduced delay for faster connection)
        if (signalingState !== 'stable') {
          console.log('⚠️ Signaling state not stable, waiting...', signalingState);
          // Wait briefly for signaling to stabilize (minimal delay for faster connection)
          await new Promise(resolve => setTimeout(resolve, 10)); // Reduced from 25ms to 10ms
          // Check again
          if (peerConnection.signalingState !== 'stable') {
            console.warn('⚠️ Signaling state still not stable:', peerConnection.signalingState, 'Proceeding anyway...');
          }
        }
        
        // Check if we need to add local audio track if it's missing
        const senders = peerConnection.getSenders();
        const hasAudioTrack = senders.some(sender => sender.track && sender.track.kind === 'audio');
        
        console.log('Renegotiation - Current senders:', senders.map(s => ({ kind: s.track?.kind, label: s.track?.label })));
        
        if (!hasAudioTrack && localStreamRef.current) {
          console.log('Adding missing audio track during renegotiation');
          localStreamRef.current.getAudioTracks().forEach(track => {
            try {
              peerConnection.addTrack(track, localStreamRef.current);
              console.log('✅ Added audio track during renegotiation');
            } catch (err) {
              console.warn('Could not add audio track during renegotiation:', err);
            }
          });
        }
        
        // Check the offer's SDP to see if it includes video tracks
        const offerSdp = offer.sdp || '';
        const hasVideoInOffer = offerSdp.includes('m=video') || offerSdp.includes('video');
        console.log('📋 Offer SDP includes video:', hasVideoInOffer, 'SDP preview:', offerSdp.substring(0, 300));
        
        // For renegotiation, we need to set the remote description
        // This will trigger ontrack events for new tracks
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('✅ Set remote description (renegotiation) for', fromUserId, 'New signalingState:', peerConnection.signalingState);
        
        const answer = await peerConnection.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await peerConnection.setLocalDescription(answer);
        console.log('✅ Created answer (renegotiation) for', fromUserId, 'with video support');
        
        // Send answer back - use channelRef for faster sending
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'answer',
            payload: {
              from: userId,
              to: fromUserId,
              answer: answer,
              channelId,
            },
          });
        } else {
          // Fallback
          supabase?.channel(`voice-room-${channelId}`).send({
            type: 'broadcast',
            event: 'answer',
            payload: {
              from: userId,
              to: fromUserId,
              answer: answer,
              channelId,
            },
          });
        }
        console.log('✅ Sent renegotiation answer to', fromUserId);
        return;
      } catch (error) {
        console.error('❌ Error handling renegotiation:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        // Don't fall through - keep the existing connection
        return;
      }
    }
    
    // Create new connection if it doesn't exist
    if (!peerConnection) {
      console.log('Creating new peer connection for', fromUserId);
      peerConnection = createPeerConnection(fromUserId);
      peersRef.current[fromUserId] = peerConnection;
    }

    try {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      console.log('Set remote description for', fromUserId);
      
      // Create answer with video support to receive screen shares
      const answer = await peerConnection.createAnswer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await peerConnection.setLocalDescription(answer);
      console.log('Created and set local answer for', fromUserId, 'with video support');

      // Send answer back - use channelRef for faster sending
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            from: userId,
            to: fromUserId,
            answer: answer,
            channelId, // Include channelId to ensure room isolation
          },
        });
      } else {
        // Fallback
        supabase?.channel(`voice-room-${channelId}`).send({
          type: 'broadcast',
          event: 'answer',
          payload: {
            from: userId,
            to: fromUserId,
            answer: answer,
            channelId,
          },
        });
      }
    } catch (error) {
      console.error('Error handling offer from', fromUserId, error);
    }
  }, [channelId, userId, createPeerConnection]);

  const handleAnswer = useCallback(async (fromUserId, answer) => {
    console.log('Handling answer from', fromUserId);
    const peerConnection = peersRef.current[fromUserId];
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('Set remote answer description for', fromUserId);
      } catch (error) {
        console.error('Error setting remote answer for', fromUserId, error);
      }
    } else {
      console.warn('No peer connection found for', fromUserId);
    }
  }, []);

  const handleIceCandidate = useCallback(async (fromUserId, candidate) => {
    const peerConnection = peersRef.current[fromUserId];
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }, []);

  // Join voice room
  const joinRoom = useCallback(async () => {
    console.log('🚀🚀🚀 joinRoom CALLED!', { channelId, userId, isConnected, channelRef: !!channelRef.current });
    console.trace('Join room call stack');
    
    if (!channelId || !userId) {
      console.log('❌ Cannot join room - missing channelId or userId', { channelId, userId });
      return;
    }
    
    // CRITICAL: Set connecting state immediately
    console.log('📝 Setting isConnecting to true');
    setIsConnecting(true);
    setConnectionStatus('Starting connection...');

    // If already connected to this channel, don't join again
    if (isConnected && channelRef.current) {
      console.log('✅ Already connected to room:', channelId);
      // Still ensure connection state is set
      setIsConnected(true);
      setIsConnecting(false);
      return;
    }

    // CHECK ROOM CAPACITY FIRST - before doing anything else
    // Use the actual participant count from sidebar (most accurate)
    const actualParticipantCount = currentParticipantCountFromSidebar > 0 
      ? currentParticipantCountFromSidebar 
      : participants.length;
    
    // Check if room is already at or over capacity
    // If current count >= limit, room is full (no more users can join)
    if (userLimit && userLimit > 0 && actualParticipantCount >= userLimit) {
      const errorMsg = `Room is full! Maximum ${userLimit} user${userLimit !== 1 ? 's' : ''} allowed. Currently ${actualParticipantCount} user${actualParticipantCount !== 1 ? 's' : ''} in room.`;
      console.warn('❌ Cannot join - Room is full:', errorMsg, 'Current count:', actualParticipantCount, 'Limit:', userLimit);
      setRoomFullError(errorMsg);
      alert(errorMsg);
      setIsConnecting(false);
      setConnectionStatus('Room is full');
      return; // Exit immediately - don't start any join process
    }
    
    // Also check if adding this user would exceed the limit
    const totalCountAfterJoin = actualParticipantCount + 1; // +1 for current user trying to join
    if (userLimit && userLimit > 0 && totalCountAfterJoin > userLimit) {
      const errorMsg = `Room is full! Maximum ${userLimit} user${userLimit !== 1 ? 's' : ''} allowed. Currently ${actualParticipantCount} user${actualParticipantCount !== 1 ? 's' : ''} in room.`;
      console.warn('❌ Cannot join - Room would be full:', errorMsg, 'After join:', totalCountAfterJoin, 'Limit:', userLimit);
      setRoomFullError(errorMsg);
      alert(errorMsg);
      setIsConnecting(false);
      setConnectionStatus('Room is full');
      return; // Exit immediately - don't start any join process
    }

    setRoomFullError(null);
    setIsConnecting(true);
    setConnectionStatus('Initializing connection...');
    console.log('Joining voice room:', channelId, 'for user:', userId, 'limit:', userLimit, 'Current participants:', actualParticipantCount);

    // Note: Cleanup of previous channel should be handled by the component
    // We only clean up if we're somehow still connected to a different channel
    if (channelRef.current && isConnected) {
      console.log('Warning: Already connected to a channel, cleaning up first');
      // Don't call leaveRoom here as it might cause issues - let the component handle it
      // Just close the existing connection
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      setIsConnected(false);
      setParticipants([]);
      peersRef.current = {};
    }

    // OPTIMIZATION: Start Supabase channel subscription and getUserMedia in PARALLEL
    // This significantly reduces connection time (from sequential to parallel)
    const channelName = `voice-room-${channelId}`;
    console.log('Creating Supabase channel:', channelName);
    
    // Track the previous channel ID before updating (for proper leave on switch)
    const oldChannelId = previousChannelIdRef.current;
    if (oldChannelId && oldChannelId !== channelId) {
      console.log('🔄 Channel changed in joinRoom: was', oldChannelId, 'now', channelId);
    }
    previousChannelIdRef.current = channelId;
    
    // Enable receiving own broadcasts so we can track ourselves in participant count
    const channel = supabase?.channel(channelName, {
      config: {
        broadcast: { self: true }, // Receive our own broadcasts
      },
    });
    
    // Start both operations in parallel for faster connection
    setConnectionStatus('Requesting microphone access...');
    
    // Create promises with better error handling and logging
    const streamPromise = initializeLocalStream().catch(error => {
      console.error('Failed to get microphone stream:', error);
      return null;
    });
    
    const channelPromise = new Promise((resolve) => {
      console.log('📡 Subscribing to channel:', channelName);
      
      if (!channel) {
        console.error('❌ Channel is null, cannot subscribe');
        resolve(null);
        return;
      }
      
      let resolved = false;
      let checkInterval = null;
      
      // Add timeout to force resolution (reduced from 5s to 2s for faster connection)
      const forceTimeout = setTimeout(() => {
        if (!resolved) {
          console.warn('⚠️ Channel subscription force timeout after 2 seconds, resolving anyway');
          resolved = true;
          if (checkInterval) clearInterval(checkInterval);
          // Resolve with channel even if not fully subscribed - we'll handle it
          resolve(channel);
        }
      }, 2000); // Reduced from 5000ms to 2000ms for faster connection
      
      // Subscribe to channel immediately (don't wait for getUserMedia)
      channel?.subscribe((status, err) => {
        console.log('📡 Channel subscription callback:', status, err ? 'Error: ' + err.message : '');
        
        if (err) {
          console.error('❌ Error subscribing to channel:', err);
          if (!resolved) {
            resolved = true;
            clearTimeout(forceTimeout);
            if (checkInterval) clearInterval(checkInterval);
            resolve(null);
          }
          return;
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Channel subscribed:', channelName);
          if (!resolved) {
            resolved = true;
            clearTimeout(forceTimeout);
            if (checkInterval) clearInterval(checkInterval);
            resolve(channel);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error('❌ Channel subscription failed:', status);
          if (!resolved) {
            resolved = true;
            clearTimeout(forceTimeout);
            if (checkInterval) clearInterval(checkInterval);
            resolve(null);
          }
        } else {
          console.log('⏳ Channel status:', status, 'Waiting for SUBSCRIBED...');
          // Wait for SUBSCRIBED status (check more frequently for faster connection)
          checkInterval = setInterval(() => {
            const currentState = channel?.state;
            if (currentState === 'joined' || currentState === 'SUBSCRIBED') {
              console.log('✅ Channel joined/SUBSCRIBED:', channelName, 'State:', currentState);
              if (!resolved) {
                resolved = true;
                clearTimeout(forceTimeout);
                clearInterval(checkInterval);
                resolve(channel);
              }
            }
          }, 25); // Reduced to 25ms for ultra-fast detection
          
          // Timeout after 0.5 seconds (ultra-fast connection)
          setTimeout(() => {
            if (!resolved && checkInterval) {
              const finalState = channel?.state;
              console.log('⏱️ Channel check timeout, final state:', finalState);
              if (finalState === 'joined' || finalState === 'SUBSCRIBED') {
                console.log('✅ Channel joined (timeout check):', channelName);
                if (!resolved) {
                  resolved = true;
                  clearTimeout(forceTimeout);
                  clearInterval(checkInterval);
                  resolve(channel);
                }
              } else {
                console.warn('⚠️ Channel subscription timeout, but resolving anyway:', channelName, 'State:', finalState);
                // Resolve anyway - we'll handle connection even if channel isn't fully ready
                if (!resolved) {
                  resolved = true;
                  clearTimeout(forceTimeout);
                  clearInterval(checkInterval);
                  resolve(channel); // Resolve with channel anyway
                }
              }
            }
          }, 500); // Reduced to 500ms for ultra-fast connection
        }
      });
    });
    
    // Wait for both promises with timeout
    // Use Promise.allSettled to get results even if one fails
    const results = await Promise.allSettled([
      streamPromise,
      channelPromise
    ]);
    
    const stream = results[0].status === 'fulfilled' ? results[0].value : null;
    const subscribedChannel = results[1].status === 'fulfilled' ? results[1].value : null;
    
    // Update status as we progress
    // Note: Status should already be updated by initializeLocalStream when stream is obtained
    // But we check here as a fallback in case the update didn't happen
    if (stream) {
      console.log('✅ Microphone stream obtained');
      // Use functional update to ensure we're working with the current status value
      // This ensures the status updates immediately even if React batched the previous update
      setConnectionStatus(prevStatus => {
        // Only update if still on the old message (prevents unnecessary updates)
        if (prevStatus === 'Requesting microphone access...' || !prevStatus || prevStatus.includes('Requesting')) {
          console.log('📝 Updating status to: Microphone ready, connecting to voice room...');
          return 'Microphone ready, connecting to voice room...';
        }
        // Keep current status if already updated
        return prevStatus;
      });
    } else {
      console.error('❌ Failed to initialize local stream');
      setIsConnecting(false);
      setConnectionStatus('Failed to access microphone - please check permissions');
      setRoomFullError('Could not access microphone. Please allow microphone access and try again.');
      return;
    }
    
    if (!subscribedChannel) {
      console.error('❌ Failed to subscribe to channel - but continuing anyway');
      console.warn('⚠️ Channel subscription failed, but we have stream - marking as connected anyway');
      // Even if channel subscription failed, if we have the stream, mark as connected
      // The channel might still work for broadcasting
      if (stream) {
        console.log('✅ We have stream, marking as connected despite channel subscription issue');
        setIsConnected(true);
        setIsConnecting(false);
        setConnectionStatus('Connected (limited)');
        setRoomFullError(null);
        // Store channel reference anyway - it might still work
        channelRef.current = channel;
        // Don't return - continue with connection
      } else {
        setIsConnecting(false);
        setConnectionStatus('Failed to connect to voice room');
        setRoomFullError('Could not connect to voice room. Please try again.');
        return;
      }
    }
    
    console.log('✅ Both stream and channel ready, establishing connection...');
    setConnectionStatus('Establishing connection...');
    
    // CRITICAL: Mark as connected IMMEDIATELY after stream and channel are ready
    // Set state synchronously first for instant UI update
    setIsConnected(true);
    setIsConnecting(false);
    setConnectionStatus('Connected');
    setRoomFullError(null);
    console.log('✅ Connection marked as complete immediately!');
    
    // Also use requestAnimationFrame to ensure React processes the update
    requestAnimationFrame(() => {
      setIsConnected(true);
      setIsConnecting(false);
    });
    
    // Set up event handlers on the subscribed channel ASYNCHRONOUSLY
    // Don't block connection completion - set up handlers in background
    // Use setTimeout(0) to defer to next event loop cycle
    setTimeout(() => {
      try {
      // Listen for presence requests - when received, re-broadcast our join
      subscribedChannel?.on('broadcast', { event: 'presence-request' }, ({ payload }) => {
        if (payload.channelId === channelId && payload.requesterId !== userId) {
        // Someone is requesting presence - re-broadcast our join so they can see us
        console.log('📡 Presence request received, re-broadcasting join for channel:', channelId);
        // OPTIMIZATION: Send immediately, no delay needed
        if (channelRef.current && (channelRef.current.state === 'joined' || channelRef.current.state === 'SUBSCRIBED')) {
          try {
            channelRef.current.send({
              type: 'broadcast',
              event: 'user-joined',
              payload: {
                userId,
                userName,
                userAvatar,
                channelId,
                timestamp: new Date().toISOString(),
                isReBroadcast: true, // Indicate this is a re-broadcast
              },
            });
            console.log('✅ Re-broadcasted join in response to presence request');
          } catch (error) {
            console.warn('Error re-broadcasting join:', error);
            // Retry once after brief delay if needed (reduced delay)
            setTimeout(() => {
              if (channelRef.current && (channelRef.current.state === 'joined' || channelRef.current.state === 'SUBSCRIBED')) {
                try {
                  channelRef.current.send({
                    type: 'broadcast',
                    event: 'user-joined',
                    payload: {
                      userId,
                      userName,
                      userAvatar,
                      channelId,
                      timestamp: new Date().toISOString(),
                      isReBroadcast: true,
                    },
                  });
                } catch (retryError) {
                  console.warn('Retry failed:', retryError);
                }
              }
            }, 50);
          }
        }
      }
    });
    
    // Broadcast that we joined - only process if it's for THIS channel
    subscribedChannel?.on('broadcast', { event: 'user-joined' }, ({ payload }) => {
      const { userId: joinedUserId, userName: joinedUserName, userAvatar: joinedUserAvatar, channelId: payloadChannelId } = payload;
      
      // Verify this join message is for the current channel
      if (payloadChannelId && payloadChannelId !== channelId) {
        console.log('Ignoring join message from different channel:', payloadChannelId, 'current:', channelId);
        return;
      }
      
      if (joinedUserId !== userId) {
        console.log('User joined this room:', joinedUserId, 'in channel:', channelId);
        
        // Check room capacity before adding participant - use actual count from sidebar
        setParticipants(prev => {
          if (prev.find(p => p.userId === joinedUserId)) {
            console.log('User already in participants list:', joinedUserId);
            return prev;
          }
          
          // Use the actual participant count from sidebar (most accurate)
          // Current count includes: prev.length (other participants) + 1 (current user) = prev.length + 1
          // After adding new user = prev.length + 2
          // But we should use the sidebar count which is more accurate
          const currentActualCount = currentParticipantCountFromSidebar > 0 
            ? currentParticipantCountFromSidebar 
            : (prev.length + 1); // +1 for current user
          
          // Check if room is already at or over capacity
          if (userLimit && userLimit > 0 && currentActualCount >= userLimit) {
            console.log('❌ Room is already full, cannot add user. Current:', currentActualCount, 'Limit:', userLimit);
            // Don't add the participant - room is full
            return prev;
          }
          
          const newCount = currentActualCount + 1; // +1 for the new user trying to join
          
          // Check if adding this user would exceed the limit
          if (userLimit && userLimit > 0 && newCount > userLimit) {
            console.log('❌ Room capacity reached, cannot add user. Current:', currentActualCount, 'After adding:', newCount, 'Limit:', userLimit);
            // Don't add the participant - room is full
            // The user trying to join should have been prevented, but this is a safety check
            return prev;
          }
          
          // Add participant immediately (before WebRTC connection) for instant UI update
          console.log('✅ Adding participant:', joinedUserId, 'New count:', newCount, 'Limit:', userLimit);
          return [...prev, { 
            userId: joinedUserId, 
            userName: joinedUserName, 
            userAvatar: joinedUserAvatar,
            stream: null 
          }];
        });

        // Create offer for new user
        const peerConnection = createPeerConnection(joinedUserId);
        peersRef.current[joinedUserId] = peerConnection;
        
        // If we're already screen sharing, add the screen share track to this new connection
        if (screenShareStreamRef.current) {
          screenShareStreamRef.current.getTracks().forEach(track => {
            try {
              peerConnection.addTrack(track, screenShareStreamRef.current);
              console.log('Added screen share track to new peer connection for', joinedUserId);
            } catch (error) {
              console.error('Error adding screen share track to new connection:', error);
            }
          });
        }

        // OPTIMIZATION: Create offer with optimized SDP for low latency
        peerConnection.createOffer({ 
          offerToReceiveAudio: true, 
          offerToReceiveVideo: true,
          // Optimize SDP for low latency
          voiceActivityDetection: true,
        })
          .then(offer => {
            // OPTIMIZATION: Modify SDP for ultra-low latency
            if (offer.sdp) {
              // Set max audio bitrate for quality
              offer.sdp = offer.sdp.replace(/a=fmtp:\d+ /g, (match) => {
                return match + 'maxplaybackrate=48000; ';
              });
              // Enable low latency mode
              offer.sdp = offer.sdp.replace(/a=rtcp-fb:.* transport-cc/g, '');
              offer.sdp = offer.sdp + '\r\na=x-google-flag:conference\r\n';
            }
            console.log('Created optimized offer for', joinedUserId);
            return peerConnection.setLocalDescription(offer);
          })
          .then(() => {
            console.log('Set local description for offer to', joinedUserId);
            const offer = peerConnection.localDescription;
            // Use channelRef.current for fastest sending
            if (channelRef.current) {
              channelRef.current.send({
                type: 'broadcast',
                event: 'offer',
                payload: {
                  from: userId,
                  to: joinedUserId,
                  offer: offer,
                  channelId,
                },
              });
              console.log('✅ Sent optimized offer to', joinedUserId, 'immediately');
            }
          })
          .catch(error => {
            console.error('Error creating offer for', joinedUserId, error);
          });
        }
      });

      // Handle offers - only process if it's for THIS channel and THIS user
      subscribedChannel?.on('broadcast', { event: 'offer' }, async ({ payload }) => {
      console.log('📨 Broadcast received - offer event:', {
        from: payload.from,
        to: payload.to,
        channelId: payload.channelId,
        currentChannelId: channelId,
        myUserId: userId,
        offerType: payload.offer?.type,
        offerSdpLength: payload.offer?.sdp?.length
      });
      
      // Verify channel and user match
      if (payload.channelId && payload.channelId !== channelId) {
        console.log('❌ Ignoring offer from different channel:', payload.channelId, 'current:', channelId);
        return;
      }
      
      // Check if offer is for this user - be flexible with ID matching
      const userIdVariants = [
        String(userId).trim().toLowerCase(),
        String(userId).trim(),
        userId
      ];
      const payloadToVariants = [
        String(payload.to).trim().toLowerCase(),
        String(payload.to).trim(),
        payload.to
      ];
      
      const isForMe = userIdVariants.some(uid => payloadToVariants.includes(uid)) || 
                      payloadToVariants.some(pid => userIdVariants.includes(pid)) ||
                      payload.to === userId ||
                      String(payload.to).trim().toLowerCase() === String(userId).trim().toLowerCase();
      
      if (isForMe) {
        console.log('✅ Offer is for me! Processing offer from', payload.from, 'in channel:', channelId, 'Offer type:', payload.offer?.type);
        try {
          await handleOffer(payload.from, payload.offer);
        } catch (error) {
          console.error('❌ Error handling offer:', error);
          console.error('Error stack:', error.stack);
        }
      } else {
        console.log('⚠️ Offer not for me. To:', payload.to, 'My userId:', userId, 'Variants:', userIdVariants);
      }
    });

    // Handle answers - only process if it's for THIS channel and THIS user
    subscribedChannel?.on('broadcast', { event: 'answer' }, async ({ payload }) => {
      // Verify channel and user match
      if (payload.channelId && payload.channelId !== channelId) {
        console.log('Ignoring answer from different channel:', payload.channelId, 'current:', channelId);
        return;
      }
      if (payload.to === userId) {
        console.log('Received answer from', payload.from, 'in channel:', channelId);
        await handleAnswer(payload.from, payload.answer);
      }
      });

      // Handle ICE candidates - only process if it's for THIS channel and THIS user
      subscribedChannel?.on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
      // Verify channel and user match
      if (payload.channelId && payload.channelId !== channelId) {
        console.log('Ignoring ICE candidate from different channel:', payload.channelId, 'current:', channelId);
        return;
      }
      if (payload.to === userId) {
        await handleIceCandidate(payload.from, payload.candidate);
      }
      });

      // Handle screen share started
      subscribedChannel?.on('broadcast', { event: 'screen-share-started' }, ({ payload }) => {
        if (payload.channelId === channelId && payload.userId !== userId) {
          console.log('User started screen sharing:', payload.userId);
          // The screen share stream will be received via ontrack
        }
      });

      // Handle screen share stopped
      subscribedChannel?.on('broadcast', { event: 'screen-share-stopped' }, ({ payload }) => {
        if (payload.channelId === channelId && payload.userId !== userId) {
          console.log('User stopped screen sharing:', payload.userId);
          setScreenSharingUsers(prev => {
            const updated = new Map(prev);
            updated.delete(payload.userId);
            return updated;
          });
        }
      });

      // Handle user leaving - only process if it's for THIS channel
      subscribedChannel?.on('broadcast', { event: 'user-left' }, ({ payload }) => {
        const { userId: leftUserId, channelId: payloadChannelId } = payload;
        
        // Verify this leave message is for the current channel
        if (payloadChannelId && payloadChannelId !== channelId) {
          console.log('Ignoring leave message from different channel:', payloadChannelId, 'current:', channelId);
          return;
        }
        
        console.log('User left this room:', leftUserId, 'in channel:', channelId);
        
        // Close peer connection
        if (peersRef.current[leftUserId]) {
          peersRef.current[leftUserId].close();
          delete peersRef.current[leftUserId];
        }
        
        // Remove from screen sharing users
        setScreenSharingUsers(prev => {
          const updated = new Map(prev);
          updated.delete(leftUserId);
          return updated;
        });
        
        // Remove from speaking users
        setSpeakingUsers(prev => {
          const updated = new Set(prev);
          updated.delete(leftUserId);
          return updated;
        });
        
        // Clean up remote audio analysis
        if (remoteAnalysersRef.current[leftUserId]) {
          const { interval, audioContext } = remoteAnalysersRef.current[leftUserId];
          if (interval) clearInterval(interval);
          if (audioContext) audioContext.close();
          delete remoteAnalysersRef.current[leftUserId];
        }
        
      // Remove from participants
      setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
      });
      
        console.log('✅ Event handlers set up successfully');
      } catch (error) {
        console.error('❌ Error setting up event handlers:', error);
        // Don't fail connection - event handlers are not critical for initial connection
        // Connection is already marked as complete above
      }
    }, 0); // Defer to next event loop - don't block connection completion

    // Channel is already subscribed (from Promise.all above)
    channelRef.current = subscribedChannel;
    
    // CRITICAL: Always ensure connection state is set, even after event handler setup
    // This is a safety check in case something reset the state
    setIsConnected(true);
    setIsConnecting(false);
    
    setConnectionStatus('Setting up peer connections...');

    // Double-check room capacity right before broadcasting join (in case count changed during connection)
    // This is a critical safety check - the main check is at the beginning of joinRoom
    const finalParticipantCount = currentParticipantCountFromSidebar > 0 
      ? currentParticipantCountFromSidebar 
      : participants.length;
    
    // Check if room is already at or over capacity
    if (userLimit && userLimit > 0 && finalParticipantCount >= userLimit) {
      const errorMsg = `Room is full! Maximum ${userLimit} user${userLimit !== 1 ? 's' : ''} allowed. Currently ${finalParticipantCount} user${finalParticipantCount !== 1 ? 's' : ''} in room.`;
      console.warn('❌ Room became full during connection - cannot broadcast join:', errorMsg);
      setRoomFullError(errorMsg);
      alert(errorMsg);
      
      // Clean up and don't join
      if (channelRef.current) {
        channelRef.current.unsubscribe().catch(err => console.warn('Error unsubscribing:', err));
        channelRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('Room is full');
      return;
    }
    
    // Also check if adding this user would exceed the limit
    const finalTotalCount = finalParticipantCount + 1;
    if (userLimit && userLimit > 0 && finalTotalCount > userLimit) {
      const errorMsg = `Room is full! Maximum ${userLimit} user${userLimit !== 1 ? 's' : ''} allowed. Currently ${finalParticipantCount} user${finalParticipantCount !== 1 ? 's' : ''} in room.`;
      console.warn('❌ Room would be full during connection - cannot broadcast join:', errorMsg);
      setRoomFullError(errorMsg);
      alert(errorMsg);
      
      // Clean up and don't join
      if (channelRef.current) {
        channelRef.current.unsubscribe().catch(err => console.warn('Error unsubscribing:', err));
        channelRef.current = null;
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
      setIsConnected(false);
      setIsConnecting(false);
      setConnectionStatus('Room is full');
      return;
    }

    // OPTIMIZATION: Broadcast join immediately - channel is already subscribed
    // No delay needed since we waited for subscription in Promise.all
    // IMPORTANT: Don't block connection completion if broadcast fails
    try {
      if (channelRef.current && (channelRef.current.state === 'joined' || channelRef.current.state === 'SUBSCRIBED')) {
        try {
          channelRef.current.send({
            type: 'broadcast',
            event: 'user-joined',
            payload: {
              userId,
              userName,
              userAvatar,
              channelId, // Include channelId to ensure room isolation
              timestamp: new Date().toISOString(),
            },
          });
          console.log('✅ Broadcasted user-joined event for channel:', channelId, 'User:', userName);
        } catch (error) {
          console.error('❌ Error broadcasting user-joined:', error);
          // Retry once immediately if channel is ready
          if (channelRef.current && (channelRef.current.state === 'joined' || channelRef.current.state === 'SUBSCRIBED')) {
            try {
              channelRef.current.send({
                type: 'broadcast',
                event: 'user-joined',
                payload: {
                  userId,
                  userName,
                  userAvatar,
                  channelId,
                  timestamp: new Date().toISOString(),
                },
              });
              console.log('✅ Retry: Broadcasted user-joined event for channel:', channelId);
            } catch (retryError) {
              console.error('❌ Retry failed to broadcast user-joined:', retryError);
              // Don't fail connection - continue anyway
            }
          }
        }
      } else {
        console.warn('⚠️ Channel not ready for broadcast, state:', channelRef.current?.state);
        // Channel should be ready, but if not, try to broadcast anyway or wait briefly
        const tryBroadcast = () => {
          if (channelRef.current && (channelRef.current.state === 'joined' || channelRef.current.state === 'SUBSCRIBED')) {
            try {
              channelRef.current.send({
                type: 'broadcast',
                event: 'user-joined',
                payload: {
                  userId,
                  userName,
                  userAvatar,
                  channelId,
                  timestamp: new Date().toISOString(),
                },
              });
              console.log('✅ Delayed broadcast: user-joined event for channel:', channelId);
            } catch (error) {
              console.error('❌ Error in delayed broadcast:', error);
              // Don't fail connection - continue anyway
            }
          }
        };
        
        // Try immediately if channel becomes ready (reduced delays for faster connection)
        setTimeout(tryBroadcast, 25); // Reduced from 50ms
        // Also try after a bit longer in case channel is still initializing
        setTimeout(tryBroadcast, 100); // Reduced from 200ms
      }
    } catch (error) {
      console.error('❌ Error in broadcast setup:', error);
      // Don't fail connection - continue anyway
    }

    // Connection is already marked as complete above (immediately after stream and channel ready)
    // This section is just for broadcasting presence and final cleanup
    console.log('✅ Successfully joined voice room:', channelId, 'Limit:', userLimit, 'Current participants:', actualParticipantCount);
    
    // Clear status message quickly (optimized)
    setTimeout(() => {
      setConnectionStatus('');
    }, 500); // Reduced to 500ms for faster UI cleanup
  }, [channelId, userId, userName, userAvatar, userLimit, participants.length, currentParticipantCountFromSidebar, initializeLocalStream, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate]);

  // Cleanup audio analysis
  useEffect(() => {
    return () => {
      if (speakingCheckIntervalRef.current) {
        clearInterval(speakingCheckIntervalRef.current);
      }
      
      // Cleanup remote analysers
      Object.values(remoteAnalysersRef.current).forEach(({ audioContext, interval }) => {
        if (interval) clearInterval(interval);
        if (audioContext) audioContext.close();
      });
      remoteAnalysersRef.current = {};
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Leave voice room
  // IMPORTANT: This function ensures users can only be in ONE voice channel at a time
  // When switching channels, this will leave the channel we're currently connected to
  const leaveRoom = useCallback(() => {
    if (!userId) {
      console.warn('Cannot leave room: missing userId');
      return;
    }
    
    // IMPORTANT: Use the previous channel ID if available (for channel switching)
    // Otherwise use the current channelId
    // This ensures we leave the correct channel when switching
    const channelToLeave = previousChannelIdRef.current || channelId;
    
    if (!channelToLeave) {
      console.warn('Cannot leave room: missing channelId');
      return;
    }
    
    console.log('🚪 Leaving voice room:', channelToLeave, 'for user:', userId, '(previousChannelId:', previousChannelIdRef.current, 'current channelId:', channelId, ')');
    
    // IMPORTANT: Broadcast leave event FIRST before cleanup
    // This ensures other users see the leave immediately
    // Make sure the channel is in 'joined' state before broadcasting
    if (channelRef.current) {
      const broadcastLeave = () => {
        try {
          if (channelRef.current && channelRef.current.state === 'joined') {
            // Use the channel ID we determined earlier (previous or current)
            const channelIdForBroadcast = previousChannelIdRef.current || channelId;
            channelRef.current.send({
              type: 'broadcast',
              event: 'user-left',
              payload: {
                userId,
                userName,
                channelId: channelIdForBroadcast,
                timestamp: new Date().toISOString(),
              },
            });
            console.log('✅ Broadcasted user-left event for channel:', channelIdForBroadcast, 'User:', userName);
          } else {
            console.warn('⚠️ Channel not in joined state, cannot broadcast leave. State:', channelRef.current?.state);
            // Retry after a short delay
            setTimeout(() => {
              if (channelRef.current && channelRef.current.state === 'joined') {
                try {
                  const channelIdForBroadcast = previousChannelIdRef.current || channelId;
                  channelRef.current.send({
                    type: 'broadcast',
                    event: 'user-left',
                    payload: {
                      userId,
                      userName,
                      channelId: channelIdForBroadcast,
                      timestamp: new Date().toISOString(),
                    },
                  });
                  console.log('✅ Retry: Broadcasted user-left event for channel:', channelIdForBroadcast);
                } catch (retryError) {
                  console.error('❌ Retry failed to broadcast user-left:', retryError);
                }
              }
            }, 100);
          }
        } catch (error) {
          console.error('❌ Error broadcasting user-left:', error);
          // Retry once
          setTimeout(() => {
            if (channelRef.current && channelRef.current.state === 'joined') {
              try {
                const channelIdForBroadcast = previousChannelIdRef.current || channelId;
                channelRef.current.send({
                  type: 'broadcast',
                  event: 'user-left',
                  payload: {
                    userId,
                    userName,
                    channelId: channelIdForBroadcast,
                    timestamp: new Date().toISOString(),
                  },
                });
                console.log('✅ Retry: Broadcasted user-left event for channel:', channelIdForBroadcast);
              } catch (retryError) {
                console.error('❌ Retry failed to broadcast user-left:', retryError);
              }
            }
          }, 200);
        }
      };
      
      // Broadcast immediately
      broadcastLeave();
    }
    
    // Close all peer connections
    Object.keys(peersRef.current).forEach(peerUserId => {
      const peer = peersRef.current[peerUserId];
      if (peer) {
        peer.close();
        console.log('Closed peer connection for', peerUserId);
      }
    });
    peersRef.current = {};

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped local track:', track.kind);
      });
      localStreamRef.current = null;
      setLocalStream(null);
    }

    // Stop screen share if active
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenShareStreamRef.current = null;
      setIsScreenSharing(false);
      setScreenShareStream(null);
    }

    // Unsubscribe and remove channel (leave broadcast was already sent at the beginning)
    if (channelRef.current) {
      // Unsubscribe and remove channel
      channelRef.current.unsubscribe().catch(err => {
        console.warn('Error unsubscribing from channel:', err);
      });
      supabase?.removeChannel(channelRef.current).catch(err => {
        console.warn('Error removing channel:', err);
      });
      channelRef.current = null;
    }

    // Clear all participants
    setParticipants([]);
    
    // Clear screen sharing users
    setScreenSharingUsers(new Map());
    
    // Clear speaking users
    setSpeakingUsers(new Set());
    
    // Clear remote analysers
    Object.values(remoteAnalysersRef.current).forEach(({ interval, audioContext }) => {
      if (interval) clearInterval(interval);
      if (audioContext) audioContext.close();
    });
    remoteAnalysersRef.current = {};
    
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionStatus('');
    setIsMuted(false);
    setIsDeafened(false);
    setRoomFullError(null);
    
    // Clear previous channel ID after leaving
    if (previousChannelIdRef.current === channelToLeave) {
      previousChannelIdRef.current = null;
    }
    
    console.log('Left voice room:', channelToLeave);
  }, [userId, channelId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  }, [isMuted]);

  // Toggle deafen
  const toggleDeafen = useCallback(() => {
    setIsDeafened(!isDeafened);
    // When deafened, also mute
    if (!isDeafened) {
      setIsMuted(true);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
    } else {
      setIsMuted(false);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
    }
  }, [isDeafened]);

  // Start screen sharing
  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor',
        },
        audio: false, // Screen share typically doesn't include audio
      });

      screenShareStreamRef.current = stream;
      setIsScreenSharing(true);
      setScreenShareStream(stream);

      // Add screen share track to all existing peer connections
      console.log('📺 Starting screen share, adding to', Object.keys(peersRef.current).length, 'peer connections');
      Object.keys(peersRef.current).forEach(targetUserId => {
        const peerConnection = peersRef.current[targetUserId];
        const connectionState = peerConnection?.connectionState;
        console.log('Checking peer connection for', targetUserId, 'State:', connectionState);
        
        if (peerConnection && (connectionState === 'connected' || connectionState === 'connecting' || connectionState === 'new')) {
          stream.getTracks().forEach(track => {
            try {
              console.log('Processing screen share track for', targetUserId, 'Track:', track.kind, 'Label:', track.label);
              
              // Check if track is already added
              const senders = peerConnection.getSenders();
              const hasTrack = senders.some(sender => sender.track === track);
              
              if (!hasTrack) {
                console.log('Adding screen share track to peer connection for', targetUserId);
                peerConnection.addTrack(track, stream);
                console.log('✅ Added screen share track to peer connection for', targetUserId);
                
                // Create and send new offer with screen share track
                // Use offerToReceiveVideo: true so remote peer knows we want to receive video
                peerConnection.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true }).then(offer => {
                  console.log('Created offer with screen share for', targetUserId, 'Offer:', offer.type);
                  return peerConnection.setLocalDescription(offer);
                }).then(() => {
                  console.log('Set local description, sending offer to', targetUserId);
                  const offerToSend = peerConnection.localDescription;
                  console.log('📤 Sending offer to', targetUserId, 'Offer type:', offerToSend?.type, 'SDP length:', offerToSend?.sdp?.length);
                  
                  supabase?.channel(`voice-room-${channelId}`).send({
                    type: 'broadcast',
                    event: 'offer',
                    payload: {
                      from: userId,
                      to: targetUserId,
                      offer: offerToSend,
                      channelId,
                    },
                  }).then(() => {
                    console.log('✅ Sent new offer with screen share to', targetUserId);
                  }).catch(err => {
                    console.error('❌ Error sending offer broadcast:', err);
                  });
                }).catch(err => {
                  console.error('❌ Error creating/sending offer with screen share:', err);
                });
              } else {
                console.log('Screen share track already added for', targetUserId);
              }
            } catch (error) {
              console.error('❌ Error adding screen share track:', error);
            }
          });
        } else {
          console.warn('⚠️ Peer connection for', targetUserId, 'not in valid state:', connectionState);
        }
      });

      // Broadcast screen share start
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'screen-share-started',
          payload: {
            userId,
            userName,
            channelId,
          },
        });
      }

      // Handle screen share end (when user stops sharing via browser UI)
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      console.log('Started screen sharing');
    } catch (error) {
      console.error('Error starting screen share:', error);
      if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') {
        alert('Could not start screen sharing. Please check permissions.');
      }
    }
  }, [userId, userName, channelId, supabase]);

  // Stop screen sharing
  const stopScreenShare = useCallback(() => {
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenShareStreamRef.current = null;
    }

    setIsScreenSharing(false);
    setScreenShareStream(null);

    // Remove screen share tracks from all peer connections
    Object.keys(peersRef.current).forEach(targetUserId => {
      const peerConnection = peersRef.current[targetUserId];
      if (peerConnection) {
        const senders = peerConnection.getSenders();
        senders.forEach(sender => {
          if (sender.track && sender.track.kind === 'video' && sender.track.label.includes('screen')) {
            peerConnection.removeTrack(sender);
          }
        });
      }
    });

    // Broadcast screen share stop
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'screen-share-stopped',
        payload: {
          userId,
          channelId,
        },
      });
    }

    console.log('Stopped screen sharing');
  }, [userId, channelId, supabase]);

  // Update speaking detection when mute state changes
  useEffect(() => {
    if (analyserRef.current && isConnected) {
      startSpeakingDetection();
    }
  }, [isMuted, isConnected, startSpeakingDetection]);

  // NOTE: Removed auto-disconnect on unmount
  // Users will stay connected even when the hook unmounts
  // They can only disconnect by explicitly calling leaveRoom() (e.g., pressing the red button)
  // This allows multi-tasking while staying in the voice room
  // The connection persists across navigation and component unmounts
  // 
  // If you need to cleanup on unmount, you can add it back, but it will disconnect users
  // when they navigate away, which is not desired for multi-tasking

  return {
    participants,
    isMuted,
    isDeafened,
    isConnected,
    isConnecting, // Export connecting state
    connectionStatus, // Export connection status message
    localStream,
    roomFullError,
    speakingUsers, // Export speaking users set
    isScreenSharing,
    screenShareStream,
    screenSharingUsers, // Map of userId -> stream for remote screen shares
    joinRoom,
    leaveRoom,
    toggleMute,
    toggleDeafen,
    startScreenShare,
    stopScreenShare,
  };
}

