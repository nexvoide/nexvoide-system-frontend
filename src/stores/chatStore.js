import { create } from 'zustand';
import { supabase, TABLES, isSupabaseConfigured } from '../lib/supabase.js';

// Default sections with emojis
const getDefaultSections = () => [
  { name: 'Video Editing', emoji: '🎬', order: 0 },
  { name: 'Graphic Designing', emoji: '🎨', order: 1 },
];

// Helper to convert old format (array of strings) to new format (array of objects)
// Note: Don't return defaults if sections array is empty - respect user's choice to delete all sections
const normalizeSections = (sections) => {
  if (!sections || sections.length === 0) return []; // Return empty array instead of defaults
  
  return sections.map((section, index) => {
    if (typeof section === 'string') {
      // Old format - convert to new format with default emoji
      const defaultEmojis = {
        'Video Editing': '🎬',
        'Graphic Designing': '🎨',
      };
      return {
        name: section,
        emoji: defaultEmojis[section] || '📁',
        order: index,
      };
    }
    // Already in new format - ensure order exists
    return {
      ...section,
      order: section.order !== undefined ? section.order : index,
    };
  });
};

// Normalize channels - ensure all have required fields
const normalizeChannels = (channels) => {
  if (!Array.isArray(channels)) return [];
  return channels.map(ch => ({
    ...ch,
    type: ch.type || 'text', // Default to 'text' if type is missing
    users: ch.users || [],
    readOnly: ch.readOnly || false,
    userLimit: ch.userLimit || null, // User limit for voice rooms
  }));
};

// Load from localStorage (fallback)
const loadChatDataFromLocalStorage = () => {
  try {
    const stored = localStorage.getItem('nexvoide-chat');
    if (stored) {
      const parsed = JSON.parse(stored);
      const sections = parsed.sections && parsed.sections.length > 0
        ? normalizeSections(parsed.sections)
        : []; // Respect empty sections (user may have deleted all)
      return {
        channels: normalizeChannels(parsed.channels || []),
        messages: parsed.messages || {},
        sections,
      };
    }
  } catch (e) {
    console.warn('Failed to load chat data from localStorage:', e);
  }
  // Only use defaults on first initialization (no stored data at all)
  return { 
    channels: [], 
    messages: {},
    sections: getDefaultSections(),
  };
};

// Load channels from Supabase
const loadChannelsFromSupabase = async () => {
  if (!isSupabaseConfigured || !supabase) {
    console.log('Supabase not configured, using localStorage');
    return loadChatDataFromLocalStorage();
  }

  try {
    console.log('Loading channels from Supabase...');
    
    // Load channels
    const { data: channelsData, error: channelsError } = await supabase
      .from(TABLES.channels)
      .select('*')
      .order('order', { ascending: true });

    if (channelsError) {
      console.error('Error loading channels from Supabase:', channelsError);
      // Fallback to localStorage
      return loadChatDataFromLocalStorage();
    }

    // Load sections
    const { data: sectionsData, error: sectionsError } = await supabase
      .from(TABLES.sections)
      .select('*')
      .order('order', { ascending: true });

    if (sectionsError) {
      console.error('Error loading sections from Supabase:', sectionsError);
    }

    const channels = normalizeChannels((channelsData || []).map(ch => ({
      ...ch,
      userLimit: ch.user_limit || ch.userLimit || null, // Handle both snake_case and camelCase
    })));
    // Only use default sections if Supabase has never been initialized (no sections table data)
    // If sections exist but are empty, respect that (user may have deleted all sections)
    const sections = sectionsData !== null && sectionsData !== undefined
      ? (sectionsData.length > 0 ? normalizeSections(sectionsData) : [])
      : getDefaultSections(); // Only use defaults if Supabase query failed (table doesn't exist)

    console.log('Loaded from Supabase:', { 
      channels: channels.length, 
      sections: sections.length 
    });

    return {
      channels,
      messages: {}, // Messages are loaded separately per channel
      sections,
    };
  } catch (error) {
    console.error('Error loading from Supabase:', error);
    return loadChatDataFromLocalStorage();
  }
};

