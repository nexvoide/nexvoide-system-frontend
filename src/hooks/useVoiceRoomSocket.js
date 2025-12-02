/**
 * useVoiceRoom Hook - Socket.io Version
 * 
 * Production-ready voice room hook using Socket.io for signaling
 * Replaces Supabase Realtime with dedicated Socket.io server for sub-50ms signaling
 * 
 * Key Changes from Supabase version:
 * - Uses Socket.io for all signaling (offer/answer/ICE/joins/leaves)
 * - Server-authoritative room state
 * - Instant UI updates with optimistic rendering
 * - Proper reconnection handling
 * - Rate-limited speaking events
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { getSocket, onSocketEvent, offSocketEvent, emitSocketEvent, isSocketConnected } from '../lib/socket.js';

export function useVoiceRoomSocket(channelId, userId, userName, userAvatar, userLimit = null) {
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('');
  const [localStream, setLocalStream] = useState(null);
  const [roomFullError, setRoomFullError] = useState(null);
  const [speakingUsers, setSpeakingUsers] = useState(new Set());
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState(null);
  const [screenSharingUsers, setScreenSharingUsers] = useState(new Map());
  
  const peersRef = useRef({});
  const localStreamRef = useRef(null);
  const screenShareStreamRef = useRef(null);
  const socketRef = useRef(null);
  const previousChannelIdRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const speakingCheckIntervalRef = useRef(null);
  const remoteAnalysersRef = useRef({});
  const lastSpeakingStateRef = useRef(false); // For rate-limiting speaking events
  const roomStateReceivedRef = useRef(false);
  const participantsRef = useRef([]); // Keep ref to latest participants for screen share detection

  // Speaking detection (optimized with requestAnimationFrame)
  const startSpeakingDetection = useCallback(() => {
    if (speakingCheckIntervalRef.current) {
      cancelAnimationFrame(speakingCheckIntervalRef.current);
    }
    
    const checkSpeaking = () => {
      if (!analyserRef.current || isMuted) {
        const wasSpeaking = lastSpeakingStateRef.current;
        if (wasSpeaking) {
          lastSpeakingStateRef.current = false;
          setSpeakingUsers(prev => {
            const updated = new Set(prev);
            updated.delete(userId);
            return updated;
          });
          // Emit stop speaking
          if (socketRef.current && channelId) {
            emitSocketEvent('userSpeaking', { channelId, userId, isSpeaking: false });
          }
        }
        speakingCheckIntervalRef.current = requestAnimationFrame(checkSpeaking);
        return;
      }
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calculate RMS
      let sumSquares = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sumSquares += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sumSquares / dataArray.length);
      const threshold = 25;
      
      const isSpeaking = rms > threshold;
      const wasSpeaking = lastSpeakingStateRef.current;
      
      // Only emit on state change (rate-limiting)
      if (isSpeaking !== wasSpeaking) {
        lastSpeakingStateRef.current = isSpeaking;
        setSpeakingUsers(prev => {
          const updated = new Set(prev);
          if (isSpeaking) {
            updated.add(userId);
          } else {
            updated.delete(userId);
          }
          return updated;
        });
        
        // Emit to server only on state change
        if (socketRef.current && channelId) {
          emitSocketEvent('userSpeaking', { channelId, userId, isSpeaking });
        }
      }
      
      speakingCheckIntervalRef.current = requestAnimationFrame(checkSpeaking);
    };
    
    speakingCheckIntervalRef.current = requestAnimationFrame(checkSpeaking);
  }, [userId, isMuted, channelId]);

  // Setup remote audio analysis
  const setupRemoteAudioAnalysis = useCallback((targetUserId, stream) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      const checkInterval = setInterval(() => {
        if (!remoteAnalysersRef.current[targetUserId]) {
          clearInterval(checkInterval);
          if (audioContext) audioContext.close();
          return;
        }
        
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        
        let sumSquares = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sumSquares += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sumSquares / dataArray.length);
        const threshold = 25;
        
        setSpeakingUsers(prev => {
          const updated = new Set(prev);
          if (rms > threshold) {
            updated.add(targetUserId);
          } else {
            updated.delete(targetUserId);
          }
          return updated;
        });
      }, 100);
      
      remoteAnalysersRef.current[targetUserId] = { audioContext, interval: checkInterval };
    } catch (error) {
      console.warn('Could not set up remote audio analysis:', error);
    }
  }, []);

  // Initialize local microphone stream
  const initializeLocalStream = useCallback(async () => {
    if (localStreamRef.current && localStreamRef.current.active) {
      return localStreamRef.current;
    }

    try {
      console.log('🎤 Requesting microphone access...');
      setConnectionStatus('Requesting microphone access...');
      
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 48000,
        channelCount: 1,
      };
      
      if (navigator.userAgent.includes('Chrome')) {
        audioConstraints.googEchoCancellation = true;
        audioConstraints.googNoiseSuppression = true;
        audioConstraints.googAutoGainControl = true;
        audioConstraints.googHighpassFilter = true;
        audioConstraints.googTypingNoiseDetection = true;
        audioConstraints.googNoiseReduction = true;
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      
      console.log('✅ Microphone access granted');
      localStreamRef.current = stream;
      setLocalStream(stream);
      setConnectionStatus('Microphone ready, connecting to voice room...');
      
      // Setup audio analysis
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        const microphone = audioContext.createMediaStreamSource(stream);
        
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        microphone.connect(analyser);
        
        audioContextRef.current = audioContext;
        analyserRef.current = analyser;
        
        startSpeakingDetection();
        console.log('✅ Audio analysis set up');
      } catch (audioError) {
        console.warn('Could not set up audio analysis:', audioError);
      }
      
      return stream;
    } catch (error) {
      console.error('❌ Error accessing microphone:', error);
      let errorMessage = 'Could not access microphone. ';
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        errorMessage += 'Please allow microphone access in your browser settings.';
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        errorMessage += 'No microphone found. Please connect a microphone.';
      } else if (error.message && error.message.includes('timeout')) {
        errorMessage += 'Request timed out. Please try again.';
      } else {
        errorMessage += 'Please check permissions and try again.';
      }
      
      alert(errorMessage);
      setConnectionStatus(errorMessage);
      return null;
    }
  }, [startSpeakingDetection]);

  // Create peer connection
  const createPeerConnection = useCallback((targetUserId) => {
    console.log('Creating optimized peer connection for', targetUserId);
    const peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
        { urls: ['stun:stun2.l.google.com:19302', 'stun:stun3.l.google.com:19302'] },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.stunprotocol.org:3478' },
      ],
      iceCandidatePoolSize: 20,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      sdpSemantics: 'unified-plan',
    });

    // Add local audio track
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        if (track.kind === 'audio' && track.applyConstraints) {
          track.applyConstraints({
            latency: 0.01,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          }).catch(err => console.warn('Could not apply audio constraints:', err));
        }
        peerConnection.addTrack(track, localStreamRef.current);
      });
    }
    
    // Add screen share if available (for new connections)
    if (screenShareStreamRef.current) {
      console.log('📺 Adding existing screen share to new peer connection for', targetUserId);
      screenShareStreamRef.current.getTracks().forEach(track => {
        try {
          peerConnection.addTrack(track, screenShareStreamRef.current);
          console.log('✅ Added screen share track to new connection:', track.kind, track.id);
        } catch (err) {
          console.error('❌ Error adding screen share track to new connection:', err);
        }
      });
    }

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      const trackInfo = event.track ? {
        kind: event.track.kind,
        id: event.track.id,
        label: event.track.label,
        enabled: event.track.enabled,
        readyState: event.track.readyState,
        muted: event.track.muted
      } : 'null';
      
      console.log('🎬 ontrack event received from', targetUserId, '- Event:', {
        track: trackInfo,
        streams: event.streams ? event.streams.length : 0,
        streamIds: event.streams ? event.streams.map(s => s.id) : [],
        transceiver: event.transceiver ? {
          direction: event.transceiver.direction,
          mid: event.transceiver.mid,
          receiver: event.transceiver.receiver ? {
            track: event.transceiver.receiver.track ? {
              kind: event.transceiver.receiver.track.kind,
              id: event.transceiver.receiver.track.id
            } : 'null'
          } : 'null'
        } : 'null'
      });
      
      const track = event.track;
      let remoteStream = event.streams && event.streams.length > 0 ? event.streams[0] : null;
      
      if (!track) {
        console.warn('⚠️ ontrack event received but track is null');
        return;
      }
      
      console.log('📥 Processing track from', targetUserId, '- Kind:', track.kind, '- Label:', track.label, '- ID:', track.id, '- Enabled:', track.enabled, '- ReadyState:', track.readyState);
      
      if (track.kind === 'audio') {
        console.log('🎧 Remote audio track received from', targetUserId, '- Track ID:', track.id, '- Enabled:', track.enabled, '- Muted:', track.muted, '- ReadyState:', track.readyState);
        
        // If no stream in event, create one from the track
        if (!remoteStream) {
          console.log('⚠️ No stream in event, creating new MediaStream from track');
          remoteStream = new MediaStream([track]);
        } else {
          // Ensure the track is in the stream
          const streamTracks = remoteStream.getTracks();
          if (!streamTracks.includes(track)) {
            console.log('⚠️ Track not in stream, adding it');
            remoteStream.addTrack(track);
          }
        }
        
        console.log('🎧 Remote stream:', remoteStream ? `ID: ${remoteStream.id}, Tracks: ${remoteStream.getTracks().map(t => `${t.kind}:${t.id}`).join(', ')}` : 'null');
        
        // Ensure track is enabled
        track.enabled = true;
        
        // Note: track.muted is read-only, but we can check if it's muted
        if (track.muted) {
          console.warn('⚠️ Remote audio track is muted for', targetUserId, '- This means the remote user has their microphone muted');
          // Set up unmute listener to log when track becomes unmuted
          track.onunmute = () => {
            console.log('✅ Remote audio track unmuted for', targetUserId, '- Audio should now be audible');
          };
        } else {
          console.log('✅ Remote audio track is NOT muted for', targetUserId, '- Audio should be audible');
        }
        
        // Monitor track state changes
        track.onended = () => {
          console.warn('⚠️ Remote audio track ended for', targetUserId);
        };
        
        // Log track details for debugging
        console.log('🎧 Track details:', {
          id: track.id,
          kind: track.kind,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
          label: track.label,
          settings: track.getSettings ? track.getSettings() : 'N/A'
        });
        
        // Store stream reference to prevent garbage collection
        const streamId = remoteStream.id;
        
        setParticipants(prev => {
          const existing = prev.find(p => p.userId === targetUserId);
          if (existing) {
            // Only update if stream is different or doesn't exist
            if (existing.stream && existing.stream.id === remoteStream.id) {
              console.log('✅ Stream already set for', targetUserId, '- Skipping update');
              return prev;
            }
            // Update existing participant with stream - use functional update to ensure we get latest state
            const updated = prev.map(p => 
              p.userId === targetUserId 
                ? { ...p, stream: remoteStream }
                : p
            );
            console.log('✅ Updated existing participant with stream:', targetUserId, '- Stream ID:', remoteStream.id, '- Tracks:', remoteStream.getTracks().length);
            participantsRef.current = updated; // Update ref
            return updated;
          }
          // Add new participant with stream
          const newParticipant = { userId: targetUserId, stream: remoteStream };
          const updated = [...prev, newParticipant];
          console.log('✅ Added new participant with stream:', targetUserId, '- Stream ID:', remoteStream.id, '- Tracks:', remoteStream.getTracks().length);
          participantsRef.current = updated; // Update ref
          return updated;
        });
        
        setupRemoteAudioAnalysis(targetUserId, remoteStream);
        
        console.log('✅ Updated participants with audio stream from', targetUserId, '- Stream has', remoteStream.getTracks().length, 'tracks');
        
        // Verify stream is valid
        const verifyStream = () => {
          const tracks = remoteStream.getTracks();
          console.log('🔍 Stream verification for', targetUserId, '- Tracks:', tracks.length, tracks.map(t => ({
            id: t.id,
            kind: t.kind,
            enabled: t.enabled,
            muted: t.muted,
            readyState: t.readyState
          })));
        };
        setTimeout(verifyStream, 100);
      } else if (track.kind === 'video') {
        console.log('🎥 Video track received from', targetUserId, '- Label:', track.label, '- ID:', track.id, '- Enabled:', track.enabled, '- ReadyState:', track.readyState);
        
        // Screen share detection - More robust detection
        const trackLabel = track.label ? track.label.toLowerCase() : '';
        const trackSettings = track.getSettings ? track.getSettings() : {};
        
        console.log('🔍 Analyzing video track - Label:', trackLabel, '- Settings:', trackSettings);
        
        // Check if it's a camera/webcam (exclude these)
        const isCamera = trackLabel.includes('camera') || 
                        trackLabel.includes('webcam') ||
                        trackLabel.includes('front') ||
                        trackLabel.includes('back') ||
                        trackLabel.includes('facing') ||
                        (trackSettings.facingMode && trackSettings.facingMode !== 'unknown');
        
        // Check if user already has audio stream (participant) - if so, video is likely screen share
        // Use ref to get latest participants (more reliable than functional update for reading)
        const hasAudioStream = participantsRef.current.find(p => p.userId === targetUserId && p.stream) !== undefined;
        console.log('🔍 User has audio stream:', hasAudioStream, '- Is camera:', isCamera, '- Current participants count:', participantsRef.current.length);
        
        // Check if it's a screen share (include these)
        // CRITICAL: If user already has audio stream, ANY video track is screen share (not camera)
        const isScreenShare = !isCamera && (
          trackLabel.includes('screen') || 
          trackLabel.includes('display') || 
          trackLabel.includes('window') ||
          trackLabel.includes('desktop') ||
          trackLabel.includes('entire screen') ||
          trackLabel.includes('application') ||
          trackLabel.includes('monitor') ||
          // If user already has audio stream (participant), any new video track is likely screen share
          hasAudioStream ||
          // Fallback: If track label contains "screen" or "display" keywords, it's screen share
          (trackLabel && (trackLabel.includes('screen') || trackLabel.includes('display')))
        );
        
        console.log('🔍 Screen share detection result:', {
          isScreenShare,
          isCamera,
          hasAudioStream: !!hasAudioStream,
          trackLabel,
          hasScreenKeywords: trackLabel.includes('screen') || trackLabel.includes('display') || trackLabel.includes('window') || trackLabel.includes('desktop'),
          willDetectAsScreenShare: isScreenShare
        });
        
        // ALWAYS treat video tracks as screen share if user has audio stream (most reliable detection)
        if (isScreenShare || (hasAudioStream && !isCamera)) {
          if (!isScreenShare && hasAudioStream) {
            console.log('✅ Treating video track as screen share because user has audio stream');
          }
          console.log('✅ Screen share detected from', targetUserId, '- Track label:', track.label, '- Settings:', trackSettings);
          
          // Create or update screen share stream
          setScreenSharingUsers(prev => {
            const updated = new Map(prev);
            let screenShareStream = updated.get(targetUserId);
            
            if (!screenShareStream) {
              screenShareStream = new MediaStream();
              updated.set(targetUserId, screenShareStream);
              console.log('📺 Created new screen share stream for', targetUserId);
            }
            
            // Check if track is already in stream
            const existingTracks = screenShareStream.getTracks();
            const trackExists = existingTracks.some(t => t.id === track.id);
            
            if (!trackExists) {
              screenShareStream.addTrack(track);
              console.log('✅ Added screen share track to stream for', targetUserId, '- Stream now has', screenShareStream.getTracks().length, 'tracks');
              
              // Monitor track state
              track.onended = () => {
                console.warn('⚠️ Screen share track ended for', targetUserId);
                setScreenSharingUsers(prev => {
                  const updated = new Map(prev);
                  updated.delete(targetUserId);
                  return updated;
                });
              };
              
              track.onmute = () => {
                console.warn('⚠️ Screen share track muted for', targetUserId);
              };
              
              track.onunmute = () => {
                console.log('✅ Screen share track unmuted for', targetUserId);
              };
            } else {
              console.log('⚠️ Screen share track already in stream for', targetUserId);
            }
            
            return updated;
          });
        } else {
          console.log('⚠️ Video track from', targetUserId, 'is NOT a screen share - Label:', track.label, '- Is camera:', isCamera);
        }
      }
    };

    // ICE candidate handling
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && socketRef.current && channelId) {
        emitSocketEvent('signalIceCandidate', {
          toUserId: targetUserId,
          fromUserId: userId,
          channelId,
          candidate: event.candidate
        });
      }
    };

    // Connection state monitoring
    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      console.log('🔗 Peer connection state for', targetUserId, ':', state);
      if (state === 'connected') {
        console.log('🎉 Peer connection CONNECTED with', targetUserId);
      } else if (state === 'failed') {
        console.error('❌ Peer connection failed for', targetUserId);
      } else if (state === 'disconnected') {
        console.warn('⚠️ Peer connection disconnected from', targetUserId);
      }
    };
    
    // ICE connection state monitoring
    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      console.log('🧊 ICE connection state for', targetUserId, ':', iceState);
      if (iceState === 'connected' || iceState === 'completed') {
        console.log('✅ ICE connection established with', targetUserId);
      } else if (iceState === 'failed') {
        console.error('❌ ICE connection failed for', targetUserId);
      }
    };

    return peerConnection;
  }, [channelId, userId, setupRemoteAudioAnalysis]);

  // Handle offer
  const handleOffer = useCallback(async (fromUserId, offer) => {
    if (fromUserId === userId) return;
    
    console.log('📥 Handling offer from', fromUserId, '- Local stream ready:', !!localStreamRef.current);
    
    let peerConnection = peersRef.current[fromUserId];
    
    // Check if this is a renegotiation offer (for screen share or other media changes)
    // Renegotiation offers can come even when connection is stable
    const isRenegotiation = peerConnection && 
                            peerConnection.signalingState === 'stable' && 
                            peerConnection.connectionState === 'connected';
    
    if (isRenegotiation) {
      console.log('🔄 Renegotiation offer received from', fromUserId, '- This is likely for screen share or media change');
      // Allow renegotiation - don't return early
    } else if (peerConnection) {
      const currentState = peerConnection.connectionState;
      const signalingState = peerConnection.signalingState;
      
      // If in connecting state, check signaling state
      if (currentState === 'connecting' || signalingState === 'have-local-offer' || signalingState === 'have-remote-offer') {
        console.log('⏳ Connection in progress for', fromUserId, '- State:', currentState, '- Signaling:', signalingState);
        
        // If we have a local offer but no remote description yet, we can still handle the incoming offer
        // This handles the case where both users try to connect simultaneously
        if (signalingState === 'have-local-offer' && !peerConnection.remoteDescription) {
          console.log('🔄 We have local offer but no remote description - can handle incoming offer');
          // Continue to handle the offer
        } else if (signalingState === 'have-remote-offer') {
          // We're already handling an offer, ignore this one (unless it's a renegotiation)
          console.log('⚠️ Already handling an offer from', fromUserId, '- Ignoring duplicate');
          return;
        }
      }
      
      // If connection failed or closed, recreate it
      if (currentState === 'failed' || currentState === 'closed' || currentState === 'disconnected') {
        console.log('🔄 Recreating connection for', fromUserId, '- Previous state:', currentState);
        peerConnection.close();
        delete peersRef.current[fromUserId];
        peerConnection = null;
      }
    }
    
    if (!peerConnection) {
      console.log('📥 Creating new peer connection for offer from', fromUserId);
      peerConnection = createPeerConnection(fromUserId);
      peersRef.current[fromUserId] = peerConnection;
    }
    
    try {
      // Check signaling state before setting remote description
      const currentSignalingState = peerConnection.signalingState;
      const isRenegotiation = currentSignalingState === 'stable' && 
                              peerConnection.connectionState === 'connected';
      
      // For renegotiation, we need to update the remote description even if we already have one
      if (isRenegotiation) {
        console.log('🔄 Renegotiation detected - Updating remote description for screen share/media change');
        // For renegotiation, we can set the new remote description
      } else if (currentSignalingState === 'stable' && peerConnection.remoteDescription) {
        console.log('⚠️ Already have remote description for', fromUserId, '- Ignoring duplicate offer');
        return;
      }
      
      // If we already have a local offer and it's NOT a renegotiation, we're the offerer - don't handle this offer
      if (currentSignalingState === 'have-local-offer' && peerConnection.localDescription && !isRenegotiation) {
        console.log('⚠️ We are the offerer for', fromUserId, '- Ignoring incoming offer');
        return;
      }
      
      // For renegotiation, check if offer contains video
      if (isRenegotiation) {
        const offerHasVideo = offer.sdp && offer.sdp.includes('m=video');
        console.log('🔄 Renegotiation offer analysis:', {
          hasVideo: offerHasVideo,
          sdpLength: offer.sdp?.length,
          videoLines: offer.sdp ? offer.sdp.split('\n').filter(l => l.includes('m=video') || l.includes('video')).slice(0, 5) : []
        });
      }
      
      console.log('📥 Setting remote description (offer) from', fromUserId, '- Current signaling:', currentSignalingState, '- Is renegotiation:', isRenegotiation);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      // After setting remote description, check if video tracks are expected
      if (isRenegotiation) {
        console.log('🔄 After setting renegotiation offer, connection state:', peerConnection.connectionState, '- Signaling:', peerConnection.signalingState);
        // The video track should arrive via ontrack event after answer is created
      }
      
      // Process any queued ICE candidates
      if (peerConnection.pendingIceCandidates && peerConnection.pendingIceCandidates.length > 0) {
        console.log('📥 Processing', peerConnection.pendingIceCandidates.length, 'queued ICE candidates for', fromUserId);
        const candidates = peerConnection.pendingIceCandidates;
        peerConnection.pendingIceCandidates = [];
        for (const candidate of candidates) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('⚠️ Error adding queued ICE candidate:', err);
          }
        }
      }
      
      // For renegotiation, we need to create a new answer even if we have a local description
      if (peerConnection.localDescription && !isRenegotiation) {
        console.log('⚠️ Already have local description for', fromUserId, '- Skipping answer creation');
        return;
      }
      
      if (isRenegotiation) {
        console.log('🔄 Creating renegotiation answer for', fromUserId, '- This is for screen share or media change');
      } else {
        console.log('📥 Creating answer for', fromUserId);
      }
      
      // Check if the offer contains video (from SDP)
      const offerHasVideo = offer.sdp && offer.sdp.includes('m=video');
      console.log('🔍 Offer contains video:', offerHasVideo, '- Will create answer with video support');
      
      const answer = await peerConnection.createAnswer({ 
        offerToReceiveAudio: true, 
        offerToReceiveVideo: true,  // CRITICAL: Always request video to receive screen shares
        voiceActivityDetection: true,
      });
      
      // Log answer SDP to verify video is requested
      const answerHasVideo = answer.sdp && answer.sdp.includes('m=video');
      console.log('📋 Answer SDP analysis:', {
        hasVideo: answerHasVideo,
        sdpLength: answer.sdp?.length,
        offerHadVideo: offerHasVideo
      });
      
      if (!answerHasVideo && offerHasVideo) {
        console.error('❌ WARNING: Offer had video but answer does not!');
      }
      
      // Don't modify SDP - it can cause parsing errors
      // The browser generates valid SDP, use it as-is
      await peerConnection.setLocalDescription(answer);
      
      // Send answer via Socket.io
      console.log('📤 Sending answer to', fromUserId);
      emitSocketEvent('signalAnswer', {
        toUserId: fromUserId,
        fromUserId: userId,
        channelId,
        answer: peerConnection.localDescription
      });
      
      console.log('✅ Sent answer to', fromUserId, '- Connection state:', peerConnection.connectionState, '- Signaling state:', peerConnection.signalingState);
    } catch (error) {
      console.error('❌ Error handling offer from', fromUserId, ':', error);
      // If InvalidStateError, the connection is already in the right state - just log it
      if (error.name === 'InvalidStateError') {
        console.log('⚠️ InvalidStateError - Connection already in correct state, ignoring');
        return;
      }
      // For other errors, close the connection and let it retry
      if (peerConnection) {
        peerConnection.close();
        delete peersRef.current[fromUserId];
      }
    }
  }, [channelId, userId, createPeerConnection, emitSocketEvent]);

  // Handle answer
  const handleAnswer = useCallback(async (fromUserId, answer) => {
    console.log('📥 Handling answer from', fromUserId);
    const peerConnection = peersRef.current[fromUserId];
    if (!peerConnection) {
      console.warn('⚠️ No peer connection found for answer from', fromUserId);
      return;
    }
    
    try {
      // Check signaling state before setting remote description
      const currentSignalingState = peerConnection.signalingState;
      if (currentSignalingState === 'stable' && peerConnection.remoteDescription) {
        console.log('⚠️ Already have remote description for', fromUserId, '- Ignoring duplicate answer');
        return;
      }
      
      // Only set remote description if we're in the right state
      if (currentSignalingState !== 'have-local-offer') {
        console.log('⚠️ Not in correct signaling state for answer from', fromUserId, '- Current:', currentSignalingState, '- Ignoring');
        return;
      }
      
      console.log('📥 Setting remote answer for', fromUserId, '- Current signaling:', currentSignalingState);
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
      console.log('✅ Set remote answer for', fromUserId, '- Connection state:', peerConnection.connectionState, '- Signaling state:', peerConnection.signalingState);
      
      // Process any queued ICE candidates
      if (peerConnection.pendingIceCandidates && peerConnection.pendingIceCandidates.length > 0) {
        console.log('📥 Processing', peerConnection.pendingIceCandidates.length, 'queued ICE candidates for', fromUserId);
        const candidates = peerConnection.pendingIceCandidates;
        peerConnection.pendingIceCandidates = [];
        for (const candidate of candidates) {
          try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.warn('⚠️ Error adding queued ICE candidate:', err);
          }
        }
      }
      
      // Check if connection is established
      if (peerConnection.connectionState === 'connected') {
        console.log('🎉 Peer connection CONNECTED with', fromUserId);
      }
    } catch (error) {
      // If InvalidStateError, the connection is already in the right state - just log it
      if (error.name === 'InvalidStateError') {
        console.log('⚠️ InvalidStateError - Connection already in correct state, ignoring');
        return;
      }
      console.error('❌ Error setting remote answer:', error);
    }
  }, []);

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (fromUserId, candidate) => {
    const peerConnection = peersRef.current[fromUserId];
    if (!peerConnection) {
      console.warn('⚠️ No peer connection for ICE candidate from', fromUserId);
      return;
    }
    
    try {
      // Check if remote description is set - ICE candidates can only be added after remote description
      if (!peerConnection.remoteDescription) {
        console.log('⏳ Queuing ICE candidate for', fromUserId, '- Waiting for remote description');
        // Queue the candidate to be added later
        if (!peerConnection.pendingIceCandidates) {
          peerConnection.pendingIceCandidates = [];
        }
        peerConnection.pendingIceCandidates.push(candidate);
        return;
      }
      
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('✅ Added ICE candidate from', fromUserId);
    } catch (error) {
      // If error is InvalidStateError, queue the candidate
      if (error.name === 'InvalidStateError' && !peerConnection.remoteDescription) {
        console.log('⏳ Queuing ICE candidate (InvalidStateError) for', fromUserId);
        if (!peerConnection.pendingIceCandidates) {
          peerConnection.pendingIceCandidates = [];
        }
        peerConnection.pendingIceCandidates.push(candidate);
      } else {
        console.warn('⚠️ Error adding ICE candidate from', fromUserId, ':', error.name, error.message);
      }
    }
  }, []);

  // Join voice room
  const joinRoom = useCallback(async () => {
    if (!channelId || !userId) {
      console.log('❌ Cannot join - missing channelId or userId');
      return;
    }
    
    // Check room capacity (optimistic - server will verify)
    if (userLimit && userLimit > 0) {
      const currentCount = participants.length;
      if (currentCount >= userLimit) {
        const errorMsg = `Room is full! Maximum ${userLimit} users allowed.`;
        setRoomFullError(errorMsg);
        alert(errorMsg);
        return;
      }
    }
    
    setIsConnecting(true);
    setConnectionStatus('Starting connection...');
    setRoomFullError(null);
    roomStateReceivedRef.current = false;
    
    try {
      // Parallel: Get stream and connect socket
      const [stream, socket] = await Promise.all([
        initializeLocalStream(),
        getSocket()
      ]);
      
      if (!stream) {
        setIsConnecting(false);
        setConnectionStatus('Failed to access microphone');
        return;
      }
      
      socketRef.current = socket;
      
      // Setup socket event listeners
      const setupSocketListeners = () => {
        // Room state (authoritative)
        onSocketEvent('roomState', (roomState) => {
          if (roomState.channelId !== channelId) return;
          
          console.log('📋 Received authoritative room state:', roomState);
          roomStateReceivedRef.current = true;
          
          // Update participants from server state
          setParticipants(prev => {
            // CRITICAL: Always preserve existing streams when merging!
            // Create a deep map to preserve stream references
            const existingMap = new Map();
            prev.forEach(p => {
              existingMap.set(p.userId, {
                userId: p.userId,
                user: p.user,
                stream: p.stream // Preserve stream reference
              });
            });
            
            const serverParticipantIds = new Set(roomState.participants.filter(p => p.userId !== userId).map(p => p.userId));
            
            // Count streams before merge
            const streamsBefore = prev.filter(p => p.stream).length;
            
            // Merge with existing to preserve streams - CRITICAL: Don't lose streams!
            const serverParticipants = roomState.participants
              .filter(p => p.userId !== userId) // Exclude self
              .map(p => {
                const existing = existingMap.get(p.userId);
                // CRITICAL: Always preserve existing stream if it exists
                // Verify stream is valid before preserving
                if (existing && existing.stream) {
                  try {
                    // Check if stream is still valid
                    const tracks = existing.stream.getTracks();
                    console.log('📋 Preserving stream for', p.userId, '- Stream ID:', existing.stream.id, '- Tracks:', tracks.length);
                    return {
                      userId: p.userId,
                      user: p.user || existing.user, // Preserve user info too
                      stream: existing.stream // Preserve the stream reference!
                    };
                  } catch (e) {
                    console.warn('⚠️ Stream invalid for', p.userId, '- Error:', e.message);
                    // Stream is invalid, create participant without stream
                    return {
                      userId: p.userId,
                      user: p.user,
                      stream: null
                    };
                  }
                }
                
                // No existing stream, create participant without stream (will be added when track arrives)
                return {
                  userId: p.userId,
                  user: p.user,
                  stream: null
                };
              });
            
            // Also preserve participants that left the server but still have streams (might be temporary)
            const preservedFromPrev = prev.filter(p => {
              if (!p.stream) return false;
              if (serverParticipantIds.has(p.userId)) return false; // Already in server list
              // Verify stream is still valid
              try {
                p.stream.getTracks();
                return true;
              } catch {
                return false;
              }
            });
            
            const allParticipants = [...serverParticipants, ...preservedFromPrev];
            const preservedCount = allParticipants.filter(p => p.stream).length;
            
            console.log('📋 Merged participants from roomState - Preserved', 
              preservedCount, 
              'streams out of', 
              allParticipants.length, 
              'participants (had', streamsBefore, 'before merge)');
            
            participantsRef.current = allParticipants; // Update ref
            
            // CRITICAL: If we lost streams, don't update - keep existing state
            if (streamsBefore > 0 && preservedCount < streamsBefore) {
              console.error('❌ STREAM LOSS DETECTED! Had', streamsBefore, 'streams, now have', preservedCount, '- KEEPING EXISTING STATE');
              // Don't update - keep the existing participants with streams
              return prev;
            }
            
            return allParticipants;
          });
          
          // Create offers for existing participants
          // IMPORTANT: Only create offers if we don't already have a connection
          // This prevents duplicate connections when roomState is received multiple times
          const existingParticipants = roomState.participants.filter(p => p.userId !== userId);
          console.log('📤 Creating offers for', existingParticipants.length, 'existing participants');
          
          existingParticipants.forEach(participant => {
            // Check if we already have a peer connection
            if (peersRef.current[participant.userId]) {
              const peer = peersRef.current[participant.userId];
              const connectionState = peer.connectionState;
              const signalingState = peer.signalingState;
              
              // If already connected or in stable signaling with remote description, skip
              if ((connectionState === 'connected' && signalingState === 'stable') ||
                  (signalingState === 'stable' && peer.remoteDescription)) {
                console.log('✅ Peer connection already established for', participant.userId, '- State:', connectionState, '- Signaling:', signalingState);
                return;
              }
              
              // If connecting or have active signaling, skip
              if (connectionState === 'connecting' || 
                  signalingState === 'have-local-offer' || 
                  signalingState === 'have-remote-offer') {
                console.log('⏳ Connection in progress for', participant.userId, '- State:', connectionState, '- Signaling:', signalingState);
                return;
              }
              
              // If connection failed or closed, recreate it
              if (connectionState === 'failed' || connectionState === 'closed' || connectionState === 'disconnected') {
                console.log('🔄 Reconnecting to', participant.userId, '- Previous state:', connectionState);
                peer.close();
                delete peersRef.current[participant.userId];
              } else {
                // Connection exists and is in a valid state, don't create duplicate
                console.log('⚠️ Peer connection exists for', participant.userId, '- State:', connectionState, '- Signaling:', signalingState, '- Skipping duplicate offer');
                return;
              }
            }
            
            // Create new offer only if we don't have a connection
            console.log('📤 Creating offer for existing participant:', participant.userId);
            createOfferForUser(participant.userId);
          });
        });
        
        // User joined
        onSocketEvent('userJoined', ({ channelId: eventChannelId, user, userId: joinedUserId }) => {
          if (eventChannelId !== channelId || joinedUserId === userId) return;
          
          console.log('👤 User joined:', joinedUserId, '- Local stream ready:', !!localStreamRef.current);
          
          setParticipants(prev => {
            if (prev.find(p => p.userId === joinedUserId)) {
              console.log('⚠️ Participant already exists, skipping add');
              return prev;
            }
            const updated = [...prev, { userId: joinedUserId, user, stream: null }];
            participantsRef.current = updated; // Update ref
            return updated;
          });
          
          // Create offer for new user
          // IMPORTANT: Only create offer if we don't already have a connection
          if (peersRef.current[joinedUserId]) {
            const peer = peersRef.current[joinedUserId];
            const connectionState = peer.connectionState;
            const signalingState = peer.signalingState;
            
            // If already connected or in stable signaling, skip
            if ((connectionState === 'connected' && signalingState === 'stable') ||
                (signalingState === 'stable' && peer.remoteDescription)) {
              console.log('✅ Already connected to', joinedUserId, '- Skipping offer creation');
              return;
            }
            
            // If connecting or have active signaling, skip
            if (connectionState === 'connecting' || 
                signalingState === 'have-local-offer' || 
                signalingState === 'have-remote-offer') {
              console.log('⏳ Connection in progress for', joinedUserId, '- Skipping offer creation');
              return;
            }
            
            // If connection failed, close it and create a new one
            if (connectionState === 'failed' || connectionState === 'closed' || connectionState === 'disconnected') {
              console.log('🔄 Reconnecting to newly joined user:', joinedUserId);
              peer.close();
              delete peersRef.current[joinedUserId];
            } else {
              // Connection exists and is in a valid state, don't create duplicate
              console.log('⚠️ Peer connection exists for', joinedUserId, '- Skipping duplicate offer');
              return;
            }
          }
          
          console.log('📤 Creating offer for newly joined user:', joinedUserId);
          createOfferForUser(joinedUserId);
        });
        
        // User left
        onSocketEvent('userLeft', ({ channelId: eventChannelId, userId: leftUserId }) => {
          if (eventChannelId !== channelId) return;
          
          console.log('👋 User left:', leftUserId);
          
          // Close peer connection
          if (peersRef.current[leftUserId]) {
            peersRef.current[leftUserId].close();
            delete peersRef.current[leftUserId];
          }
          
          // Remove from participants
          setParticipants(prev => {
            const updated = prev.filter(p => p.userId !== leftUserId);
            participantsRef.current = updated; // Update ref
            return updated;
          });
          
          // Remove from screen sharing
          setScreenSharingUsers(prev => {
            const updated = new Map(prev);
            updated.delete(leftUserId);
            return updated;
          });
          
          // Cleanup audio analysis
          if (remoteAnalysersRef.current[leftUserId]) {
            const { audioContext, interval } = remoteAnalysersRef.current[leftUserId];
            if (interval) clearInterval(interval);
            if (audioContext) audioContext.close();
            delete remoteAnalysersRef.current[leftUserId];
          }
        });
        
        // WebRTC signaling
        onSocketEvent('offer', ({ fromUserId, toUserId, channelId: eventChannelId, offer }) => {
          if (eventChannelId !== channelId || toUserId !== userId) return;
          handleOffer(fromUserId, offer);
        });
        
        onSocketEvent('answer', ({ fromUserId, toUserId, channelId: eventChannelId, answer }) => {
          if (eventChannelId !== channelId || toUserId !== userId) return;
          handleAnswer(fromUserId, answer);
        });
        
        onSocketEvent('iceCandidate', ({ fromUserId, toUserId, channelId: eventChannelId, candidate }) => {
          if (eventChannelId !== channelId || toUserId !== userId) return;
          handleIceCandidate(fromUserId, candidate);
        });
        
        // Mute/Deafen updates
        onSocketEvent('muteUpdate', ({ channelId: eventChannelId, userId: targetUserId, isMuted: remoteMuted }) => {
          if (eventChannelId !== channelId || targetUserId === userId) return;
          // Update participant mute state if needed
        });
        
        onSocketEvent('deafenUpdate', ({ channelId: eventChannelId, userId: targetUserId, isDeafened: remoteDeafened }) => {
          if (eventChannelId !== channelId || targetUserId === userId) return;
          // Update participant deafen state if needed
        });
        
        // Screen share
        onSocketEvent('screenShareStarted', ({ channelId: eventChannelId, userId: sharingUserId }) => {
          if (eventChannelId !== channelId) return;
          // Screen share will be handled via video track in ontrack
        });
        
        onSocketEvent('screenShareStopped', ({ channelId: eventChannelId, userId: sharingUserId }) => {
          if (eventChannelId !== channelId) return;
          setScreenSharingUsers(prev => {
            const updated = new Map(prev);
            updated.delete(sharingUserId);
            return updated;
          });
        });
        
        // Speaking updates
        onSocketEvent('speakingUpdate', ({ channelId: eventChannelId, userId: speakingUserId, isSpeaking }) => {
          if (eventChannelId !== channelId || speakingUserId === userId) return;
          setSpeakingUsers(prev => {
            const updated = new Set(prev);
            if (isSpeaking) {
              updated.add(speakingUserId);
            } else {
              updated.delete(speakingUserId);
            }
            return updated;
          });
        });
        
        // Error handling
        onSocketEvent('error', ({ code, message, channelId: errorChannelId }) => {
          if (errorChannelId && errorChannelId !== channelId) return;
          
          console.error('Socket error:', code, message);
          
          if (code === 'ROOM_FULL') {
            setRoomFullError(message);
            alert(message);
            setIsConnecting(false);
            setIsConnected(false);
          } else if (code === 'NOT_AUTHENTICATED') {
            console.error('Authentication failed');
          }
        });
      };
      
      setupSocketListeners();
      
      // Emit join to server
      emitSocketEvent('joinVoiceChannel', {
        channelId,
        user: {
          id: userId,
          name: userName,
          avatar: userAvatar
        },
        maxUsers: userLimit
      });
      
      // Mark as connected immediately (optimistic)
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionStatus('Connected');
      
      console.log('✅ Joined voice room:', channelId);
      
    } catch (error) {
      console.error('❌ Error joining room:', error);
      setIsConnecting(false);
      setIsConnected(false);
      setConnectionStatus('Connection failed');
    }
  }, [channelId, userId, userName, userAvatar, userLimit, participants.length, initializeLocalStream, createPeerConnection, handleOffer, handleAnswer, handleIceCandidate]);
  
  // Helper: Create offer for a user
  const createOfferForUser = useCallback((targetUserId) => {
    if (peersRef.current[targetUserId]) {
      console.log('Peer connection already exists for', targetUserId);
      return;
    }
    
    // Ensure local stream is ready before creating peer connection
    if (!localStreamRef.current) {
      console.warn('⚠️ Local stream not ready yet, waiting...');
      // Wait longer and retry multiple times
      let retries = 0;
      const maxRetries = 10;
      const checkStream = () => {
        if (localStreamRef.current) {
          console.log('✅ Local stream ready after', retries, 'retries');
          createOfferForUser(targetUserId);
        } else if (retries < maxRetries) {
          retries++;
          setTimeout(checkStream, 200);
        } else {
          console.error('❌ Local stream never became ready after', maxRetries, 'retries');
        }
      };
      setTimeout(checkStream, 200);
      return;
    }
    
    console.log('🎤 Creating offer for', targetUserId, '- Local stream tracks:', localStreamRef.current.getTracks().map(t => `${t.kind}:${t.id}`));
    
    const peerConnection = createPeerConnection(targetUserId);
    peersRef.current[targetUserId] = peerConnection;
    
    // Verify local audio track was added
    const senders = peerConnection.getSenders();
    const hasAudioSender = senders.some(s => s.track && s.track.kind === 'audio');
    console.log('🎤 Peer connection senders:', senders.map(s => s.track ? `${s.track.kind}:${s.track.id}` : 'null'), '- Has audio:', hasAudioSender);
    
    // Add screen share if available (for new connections)
    if (screenShareStreamRef.current) {
      console.log('📺 Adding existing screen share to new peer connection for', targetUserId);
      screenShareStreamRef.current.getTracks().forEach(track => {
        try {
          peerConnection.addTrack(track, screenShareStreamRef.current);
          console.log('✅ Added screen share track to new connection:', track.kind, track.id);
        } catch (err) {
          console.error('❌ Error adding screen share track to new connection:', err);
        }
      });
    }
    
    peerConnection.createOffer({ 
      offerToReceiveAudio: true, 
      offerToReceiveVideo: true,
      voiceActivityDetection: true,
    })
      .then(offer => {
        // Don't modify SDP - it can cause parsing errors
        // The browser generates valid SDP, use it as-is
        return peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        emitSocketEvent('signalOffer', {
          toUserId: targetUserId,
          fromUserId: userId,
          channelId,
          offer: peerConnection.localDescription
        });
        console.log('✅ Sent offer to', targetUserId);
      })
      .catch(error => {
        console.error('Error creating offer:', error);
      });
  }, [channelId, userId, createPeerConnection, emitSocketEvent]);

  // Leave room
  const leaveRoom = useCallback(() => {
    if (!channelId || !userId) return;
    
    console.log('🚪 Leaving voice room:', channelId);
    
    // Emit leave to server
    if (socketRef.current) {
      emitSocketEvent('leaveVoiceChannel', { channelId, userId });
    }
    
    // Close all peer connections
    Object.values(peersRef.current).forEach(peer => peer.close());
    peersRef.current = {};
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Stop screen share
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current = null;
    }
    
    // Cleanup
    setParticipants([]);
    participantsRef.current = []; // Clear ref
    setScreenSharingUsers(new Map());
    setSpeakingUsers(new Set());
    setIsConnected(false);
    setIsConnecting(false);
    setConnectionStatus('');
    setLocalStream(null);
    roomStateReceivedRef.current = false;
    
    // Cleanup audio analysis
    if (speakingCheckIntervalRef.current) {
      cancelAnimationFrame(speakingCheckIntervalRef.current);
    }
    Object.values(remoteAnalysersRef.current).forEach(({ audioContext, interval }) => {
      if (interval) clearInterval(interval);
      if (audioContext) audioContext.close();
    });
    remoteAnalysersRef.current = {};
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [channelId, userId]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMuted;
      });
    }
    
    if (socketRef.current && channelId) {
      emitSocketEvent('toggleMute', { channelId, userId, isMuted: newMuted });
    }
  }, [isMuted, channelId, userId]);

  // Toggle deafen
  const toggleDeafen = useCallback(() => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    
    if (newDeafened) {
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
    
    if (socketRef.current && channelId) {
      emitSocketEvent('toggleDeafen', { channelId, userId, isDeafened: newDeafened });
    }
  }, [isDeafened, channelId, userId]);

  // Start screen share
  const startScreenShare = useCallback(async () => {
    try {
      console.log('🎬 Starting screen share...');
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          cursor: 'always', 
          displaySurface: 'monitor',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: true
      });
      
      console.log('✅ Screen share stream obtained - Tracks:', stream.getTracks().length, stream.getTracks().map(t => `${t.kind}:${t.id} (${t.label})`));
      
      screenShareStreamRef.current = stream;
      setIsScreenSharing(true);
      setScreenShareStream(stream);
      
      // Add track to all existing peer connections
      const peerEntries = Object.entries(peersRef.current);
      console.log('📤 Adding screen share to', peerEntries.length, 'peer connections');
      
      for (const [targetUserId, peer] of peerEntries) {
        const connectionState = peer.connectionState;
        const signalingState = peer.signalingState;
        
        // Only add to active connections
        if (connectionState === 'connected' || connectionState === 'connecting' || connectionState === 'new') {
          console.log('📤 Adding screen share track to peer connection for', targetUserId, '- State:', connectionState, '- Signaling:', signalingState);
          
          // Add all tracks from screen share stream
          stream.getTracks().forEach(track => {
            try {
              // Check if track is already added
              const senders = peer.getSenders();
              const hasTrack = senders.some(sender => sender.track && sender.track.id === track.id);
              
              if (!hasTrack) {
                console.log('➕ Adding screen share track:', track.kind, track.id, track.label);
                peer.addTrack(track, stream);
              } else {
                console.log('⚠️ Screen share track already added for', targetUserId);
              }
            } catch (err) {
              console.error('❌ Error adding screen share track to', targetUserId, ':', err);
            }
          });
          
          // Renegotiate - create new offer with video
          try {
            // Verify track was added before creating offer
            const sendersAfterAdd = peer.getSenders();
            const videoSenders = sendersAfterAdd.filter(s => s.track && s.track.kind === 'video');
            console.log('🔍 Senders after adding screen share:', {
              total: sendersAfterAdd.length,
              video: videoSenders.length,
              videoTracks: videoSenders.map(s => ({ id: s.track.id, label: s.track.label, enabled: s.track.enabled }))
            });
            
            if (videoSenders.length === 0) {
              console.error('❌ No video senders found after adding screen share track!');
            }
            
            console.log('🔄 Creating offer for screen share renegotiation with', targetUserId);
            const offer = await peer.createOffer({ 
              offerToReceiveAudio: true, 
              offerToReceiveVideo: true 
            });
            
            // Log SDP to verify video track is included
            const sdpHasVideo = offer.sdp && offer.sdp.includes('m=video');
            console.log('📋 Offer SDP analysis:', {
              hasVideo: sdpHasVideo,
              sdpLength: offer.sdp?.length,
              videoLines: offer.sdp ? offer.sdp.split('\n').filter(l => l.includes('m=video') || l.includes('video')).slice(0, 5) : []
            });
            
            if (!sdpHasVideo) {
              console.error('❌ WARNING: Offer SDP does not contain video!');
            }
            
            // Don't modify SDP - use as-is
            await peer.setLocalDescription(offer);
            
            console.log('📤 Sending screen share offer to', targetUserId, '- Offer type:', offer.type, '- Has video in SDP:', sdpHasVideo);
            emitSocketEvent('signalOffer', {
              toUserId: targetUserId,
              fromUserId: userId,
              channelId,
              offer: peer.localDescription
            });
            
            console.log('✅ Screen share offer sent to', targetUserId);
          } catch (err) {
            console.error('❌ Error renegotiating for screen share with', targetUserId, ':', err);
          }
        } else {
          console.warn('⚠️ Skipping screen share for', targetUserId, '- Connection state:', connectionState);
        }
      }
      
      // Also add screen share to new connections that will be created
      // This is handled in createPeerConnection where it checks screenShareStreamRef.current
      
      // Broadcast screen share start
      if (socketRef.current && channelId) {
        console.log('📢 Broadcasting screen share start event');
        emitSocketEvent('screenShareStart', { channelId, userId });
      }
      
      // Handle stop sharing
      stream.getVideoTracks()[0].onended = () => {
        console.log('🛑 Screen share ended by user');
        stopScreenShare();
      };
      
      console.log('✅ Screen share started successfully');
    } catch (error) {
      console.error('❌ Error starting screen share:', error);
      if (error.name !== 'NotAllowedError') {
        alert('Failed to start screen sharing. Please try again.');
      }
    }
  }, [channelId, userId, emitSocketEvent]);

  // Stop screen share
  const stopScreenShare = useCallback(() => {
    if (screenShareStreamRef.current) {
      screenShareStreamRef.current.getTracks().forEach(track => track.stop());
      screenShareStreamRef.current = null;
    }
    
    setIsScreenSharing(false);
    setScreenShareStream(null);
    
    if (socketRef.current && channelId) {
      emitSocketEvent('screenShareStop', { channelId, userId });
    }
  }, [channelId, userId]);

  // Heartbeat (keepalive)
  useEffect(() => {
    if (!isConnected || !channelId || !socketRef.current) return;
    
    const heartbeatInterval = setInterval(() => {
      emitSocketEvent('heartbeat', { channelId, userId });
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(heartbeatInterval);
  }, [isConnected, channelId, userId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveRoom();
      
      // Remove socket listeners
      if (socketRef.current) {
        offSocketEvent('roomState');
        offSocketEvent('userJoined');
        offSocketEvent('userLeft');
        offSocketEvent('offer');
        offSocketEvent('answer');
        offSocketEvent('iceCandidate');
        offSocketEvent('muteUpdate');
        offSocketEvent('deafenUpdate');
        offSocketEvent('screenShareStarted');
        offSocketEvent('screenShareStopped');
        offSocketEvent('speakingUpdate');
        offSocketEvent('error');
      }
    };
  }, [leaveRoom]);

  return {
    participants,
    isMuted,
    isDeafened,
    isConnected,
    isConnecting,
    connectionStatus,
    localStream,
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
    stopScreenShare
  };
}

