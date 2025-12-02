/**
 * Socket.io Client Wrapper
 * 
 * Handles connection, authentication, and reconnection logic
 * Provides a clean interface for voice channel signaling
 */

import { io } from 'socket.io-client';
import { useAppStore } from "../stores/appStore.js";

// Support both environment variable names for flexibility
const VOICE_SERVER_URL = import.meta.env.VITE_SOCKET_SERVER_URL || 
                         import.meta.env.VITE_VOICE_SERVER_URL || 
                         'http://localhost:3001';

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 1000; // Start with 1 second

/**
 * Get user data for authentication
 * Uses the app's custom auth system (Zustand store)
 */
function getUserAuthData() {
  // Try to get from Zustand store
  try {
    const store = useAppStore.getState();
    const user = store?.user;
    
    if (user && (user.id || user.userId)) {
      return {
        id: user.id || user.userId,
        userId: user.userId || user.id,
        username: user.username || user.name,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }
  } catch (error) {
    console.warn('Could not get user from store:', error);
  }
  
  // Fallback: Try localStorage
  try {
    const savedUser = localStorage.getItem('nexvoide_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      return {
        id: user.id || user.userId,
        userId: user.userId || user.id,
        username: user.username || user.name,
        name: user.name,
        email: user.email,
        role: user.role,
      };
    }
  } catch (error) {
    console.warn('Could not get user from localStorage:', error);
  }
  
  return null;
}

/**
 * Create a simple token from user data
 * This is a basic token - in production, you might want to use JWT
 */
function createUserToken(userData) {
  if (!userData) return null;
  
  // Create a simple token from user data
  // In production, you might want to sign this with JWT_SECRET
  const tokenData = {
    id: userData.id || userData.userId,
    userId: userData.userId || userData.id,
    username: userData.username,
    name: userData.name,
    email: userData.email,
    role: userData.role,
    timestamp: Date.now(),
  };
  
  // Simple base64 encoding (for basic auth)
  // In production, use proper JWT signing
  return btoa(JSON.stringify(tokenData));
}

/**
 * Get or create socket connection
 */
export function getSocket() {
  if (socket?.connected) {
    return socket;
  }
  
  return connectSocket();
}

/**
 * Connect to voice signaling server
 */
export async function connectSocket() {
  if (socket?.connected) {
    return socket;
  }
  
  // Disconnect existing socket if any
  if (socket) {
    socket.disconnect();
  }
  
  // Get user data from app's auth system
  const userData = getUserAuthData();
  if (!userData || !userData.id) {
    throw new Error('No authentication token available - user not logged in');
  }
  
  // Create token from user data
  const token = createUserToken(userData);
  if (!token) {
    throw new Error('Failed to create authentication token');
  }
  
  // Create socket connection
  socket = io(VOICE_SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: RECONNECT_DELAY,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    timeout: 20000,
    auth: {
      token: token,
      user: userData // Also send user data for server verification
    }
  });
  
  // Authenticate on connection
  socket.on('connect', async () => {
    console.log('🔌 Socket connected:', socket.id);
    reconnectAttempts = 0;
    
    // Authenticate with token
    const currentUserData = getUserAuthData();
    if (currentUserData) {
      const currentToken = createUserToken(currentUserData);
      if (currentToken) {
        socket.emit('authenticate', { 
          token: currentToken,
          user: currentUserData 
        });
      }
    }
  });
  
  socket.on('authenticated', () => {
    console.log('✅ Socket authenticated');
  });
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
    
    if (reason === 'io server disconnect') {
      // Server disconnected, reconnect manually
      socket.connect();
    }
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Socket connection error:', error);
    reconnectAttempts++;
    
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error('Max reconnection attempts reached');
    }
  });
  
  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
  
  return socket;
}

/**
 * Disconnect socket
 */
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Check if socket is connected
 */
export function isSocketConnected() {
  return socket?.connected || false;
}

/**
 * Subscribe to socket events
 */
export function onSocketEvent(event, callback) {
  if (!socket) {
    connectSocket().then(s => {
      s.on(event, callback);
    });
    return;
  }
  
  socket.on(event, callback);
}

/**
 * Unsubscribe from socket events
 */
export function offSocketEvent(event, callback) {
  if (socket) {
    socket.off(event, callback);
  }
}

/**
 * Emit event to server
 */
export function emitSocketEvent(event, data) {
  if (!socket?.connected) {
    console.warn('Socket not connected, attempting to connect...');
    connectSocket().then(s => {
      s.emit(event, data);
    });
    return;
  }
  
  socket.emit(event, data);
}

export default {
  getSocket,
  connectSocket,
  disconnectSocket,
  isSocketConnected,
  onSocketEvent,
  offSocketEvent,
  emitSocketEvent
};

