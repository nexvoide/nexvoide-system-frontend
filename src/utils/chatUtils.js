/**
 * Chat utility functions for mentions, parsing, and notifications
 */

/**
 * Parse mentions from message content (e.g., @username or @name)
 * Returns array of mentioned usernames/names
 */
export function parseMentions(content, allUsers = []) {
  if (!content) return [];
  
  // Match @username or @name patterns
  const mentionRegex = /@(\w+)/g;
  const matches = content.matchAll(mentionRegex);
  const mentionedNames = Array.from(matches, m => m[1]);
  
  // Find matching users (case-insensitive)
  const mentionedUsers = mentionedNames
    .map(name => {
      // Try to find user by username or name (case-insensitive)
      const user = allUsers.find(u => {
        const username = (u.username || '').toLowerCase();
        const userName = (u.name || '').toLowerCase();
        const searchName = name.toLowerCase();
        return username === searchName || userName === searchName;
      });
      return user ? (user.id || user.username) : null;
    })
    .filter(Boolean);
  
  return [...new Set(mentionedUsers)]; // Remove duplicates
}

/**
 * Parse message content and return parts with mention information
 * Returns array of objects: { type: 'text' | 'mention', content: string, isMentioned: boolean }
 */
export function parseMessageParts(content, currentUserId, allUsers = []) {
  if (!content) return [{ type: 'text', content: '', isMentioned: false }];
  
  const mentionRegex = /@(\w+)/g;
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before mention
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.substring(lastIndex, match.index),
        isMentioned: false,
      });
    }
    
    // Find if this mention matches a user
    const mentionName = match[1];
    const user = allUsers.find(u => {
      const username = (u.username || '').toLowerCase();
      const userName = (u.name || '').toLowerCase();
      const searchName = mentionName.toLowerCase();
      return username === searchName || userName === searchName;
    });
    
    const isMentioned = user && (user.id === currentUserId || user.username === currentUserId);
    
    // Add mention part
    parts.push({
      type: 'mention',
      content: match[0],
      isMentioned: isMentioned,
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.substring(lastIndex),
      isMentioned: false,
    });
  }
  
  return parts.length > 0 ? parts : [{ type: 'text', content: content, isMentioned: false }];
}

/**
 * Play notification sound
 * Uses Web Audio API to generate a soft "ting" sound
 */
export function playNotificationSound() {
  try {
    // Create audio context for notification sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Soft "ting" sound - higher frequency, quick fade
    oscillator.frequency.value = 800; // Higher pitch
    oscillator.type = 'sine';
    
    // Volume envelope - quick fade out
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
    
    // Clean up
    oscillator.onended = () => {
      audioContext.close();
    };
  } catch (e) {
    console.warn('Could not play notification sound:', e);
    // Fallback: Try using a simple beep via Audio element
    try {
      const audio = new Audio();
      audio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGW57+OcTQ8OUKfk8LZjHAY4kdfyzHksBSR3x/DdkEAKFF606euoVRQKRp/g8r5sIQUqgc7y2Yk2CBhlue/jnE0PDlCn5PC2YxwGOJHX8sx5LAUkd8fw3ZBAC';
      audio.volume = 0.3;
      audio.play().catch(err => {
        console.warn('Could not play fallback notification sound:', err);
      });
    } catch (fallbackError) {
      console.warn('Could not create fallback notification sound:', fallbackError);
    }
  }
}

/**
 * Check if user should receive notification
 * - Channel is not currently open
 * - OR tab is not focused
 */
export function shouldNotify(channelId, selectedChannelId, isTabFocused) {
  return channelId !== selectedChannelId || !isTabFocused;
}