// Save channels to Supabase
const saveChannelsToSupabase = async (channels, sections) => {
  if (!isSupabaseConfigured || !supabase) {
    console.log('Supabase not configured, saving to localStorage');
    saveChatDataToLocalStorage(channels, {}, sections);
    return;
  }

  try {
    // Save channels using upsert (insert or update)
    if (channels && channels.length > 0) {
      const channelsToUpsert = channels.map(ch => {
        // Ensure users is always an array and properly formatted for Supabase TEXT[] type
        let usersArray = [];
        if (ch.users) {
          if (Array.isArray(ch.users)) {
            usersArray = ch.users.filter(u => u != null && u !== '').map(u => String(u).trim());
          } else {
            usersArray = [String(ch.users).trim()];
          }
        }
        
        // Remove empty strings and nulls
        usersArray = usersArray.filter(u => u && u !== '');
        
        console.log('Saving channel to Supabase:', {
          id: ch.id,
          name: ch.name,
          users: usersArray,
          usersType: typeof ch.users,
          isArray: Array.isArray(ch.users),
          usersLength: usersArray.length
        });
        
        const channelData = {
          id: ch.id,
          name: ch.name,
          section: ch.section,
          description: ch.description || '',
          users: usersArray.length > 0 ? usersArray : [], // Empty array if no users
          read_only: ch.readOnly || false,
          type: ch.type || 'text',
          order: ch.order || 0,
          created_by: ch.createdBy || null,
          created_at: ch.createdAt || new Date().toISOString(),
        };
        
        // Only include user_limit if it exists (for backward compatibility)
        // If the column doesn't exist in the database, it will cause a 400 error
        // We'll try to include it, but if it fails, we'll retry without it
        if (ch.userLimit !== undefined && ch.userLimit !== null) {
          channelData.user_limit = ch.userLimit;
        }
        
        return channelData;
      });

      let { error: upsertError } = await supabase
        .from(TABLES.channels)
        .upsert(channelsToUpsert, { onConflict: 'id' });

      // If error is about missing user_limit column, retry without it
      if (upsertError && upsertError.message && upsertError.message.includes('user_limit')) {
        console.warn('user_limit column not found, retrying without it...');
        
        // Remove user_limit from all channels and retry
        const channelsWithoutLimit = channelsToUpsert.map(ch => {
          const { user_limit, ...rest } = ch;
          return rest;
        });
        
        const { error: retryError } = await supabase
          .from(TABLES.channels)
          .upsert(channelsWithoutLimit, { onConflict: 'id' });
        
        if (retryError) {
          upsertError = retryError;
        } else {
          console.log('Saved', channelsWithoutLimit.length, 'channels to Supabase (without user_limit)');
          console.warn('Note: user_limit column is missing. Please run the migration SQL to add it.');
          upsertError = null;
        }
      }

      if (upsertError) {
        console.error('Error saving channels to Supabase:', upsertError);
        console.error('Error details:', {
          message: upsertError.message,
          details: upsertError.details,
          hint: upsertError.hint,
          code: upsertError.code,
          channelsBeingSaved: channelsToUpsert.map(ch => ({
            id: ch.id,
            name: ch.name,
            users: ch.users,
            usersType: typeof ch.users,
            usersIsArray: Array.isArray(ch.users)
          }))
        });
        
        // Handle specific errors
        if (upsertError.code === '42P01') {
          console.warn('Channels table does not exist. Please run the migration SQL.');
        } else if (upsertError.code === '42703' && upsertError.message?.includes('updated_at')) {
          console.error('❌ updated_at column missing from channels table!');
          console.error('💡 Run this SQL in Supabase: ALTER TABLE channels ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();');
          console.error('💡 Or run: database/fixes/add-updated-at-to-channels.sql');
          // Still save to localStorage as fallback
          saveChatDataToLocalStorage(channels, {}, sections);
        }
      } else if (!upsertError) {
        console.log('✅ Saved', channelsToUpsert.length, 'channels to Supabase');
      }
    }

    // Save sections using upsert
    // Always save sections array (even if empty) to persist deletions
    if (sections !== undefined && sections !== null) {
      // First, get all existing sections from Supabase
      const { data: existingSections } = await supabase
        .from(TABLES.sections)
        .select('name');
      
      const existingSectionNames = existingSections ? existingSections.map(s => s.name) : [];
      const currentSectionNames = sections.map(sec => {
        const secName = typeof sec === 'string' ? sec : sec.name;
        return secName;
      });
      
      // Delete sections that are no longer in the current list
      const sectionsToDelete = existingSectionNames.filter(name => !currentSectionNames.includes(name));
      if (sectionsToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from(TABLES.sections)
          .delete()
          .in('name', sectionsToDelete);
        
        if (deleteError) {
          console.error('Error deleting sections from Supabase:', deleteError);
        } else {
          console.log('Deleted sections from Supabase:', sectionsToDelete);
        }
      }
      
      // Upsert current sections
      if (sections.length > 0) {
        const sectionsToUpsert = sections.map(sec => {
          const secName = typeof sec === 'string' ? sec : sec.name;
          const secEmoji = typeof sec === 'object' ? (sec.emoji || '📁') : '📁';
          const secOrder = typeof sec === 'object' ? (sec.order || 0) : 0;
          return {
            name: secName,
            emoji: secEmoji,
            order: secOrder,
          };
        });

        const { error: upsertSectionsError } = await supabase
          .from(TABLES.sections)
          .upsert(sectionsToUpsert, { onConflict: 'name' });

        if (upsertSectionsError) {
          console.error('Error saving sections to Supabase:', upsertSectionsError);
          if (upsertSectionsError.code === '42P01') {
            console.warn('Sections table does not exist. Please run the migration SQL.');
          }
        } else {
          console.log('✅ Saved', sectionsToUpsert.length, 'sections to Supabase');
        }
      } else {
        console.log('No sections to save (all sections deleted)');
      }
    }
  } catch (error) {
    console.error('Error saving to Supabase:', error);
    // Fallback to localStorage
    saveChatDataToLocalStorage(channels, {}, sections);
  }
};

