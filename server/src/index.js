/**
 * Nexvoide Voice Channel Signaling Server
 * 
 * Socket.io server for WebRTC signaling (offer/answer/ICE exchange)
 * Handles room membership, presence, and real-time communication
 * 
 * Architecture:
 * - Fast signaling via Socket.io (sub-50ms delivery)
 * - In-memory room state (or Redis for scaling)
 * - Supabase for persistence (not for signaling)
 * - JWT authentication for socket connections
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import Redis from 'ioredis';

dotenv.config();

const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const REDIS_URL = process.env.REDIS_URL;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Initialize Express for health checks
const app = express();
app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    rooms: Object.keys(roomMap).length,
    totalConnections: io.engine.clientsCount
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json({
    rooms: Object.keys(roomMap).length,
    totalConnections: io.engine.clientsCount,
    totalParticipants: Object.values(roomMap).reduce((sum, room) => sum + Object.keys(room.participants).length, 0)
  });
});

const httpServer = createServer(app);

// Initialize Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Room state management
// Structure: { channelId: { participants: { userId: { socketId, user, joinedAt, meta, isMuted, isDeafened } }, maxUsers } }
const roomMap = {};

// Socket ID to User ID mapping (for quick lookups)
const socketToUser = new Map(); // socketId -> { userId, channelId }

// Redis client (optional - for multi-instance scaling)
let redis = null;
let redisSub = null;
let redisPub = null;

if (REDIS_URL) {
  try {
    redis = new Redis(REDIS_URL);
    redisSub = new Redis(REDIS_URL);
    redisPub = new Redis(REDIS_URL);
    
    // Subscribe to Redis pub/sub for cross-instance communication
    redisSub.subscribe('voice-channel-events');
    redisSub.on('message', (channel, message) => {
      try {
        const event = JSON.parse(message);
        handleRedisEvent(event);
      } catch (err) {
        console.error('Error parsing Redis message:', err);
      }
    });
    
    console.log('✅ Redis connected for multi-instance support');
  } catch (err) {
    console.warn('⚠️ Redis connection failed, using in-memory storage:', err.message);
  }
}

/**
 * Verify token and extract user info
 * Supports both JWT tokens (from Supabase) and simple base64 tokens (from custom auth)
 */
function verifyToken(token, userData = null) {
  // If userData is provided, use it directly (for custom auth systems)
  if (userData && userData.id) {
    return {
      id: userData.id || userData.userId,
      userId: userData.userId || userData.id,
      username: userData.username,
      name: userData.name,
      email: userData.email,
      role: userData.role,
    };
  }
  
  // Try to decode as base64 token (custom auth)
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    if (decoded.id || decoded.userId) {
      return {
        id: decoded.id || decoded.userId,
        userId: decoded.userId || decoded.id,
        username: decoded.username,
        name: decoded.name,
        email: decoded.email,
        role: decoded.role,
      };
    }
  } catch (e) {
    // Not a base64 token, try JWT
  }
  
  // Try JWT verification (for Supabase tokens)
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    // JWT verification failed
    console.warn('Token verification failed:', err.message);
    return null;
  }
}

/**
 * Get room state snapshot
 */
function getRoomState(channelId) {
  const room = roomMap[channelId];
  if (!room) {
    return { channelId, participants: [], maxUsers: null };
  }
  
  const participants = Object.entries(room.participants).map(([userId, data]) => ({
    userId,
    user: data.user,
    joinedAt: data.joinedAt,
    meta: data.meta,
    isMuted: data.isMuted || false,
    isDeafened: data.isDeafened || false
  }));
  
  return {
    channelId,
    participants,
    maxUsers: room.maxUsers
  };
}

/**
 * Broadcast to Redis (for multi-instance)
 */
function broadcastToRedis(event, data) {
  if (redisPub) {
    redisPub.publish('voice-channel-events', JSON.stringify({ event, data }));
  }
}

/**
 * Handle Redis events from other instances
 */
function handleRedisEvent({ event, data }) {
  // Handle cross-instance events if needed
  // For now, we'll rely on socket.io rooms for most communication
}

/**
 * Find socket ID for a user ID in a specific channel
 */