// Save to localStorage (fallback)
const saveChatDataToLocalStorage = (channels, messages, sections) => {
  try {
    localStorage.setItem('nexvoide-chat', JSON.stringify({
      channels,
      messages,
      sections,
    }));
  } catch (e) {
    console.warn('Failed to save chat data to localStorage:', e);
  }
};

// Default channels structure
const getDefaultChannels = () => [
  {
    id: 'video-editing-important',
    name: 'Important Discussion',
    section: 'Video Editing',
    description: 'Important discussions for video editing team',
    users: [],
    readOnly: false,
    type: 'text',
    createdBy: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'video-editing-team',
    name: 'Team Discussion',
    section: 'Video Editing',
    description: 'General team discussion',
    users: [],
    readOnly: false,
    type: 'text',
    createdBy: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'video-editing-delivery',
    name: 'Project Delivery',
    section: 'Video Editing',
    description: 'Project delivery discussions',
    users: [],
    readOnly: false,
    type: 'text',
    createdBy: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'graphic-designing-important',
    name: 'Important Discussion',
    section: 'Graphic Designing',
    description: 'Important discussions for graphic design team',
    users: [],
    readOnly: false,
    type: 'text',
    createdBy: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'graphic-designing-team',
    name: 'Team Discussion',
    section: 'Graphic Designing',
    description: 'General team discussion',
    users: [],
    readOnly: false,
    type: 'text',
    createdBy: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'graphic-designing-delivery',
    name: 'Project Delivery',
    section: 'Graphic Designing',
    description: 'Project delivery discussions',
    users: [],
    readOnly: false,
    type: 'text',
    createdBy: null,
    createdAt: new Date().toISOString(),
  },
];

// Initialize with empty state, will be loaded asynchronously
const initialState = { 
  channels: [], 
  messages: {},
  sections: getDefaultSections(),
  isLoading: true,
};

export const useChatStore = create((set, get) => ({
  ...initialState,

  // Initialize - load from Supabase or localStorage
  initialize: async () => {
    const state = get();
    if (!state.isLoading) return; // Already initialized
    
    set({ isLoading: true });
    const data = await loadChannelsFromSupabase();
    set({ 
      ...data, 
      isLoading: false 
    });
  },

  // Get sorted sections by order
  getSortedSections: () => {
    const state = get();
    return [...state.sections].sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  // Reorder sections
  reorderSections: (newOrder) => {
    const state = get();
    // newOrder is an array of section names in the desired order
    // Update each section's order based on its position in newOrder
    const updatedSections = state.sections.map((section) => {
      const sectionName = typeof section === 'string' ? section : section.name;
      const newIndex = newOrder.indexOf(sectionName);
      // If section not found in newOrder, keep original order
      if (newIndex === -1) {
        return typeof section === 'string' 
          ? { name: section, emoji: '📁', order: 999 } 
          : { ...section, order: section.order || 999 };
      }
      return typeof section === 'string'
        ? { name: section, emoji: '📁', order: newIndex }
        : { ...section, order: newIndex };
    });
    
    console.log('Reordering sections:', {
      newOrder,
      updatedSections: updatedSections.map(s => ({ name: s.name, order: s.order }))
    });
    
    set({ sections: updatedSections });
    saveChannelsToSupabase(state.channels, updatedSections);
  },

  // Reorder channels in a section
  reorderChannels: (sectionName, newChannelOrder) => {
    const state = get();
    const updatedChannels = state.channels.map(channel => {
      if (channel.section === sectionName) {
        const newIndex = newChannelOrder.indexOf(channel.id);
        return {
          ...channel,
          order: newIndex >= 0 ? newIndex : (channel.order || 0),
        };
      }
      return channel;
    });
    set({ channels: updatedChannels });
    saveChannelsToSupabase(updatedChannels, state.sections);
  },

  // Select a channel
  selectChannel: (channelId) => {
    set({ selectedChannel: channelId });
  },

  // Get channels for a section (sorted by order)
  getChannelsForSection: (sectionName) => {
    const state = get();
    return state.channels
      .filter(ch => ch.section === sectionName)
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  // Get section by name
  getSection: (sectionName) => {
    const state = get();
    return state.sections.find(s => s.name === sectionName) || { name: sectionName, emoji: '📁' };
  },

  // Get channels user has access to
  getUserChannels: (userId, userRole) => {
    const state = get();
    if (!userId) {
      console.log('getUserChannels: No userId provided');
      return [];
    }
    
    // Normalize userRole to lowercase for comparison
    const normalizedRole = userRole?.toLowerCase();
    
    // Admin and Manager always see all channels (for management)
    // Check multiple possible admin role values (case-insensitive)
    const isAdminOrManager = normalizedRole === 'admin' || 
                             normalizedRole === 'administrator' || 
                             normalizedRole === 'manager';
    
    if (isAdminOrManager) {
      console.log('User is admin/manager - returning all', state.channels.length, 'channels');
      return state.channels;
    }
    
    // Create all possible ID formats for the current user
    // This handles cases where user might be identified by id, username, user_id, or name
    const userIdVariants = [
      String(userId).trim(),
      String(userId).trim().toLowerCase(),
      String(userId).trim().toUpperCase(),
    ];
    
    // Also try numeric conversion if applicable
    const userIdNum = Number(userId);
    if (!isNaN(userIdNum)) {
      userIdVariants.push(userIdNum);
      userIdVariants.push(String(userIdNum));
    }
    
    // Remove duplicates
    const uniqueVariants = [...new Set(userIdVariants.map(v => String(v).trim().toLowerCase()))];
    
    console.log('getUserChannels - User ID variants:', {
      originalUserId: userId,
      userIdType: typeof userId,
      variants: uniqueVariants
    });
    
    // For other users: Check channel access
    // ALL channels (text and voice) are now private by default
    // A channel is accessible ONLY if:
    // 1. The channel has users explicitly added
    // 2. The user's ID (or username) is in the users array
    const filteredChannels = state.channels.filter(ch => {
      // If no users are specified, channel is private (not visible to anyone except admins)
      if (!ch.users || ch.users.length === 0) {
        return false; // Private channel - not visible without explicit users
      }
      
      // Check if user ID matches (handle string/number conversion and case-insensitive)
      const isIncluded = ch.users.some(chUserId => {
        if (!chUserId) return false;
        
        // Create all possible formats for the channel user ID
        const chUserIdVariants = [
          String(chUserId).trim(),
          String(chUserId).trim().toLowerCase(),
          String(chUserId).trim().toUpperCase(),
        ];
        
        // Try numeric conversion
        const chUserIdNum = Number(chUserId);
        if (!isNaN(chUserIdNum)) {
          chUserIdVariants.push(chUserIdNum);
          chUserIdVariants.push(String(chUserIdNum));
        }
        
        // Normalize all variants
        const chUserIdNormalized = chUserIdVariants.map(v => String(v).trim().toLowerCase());
        
        // Check if any variant matches
        for (const userVariant of uniqueVariants) {
          for (const chVariant of chUserIdNormalized) {
            if (userVariant === chVariant) {
              return true;
            }
          }
        }
        
        // Also try direct numeric comparison
        if (!isNaN(userIdNum) && !isNaN(chUserIdNum) && userIdNum === chUserIdNum) {
          return true;
        }
        
        return false;
      });
      
      return isIncluded;
    });
    
    // Detailed logging for debugging
    const normalizedUserIdForLog = String(userId).trim().toLowerCase();
    const channelAccessDetails = state.channels.map(ch => {
      const hasAccess = filteredChannels.some(fc => fc.id === ch.id);
      const channelUserIds = (ch.users || []).map(u => String(u).trim().toLowerCase());
      
      // Check if any variant matches
      let userMatches = false;
      for (const userVariant of uniqueVariants) {
        for (const chUserId of channelUserIds) {
          if (userVariant === chUserId) {
            userMatches = true;
            break;
          }
        }
        if (userMatches) break;
      }
      
      // Also check numeric match
      if (!userMatches && !isNaN(userIdNum)) {
        userMatches = channelUserIds.some(cuId => {
          const cuIdNum = Number(cuId);
          return !isNaN(cuIdNum) && cuIdNum === userIdNum;
        });
      }
      
      return {
        id: ch.id,
        name: ch.name,
        type: ch.type,
        users: ch.users,
        normalizedUsers: channelUserIds,
        userMatches,
        hasAccess,
        reason: !ch.users || ch.users.length === 0 ? 'no users' : (userMatches ? 'matched' : 'not matched')
      };
    });
    
    // Log which channels have users and what those users are
    const channelsWithUsers = state.channels
      .filter(ch => ch.users && ch.users.length > 0)
      .map(ch => ({
        id: ch.id,
        name: ch.name,
        users: ch.users,
        normalizedUsers: (ch.users || []).map(u => String(u).trim().toLowerCase())
      }));
    
    console.log('getUserChannels - Detailed access check:', {
      userId,
      normalizedUserId: normalizedUserIdForLog,
      userIdVariants: uniqueVariants,
      userRole,
      totalChannels: state.channels.length,
      accessibleChannels: filteredChannels.length,
      voiceChannels: filteredChannels.filter(ch => ch.type === 'voice').length,
      textChannels: filteredChannels.filter(ch => ch.type !== 'voice').length,
      channelsWithUsers,
      channelAccessDetails: channelAccessDetails.filter(ch => ch.users && ch.users.length > 0)
    });
    
    return filteredChannels;
  },

  // Create a new channel
  createChannel: (channelData) => {
    const state = get();
    const sectionChannels = state.channels.filter(ch => ch.section === channelData.section);
    const newChannel = {
      id: `channel-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: channelData.name,
      section: channelData.section,
      description: channelData.description || '',
      users: channelData.users || [],
      readOnly: channelData.readOnly || false,
      type: channelData.type || 'text',
      userLimit: channelData.userLimit || null, // User limit for voice rooms
      order: sectionChannels.length,
      createdBy: channelData.createdBy || null,
      createdAt: new Date().toISOString(),
    };
    const updatedChannels = [...state.channels, newChannel];
    set({ channels: updatedChannels });
    saveChannelsToSupabase(updatedChannels, state.sections);
    return newChannel;
  },

  // Update channel
  updateChannel: (channelId, updates) => {
    const state = get();
    const updatedChannels = state.channels.map(ch =>
      ch.id === channelId ? { ...ch, ...updates } : ch
    );
    set({ channels: updatedChannels });
    saveChannelsToSupabase(updatedChannels, state.sections);
  },

  // Delete channel
  deleteChannel: (channelId) => {
    const state = get();
    const updatedChannels = state.channels.filter(ch => ch.id !== channelId);
    const updatedMessages = { ...state.messages };
    delete updatedMessages[channelId];
    
    // If deleted channel was selected, clear selection
    if (state.selectedChannel === channelId) {
      set({ selectedChannel: null });
    }
    
    set({ channels: updatedChannels, messages: updatedMessages });
    saveChannelsToSupabase(updatedChannels, state.sections);
    
    // Also delete from Supabase
    if (isSupabaseConfigured && supabase) {
      supabase
        .from(TABLES.channels)
        .delete()
        .eq('id', channelId)
        .then(({ error }) => {
          if (error) {
            console.error('Error deleting channel from Supabase:', error);
          }
        });
    }
  },

  // Add message to channel
  addMessage: (channelId, message) => {
    const state = get();
    const channelMessages = state.messages[channelId] || [];
    const updatedMessages = {
      ...state.messages,
      [channelId]: [...channelMessages, message],
    };
    set({ messages: updatedMessages });
    saveChatDataToLocalStorage(state.channels, updatedMessages, state.sections);
  },

  // Update channel users
  updateChannelUsers: (channelId, userIds) => {
    const state = get();
    
    // Normalize user IDs to ensure consistency (remove nulls, empty strings, normalize)
    const normalizedUserIds = (userIds || [])
      .filter(id => id != null && id !== '') // Remove nulls and empty strings
      .map(id => {
        // Keep original format but ensure it's a valid value
        const strId = String(id).trim();
        return strId || null;
      })
      .filter(id => id != null); // Remove any remaining nulls
    
    console.log('updateChannelUsers:', {
      channelId,
      originalUserIds: userIds,
      normalizedUserIds,
      channelName: state.channels.find(ch => ch.id === channelId)?.name
    });
    
    const updatedChannels = state.channels.map(ch =>
      ch.id === channelId ? { ...ch, users: normalizedUserIds } : ch
    );
    set({ channels: updatedChannels });
    saveChannelsToSupabase(updatedChannels, state.sections);
    
    console.log('Channel users updated. Channel will now be visible to:', normalizedUserIds);
  },

  // Add a new section
  addSection: (name, emoji = '📁') => {
    const state = get();
    
    // Check if section already exists
    const sectionName = typeof name === 'string' ? name : name.name;
    if (state.sections.some(s => {
      const sName = typeof s === 'string' ? s : s.name;
      return sName === sectionName;
    })) {
      console.warn('Section already exists:', sectionName);
      return false;
    }

    const newSection = {
      name: sectionName,
      emoji: emoji || '📁',
      order: state.sections.length,
    };

    const updatedSections = [...state.sections, newSection];
    set({ sections: updatedSections });
    saveChannelsToSupabase(state.channels, updatedSections);
    console.log('Added section:', newSection);
    return true;
  },

  // Update a section
  updateSection: (oldName, newName, newEmoji) => {
    const state = get();
    
    // Check if new name already exists (and it's not the same section)
    if (newName !== oldName && state.sections.some(s => {
      const sName = typeof s === 'string' ? s : s.name;
      return sName === newName;
    })) {
      console.warn('Section name already exists:', newName);
      return false;
    }

    const updatedSections = state.sections.map(s => {
      const sName = typeof s === 'string' ? s : s.name;
      if (sName === oldName) {
        return {
          name: newName,
          emoji: newEmoji || (typeof s === 'object' ? s.emoji : '📁'),
          order: typeof s === 'object' ? s.order : 0,
        };
      }
      return s;
    });

    // Update channels that use this section
    const updatedChannels = state.channels.map(ch => 
      ch.section === oldName ? { ...ch, section: newName } : ch
    );

    set({ sections: updatedSections, channels: updatedChannels });
    saveChannelsToSupabase(updatedChannels, updatedSections);
    console.log('Updated section:', oldName, '->', newName);
    return true;
  },

  // Delete a section
  deleteSection: (sectionName, forceDeleteChannels = false) => {
    const state = get();
    
    // Check if any channels use this section
    const channelsUsingSection = state.channels.filter(ch => ch.section === sectionName);
    if (channelsUsingSection.length > 0 && !forceDeleteChannels) {
      console.warn('Cannot delete section with channels:', sectionName);
      return false;
    }

    // If force delete, remove all channels in this section first
    let updatedChannels = state.channels;
    if (forceDeleteChannels && channelsUsingSection.length > 0) {
      updatedChannels = state.channels.filter(ch => ch.section !== sectionName);
      console.log(`Force deleting ${channelsUsingSection.length} channel(s) in section "${sectionName}"`);
    }

    const updatedSections = state.sections.filter(s => {
      const sName = typeof s === 'string' ? s : s.name;
      return sName !== sectionName;
    });

    set({ sections: updatedSections, channels: updatedChannels });
    saveChannelsToSupabase(updatedChannels, updatedSections);
    console.log('Deleted section:', sectionName);
    return true;
  },

  // Setup real-time subscription for channel changes
  setupRealtimeSubscription: () => {
    if (!isSupabaseConfigured || !supabase) return null;

    console.log('Setting up real-time subscription for channels...');

    const channel = supabase
      .channel('channels-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.channels,
        },
        async (payload) => {
          console.log('Channel change detected:', payload.eventType, payload.new || payload.old);
          
          // If it's an UPDATE, log the users array specifically
          if (payload.eventType === 'UPDATE' && payload.new) {
            console.log('Channel UPDATE - Users array:', {
              channelId: payload.new.id,
              channelName: payload.new.name,
              users: payload.new.users,
              usersType: typeof payload.new.users,
              usersLength: Array.isArray(payload.new.users) ? payload.new.users.length : 'not array'
            });
          }
          
          // Reload channels from Supabase to get latest state
          const data = await loadChannelsFromSupabase();
          console.log('Reloaded channels after change:', {
            totalChannels: data.channels.length,
            channelsWithUsers: data.channels.filter(ch => ch.users && ch.users.length > 0).map(ch => ({
              id: ch.id,
              name: ch.name,
              users: ch.users
            }))
          });
          set({ channels: data.channels, sections: data.sections });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.sections,
        },
        async (payload) => {
          console.log('Section change detected:', payload.eventType);
          const data = await loadChannelsFromSupabase();
          set({ channels: data.channels, sections: data.sections });
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return channel;
  },
}));