function findSocketId(userId, channelId) {
  const room = roomMap[channelId];
  if (!room || !room.participants[userId]) {
    return null;
  }
  return room.participants[userId].socketId;
}

/**
 * Get or create room
 */
function getOrCreateRoom(channelId, maxUsers = null) {
  if (!roomMap[channelId]) {
    roomMap[channelId] = {
      participants: {},
      maxUsers: maxUsers
    };
  }
  return roomMap[channelId];
}

/**
 * Remove user from room
 */
function removeFromRoom(channelId, userId) {
  const room = roomMap[channelId];
  if (!room) return;
  
  delete room.participants[userId];
  socketToUser.delete(room.participants[userId]?.socketId);
  
  // Clean up empty rooms
  if (Object.keys(room.participants).length === 0) {
    delete roomMap[channelId];
  }
}

// Socket.io connection handling
io.use((socket, next) => {
  // Authentication happens on 'authenticate' event
  // We'll allow connection but require auth before allowing other events
  next();
});

io.on('connection', (socket) => {
  console.log(`🔌 New socket connection: ${socket.id}`);
  
  let authenticatedUser = null;
  let userChannels = new Set(); // Track which channels this user is in
  
  // Authenticate socket connection
  socket.on('authenticate', async ({ token, user: userData }) => {
    try {
      // Verify token (supports both JWT and base64 tokens)
      const user = verifyToken(token, userData);
      if (!user || !(user.id || user.userId)) {
        socket.emit('error', { code: 'AUTH_FAILED', message: 'Invalid or expired token' });
        return;
      }
      
      authenticatedUser = user;
      socket.user = user;
      console.log(`✅ Socket authenticated: ${socket.id} -> User: ${user.id || user.userId}`);
      
      socket.emit('authenticated', { userId: user.id || user.userId });
    } catch (err) {
      console.error('Authentication error:', err);
      socket.emit('error', { code: 'AUTH_ERROR', message: err.message });
    }
  });
  
  // Join voice channel
  socket.on('joinVoiceChannel', async ({ channelId, user, maxUsers = null }) => {
    if (!authenticatedUser) {
      return socket.emit('error', { code: 'NOT_AUTHENTICATED', message: 'Must authenticate first' });
    }
    
    const userId = authenticatedUser.id || authenticatedUser.userId;
    
    try {
      console.log(`📥 Join request: User ${userId} -> Channel ${channelId}`);
      
      const room = getOrCreateRoom(channelId, maxUsers);
      
      // Check room capacity
      const currentCount = Object.keys(room.participants).length;
      if (room.maxUsers && currentCount >= room.maxUsers) {
        console.log(`❌ Room full: ${channelId} (${currentCount}/${room.maxUsers})`);
        return socket.emit('error', { 
          code: 'ROOM_FULL', 
          message: `Room is full. Maximum ${room.maxUsers} users allowed.`,
          channelId 
        });
      }
      
      // Check if user is already in room (reconnection case)
      if (room.participants[userId]) {
        console.log(`🔄 User reconnecting: ${userId} in ${channelId}`);
        // Update socket ID
        room.participants[userId].socketId = socket.id;
      } else {
        // Add user to room
        room.participants[userId] = {
          socketId: socket.id,
          user: user || { id: userId, name: authenticatedUser.name, avatar: authenticatedUser.avatar },
          joinedAt: new Date().toISOString(),
          meta: user?.meta || {},
          isMuted: false,
          isDeafened: false
        };
      }
      
      socketToUser.set(socket.id, { userId, channelId });
      userChannels.add(channelId);
      
      // Join socket.io room for this channel
      socket.join(channelId);
      
      // Send room state snapshot to joining user
      const roomState = getRoomState(channelId);
      socket.emit('roomState', roomState);
      
      // Broadcast to other users in the room
      socket.to(channelId).emit('userJoined', {
        channelId,
        user: room.participants[userId].user,
        userId,
        joinedAt: room.participants[userId].joinedAt
      });
      
      // Broadcast to Redis for multi-instance
      broadcastToRedis('userJoined', { channelId, userId, user: room.participants[userId].user });
      
      console.log(`✅ User joined: ${userId} -> ${channelId} (${Object.keys(room.participants).length}/${room.maxUsers || '∞'})`);
    } catch (err) {
      console.error('Error joining channel:', err);
      socket.emit('error', { code: 'JOIN_ERROR', message: err.message, channelId });
    }
  });
  
  // Leave voice channel
  socket.on('leaveVoiceChannel', ({ channelId, userId: providedUserId }) => {
    if (!authenticatedUser) return;
    
    const userId = providedUserId || authenticatedUser.id || authenticatedUser.userId;
    
    console.log(`📤 Leave request: User ${userId} -> Channel ${channelId}`);
    
    const room = roomMap[channelId];
    if (!room || !room.participants[userId]) {
      return; // Already left or never joined
    }
    
    removeFromRoom(channelId, userId);
    userChannels.delete(channelId);
    socket.leave(channelId);
    
    // Broadcast to other users
    socket.to(channelId).emit('userLeft', { channelId, userId });
    broadcastToRedis('userLeft', { channelId, userId });
    
    console.log(`✅ User left: ${userId} -> ${channelId}`);
  });
  
  // WebRTC Signaling: Offer
  socket.on('signalOffer', ({ toUserId, fromUserId, channelId, offer }) => {
    if (!authenticatedUser) return;
    
    const senderId = authenticatedUser.id || authenticatedUser.userId;
    if (senderId !== fromUserId) {
      return socket.emit('error', { code: 'UNAUTHORIZED', message: 'User ID mismatch' });
    }
    
    const targetSocketId = findSocketId(toUserId, channelId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('offer', {
        fromUserId,
        toUserId,
        channelId,
        offer
      });
      console.log(`📨 Offer: ${fromUserId} -> ${toUserId} (${channelId})`);
    } else {
      console.warn(`⚠️ Target user not found: ${toUserId} in ${channelId}`);
    }
  });
  
  // WebRTC Signaling: Answer
  socket.on('signalAnswer', ({ toUserId, fromUserId, channelId, answer }) => {
    if (!authenticatedUser) return;
    
    const senderId = authenticatedUser.id || authenticatedUser.userId;
    if (senderId !== fromUserId) {
      return socket.emit('error', { code: 'UNAUTHORIZED', message: 'User ID mismatch' });
    }
    
    const targetSocketId = findSocketId(toUserId, channelId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('answer', {
        fromUserId,
        toUserId,
        channelId,
        answer
      });
      console.log(`📨 Answer: ${fromUserId} -> ${toUserId} (${channelId})`);
    } else {
      console.warn(`⚠️ Target user not found: ${toUserId} in ${channelId}`);
    }
  });
  
  // WebRTC Signaling: ICE Candidate
  socket.on('signalIceCandidate', ({ toUserId, fromUserId, channelId, candidate }) => {
    if (!authenticatedUser) return;
    
    const senderId = authenticatedUser.id || authenticatedUser.userId;
    if (senderId !== fromUserId) {
      return; // Silently ignore unauthorized
    }
    
    const targetSocketId = findSocketId(toUserId, channelId);
    if (targetSocketId) {
      io.to(targetSocketId).emit('iceCandidate', {
        fromUserId,
        toUserId,
        channelId,
        candidate
      });
      // Don't log every ICE candidate (too noisy)
    }
  });
  
  // Mute toggle
  socket.on('toggleMute', ({ channelId, userId: providedUserId, isMuted }) => {
    if (!authenticatedUser) return;
    
    const userId = providedUserId || authenticatedUser.id || authenticatedUser.userId;
    const room = roomMap[channelId];
    if (!room || !room.participants[userId]) return;
    
    room.participants[userId].isMuted = isMuted;
    
    // Broadcast to room
    socket.to(channelId).emit('muteUpdate', { channelId, userId, isMuted });
    broadcastToRedis('muteUpdate', { channelId, userId, isMuted });
  });
  
  // Deafen toggle
  socket.on('toggleDeafen', ({ channelId, userId: providedUserId, isDeafened }) => {
    if (!authenticatedUser) return;
    
    const userId = providedUserId || authenticatedUser.id || authenticatedUser.userId;
    const room = roomMap[channelId];
    if (!room || !room.participants[userId]) return;
    
    room.participants[userId].isDeafened = isDeafened;
    
    // Broadcast to room
    socket.to(channelId).emit('deafenUpdate', { channelId, userId, isDeafened });
    broadcastToRedis('deafenUpdate', { channelId, userId, isDeafened });
  });
  
  // Screen share start
  socket.on('screenShareStart', ({ channelId, userId: providedUserId }) => {
    if (!authenticatedUser) return;
    
    const userId = providedUserId || authenticatedUser.id || authenticatedUser.userId;
    
    socket.to(channelId).emit('screenShareStarted', { channelId, userId });
    broadcastToRedis('screenShareStarted', { channelId, userId });
    console.log(`🖥️ Screen share started: ${userId} in ${channelId}`);
  });
  
  // Screen share stop
  socket.on('screenShareStop', ({ channelId, userId: providedUserId }) => {
    if (!authenticatedUser) return;
    
    const userId = providedUserId || authenticatedUser.id || authenticatedUser.userId;
    
    socket.to(channelId).emit('screenShareStopped', { channelId, userId });
    broadcastToRedis('screenShareStopped', { channelId, userId });
    console.log(`🖥️ Screen share stopped: ${userId} in ${channelId}`);
  });
  
  // Speaking indicator (rate-limited)
  socket.on('userSpeaking', ({ channelId, userId: providedUserId, isSpeaking }) => {
    if (!authenticatedUser) return;
    
    const userId = providedUserId || authenticatedUser.id || authenticatedUser.userId;
    
    // Broadcast to room (only on state change - client should rate-limit)
    socket.to(channelId).emit('speakingUpdate', { channelId, userId, isSpeaking });
  });
  
  // Heartbeat (keepalive for presence)
  socket.on('heartbeat', ({ channelId, userId: providedUserId }) => {
    if (!authenticatedUser) return;
    
    const userId = providedUserId || authenticatedUser.id || authenticatedUser.userId;
    const room = roomMap[channelId];
    
    if (room && room.participants[userId]) {
      // Update last seen
      room.participants[userId].lastHeartbeat = Date.now();
    }
  });
  
  // Disconnect handling
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket disconnected: ${socket.id} (${reason})`);
    
    // Remove user from all rooms
    const userInfo = socketToUser.get(socket.id);
    if (userInfo) {
      const { userId, channelId } = userInfo;
      removeFromRoom(channelId, userId);
      socket.to(channelId).emit('userLeft', { channelId, userId });
      broadcastToRedis('userLeft', { channelId, userId });
      console.log(`✅ Removed disconnected user: ${userId} from ${channelId}`);
    }
    
    // Clean up all channels this socket was in
    userChannels.forEach(channelId => {
      const room = roomMap[channelId];
      if (room) {
        Object.entries(room.participants).forEach(([uid, data]) => {
          if (data.socketId === socket.id) {
            removeFromRoom(channelId, uid);
            socket.to(channelId).emit('userLeft', { channelId, userId: uid });
          }
        });
      }
    });
    
    socketToUser.delete(socket.id);
    userChannels.clear();
  });
});

// Cleanup stale connections (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 60000; // 60 seconds without heartbeat
  
  Object.entries(roomMap).forEach(([channelId, room]) => {
    Object.entries(room.participants).forEach(([userId, data]) => {
      if (data.lastHeartbeat && (now - data.lastHeartbeat) > staleThreshold) {
        console.log(`🧹 Removing stale user: ${userId} from ${channelId}`);
        removeFromRoom(channelId, userId);
        io.to(channelId).emit('userLeft', { channelId, userId });
      }
    });
  });
}, 30000);

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Voice signaling server running on port ${PORT}`);
  console.log(`📡 Environment: ${NODE_ENV}`);
  console.log(`🌐 CORS enabled for: ${CLIENT_URL}`);
  console.log(`💾 Storage: ${REDIS_URL ? 'Redis' : 'In-memory'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  httpServer.close(() => {
    console.log('Server closed');
    if (redis) redis.quit();
    if (redisSub) redisSub.quit();
    if (redisPub) redisPub.quit();
    process.exit(0);
  });
});

