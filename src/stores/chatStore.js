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
    section: ch.section_name ?? ch.section ?? '',
    description: ch.description ?? '',
    type: ch.type || 'text', // Default to 'text' if type is missing
    users: Array.isArray(ch.users) ? ch.users : [],
    readOnly: ch.read_only ?? ch.readOnly ?? false,
    userLimit: ch.user_limit ?? ch.userLimit ?? null,
    createdBy: ch.created_by ?? ch.createdBy ?? null,
    createdAt: ch.created_at ?? ch.createdAt ?? null,
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

    const { data: membershipData, error: membershipError } = await supabase
      .from('channel_members')
      .select('channel_id, user_id');
    if (membershipError) throw membershipError;

    // Load sections
    const { data: sectionsData, error: sectionsError } = await supabase
      .from(TABLES.sections)
      .select('*')
      .order('order', { ascending: true });

    if (sectionsError) {
      console.error('Error loading sections from Supabase:', sectionsError);
    }

    const membersByChannel = (membershipData || []).reduce((result, membership) => {
      (result[membership.channel_id] ||= []).push(membership.user_id);
      return result;
    }, {});
    const channels = normalizeChannels((channelsData || []).map(ch => ({
      ...ch,
      users: membersByChannel[ch.id] || [],
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

const normalizeUserIds = (users = []) => [...new Set(
  users.map(value => String(value).trim()).filter(Boolean)
)];

const toChannelRow = channel => ({
  id: channel.id,
  name: channel.name,
  type: 'text',
  read_only: Boolean(channel.readOnly),
  order: Number.isInteger(channel.order) ? channel.order : 0,
  section_name: channel.section,
  description: channel.description || '',
  created_by: channel.createdBy || null,
});

const requireData = (data, error, operation) => {
  if (error) throw new Error(`${operation}: ${error.message}`);
  if (!data) throw new Error(`${operation}: Supabase returned no data`);
  return data;
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
  reorderSections: async (newOrder) => {
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
    
    try {
      if (isSupabaseConfigured && supabase) {
        for (const section of updatedSections) {
          const query = supabase.from(TABLES.sections).update({ order: section.order });
          const { data, error } = section.id
            ? await query.eq('id', section.id).select('name').single()
            : await query.eq('name', section.name).select('name').single();
          requireData(data, error, `Failed to reorder section "${section.name}"`);
        }
      }
      set({ sections: updatedSections });
      saveChatDataToLocalStorage(state.channels, state.messages, updatedSections);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  // Reorder channels in a section
  reorderChannels: async (sectionName, newChannelOrder) => {
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
    try {
      if (isSupabaseConfigured && supabase) {
        for (const channel of updatedChannels.filter(item => item.section === sectionName)) {
          const { error } = await supabase
            .from(TABLES.channels)
            .update({ order: channel.order })
            .eq('id', channel.id)
            .select('id')
            .single();
          if (error) throw new Error(`Failed to reorder channel "${channel.name}": ${error.message}`);
        }
      }
      set({ channels: updatedChannels });
      saveChatDataToLocalStorage(updatedChannels, state.messages, state.sections);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
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
    const identityValues = (Array.isArray(userId) ? userId : [userId])
      .filter(value => value !== null && value !== undefined && String(value).trim() !== '')
      .map(value => String(value).trim().toLocaleLowerCase());
    const identitySet = new Set(identityValues);

    if (identitySet.size === 0) {
      console.log('getUserChannels: No userId provided');
      return [];
    }

    const normalizedRoles = (Array.isArray(userRole) ? userRole : [userRole])
      .filter(Boolean)
      .map(role => String(role).trim().toLocaleLowerCase());
    const isAdminOrManager = normalizedRoles.some(role =>
      role === 'admin' || role === 'administrator' || role === 'manager'
    );

    if (isAdminOrManager) {
      return state.channels;
    }

    return state.channels.filter(channel =>
      Array.isArray(channel.users) && channel.users.some(memberId =>
        identitySet.has(String(memberId).trim().toLocaleLowerCase())
      )
    );
  },

  // Create a new channel
  createChannel: async (channelData) => {
    const state = get();
    const sectionChannels = state.channels.filter(ch => ch.section === channelData.section);
    const newChannel = {
      id: crypto.randomUUID(),
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
    try {
      let persistedChannel = newChannel;
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from(TABLES.channels)
          .insert(toChannelRow(newChannel))
          .select('*')
          .single();
        const insertedChannel = requireData(data, error, 'Failed to create channel');
        const memberIds = normalizeUserIds(newChannel.users);
        if (memberIds.length > 0) {
          const { error: membershipError } = await supabase.rpc('set_chat_channel_members', {
            requested_channel_id: insertedChannel.id,
            requested_user_ids: memberIds,
          });
          if (membershipError) throw new Error(`Failed to assign channel users: ${membershipError.message}`);
        }
        persistedChannel = normalizeChannels([{ ...insertedChannel, users: memberIds }])[0];
      }
      const currentChannels = get().channels;
      const updatedChannels = currentChannels.some(channel => channel.id === persistedChannel.id)
        ? currentChannels.map(channel => channel.id === persistedChannel.id ? persistedChannel : channel)
        : [...currentChannels, persistedChannel];
      set({ channels: updatedChannels });
      saveChatDataToLocalStorage(updatedChannels, state.messages, state.sections);
      return persistedChannel;
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  // Update channel
  updateChannel: async (channelId, updates) => {
    const state = get();
    const existingChannel = state.channels.find(channel => channel.id === channelId);
    if (!existingChannel) return false;
    const nextChannel = { ...existingChannel, ...updates, id: existingChannel.id, type: 'text' };

    try {
      let persistedChannel = nextChannel;
      if (isSupabaseConfigured && supabase) {
        const row = toChannelRow(nextChannel);
        delete row.id;
        const { data, error } = await supabase
          .from(TABLES.channels)
          .update(row)
          .eq('id', channelId)
          .select('*')
          .single();
        persistedChannel = normalizeChannels([{
          ...requireData(data, error, 'Failed to update channel'),
          users: nextChannel.users,
        }])[0];
      }
      const updatedChannels = get().channels.map(channel =>
        channel.id === channelId ? persistedChannel : channel
      );
      set({ channels: updatedChannels });
      saveChatDataToLocalStorage(updatedChannels, state.messages, state.sections);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  // Delete channel
  deleteChannel: async (channelId) => {
    const state = get();
    if (!state.channels.some(channel => channel.id === channelId)) return false;

    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from(TABLES.channels)
          .delete()
          .eq('id', channelId)
          .select('id')
          .single();
        requireData(data, error, 'Failed to delete channel');
      }
    const updatedChannels = state.channels.filter(ch => ch.id !== channelId);
    const updatedMessages = { ...state.messages };
    delete updatedMessages[channelId];
    
    // If deleted channel was selected, clear selection
    if (state.selectedChannel === channelId) {
      set({ selectedChannel: null });
    }
    
    set({ channels: updatedChannels, messages: updatedMessages });
      saveChatDataToLocalStorage(updatedChannels, updatedMessages, state.sections);
      return true;
    } catch (error) {
      console.error(error);
      return false;
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
  updateChannelUsers: async (channelId, userIds) => {
    const state = get();
    
    // Normalize user IDs to ensure consistency (remove nulls, empty strings, normalize)
    const normalizedUserIds = [...new Set(
      (userIds || []).map(id => String(id).trim()).filter(Boolean)
    )];
    
    console.log('updateChannelUsers:', {
      channelId,
      originalUserIds: userIds,
      normalizedUserIds,
      channelName: state.channels.find(ch => ch.id === channelId)?.name
    });
    
    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.rpc('set_chat_channel_members', {
          requested_channel_id: channelId,
          requested_user_ids: normalizedUserIds,
        });
        if (error) throw new Error(`Failed to update channel users: ${error.message}`);
      }
      const updatedChannels = state.channels.map(ch =>
        ch.id === channelId ? { ...ch, users: normalizedUserIds } : ch
      );
      set({ channels: updatedChannels });
      saveChatDataToLocalStorage(updatedChannels, state.messages, state.sections);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  // Add a new section
  addSection: async (name, emoji = '📁') => {
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

    try {
      let persistedSection = newSection;
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase
          .from(TABLES.sections)
          .insert(newSection)
          .select('*')
          .single();
        persistedSection = requireData(data, error, 'Failed to create section');
      }
      const currentSections = get().sections;
      const nextSections = currentSections.some(section => section.id === persistedSection.id || section.name === persistedSection.name)
        ? currentSections.map(section => section.id === persistedSection.id || section.name === persistedSection.name ? persistedSection : section)
        : [...currentSections, persistedSection];
      set({ sections: nextSections });
      saveChatDataToLocalStorage(state.channels, state.messages, nextSections);
      console.log('Added section:', newSection);
      return true;
    } catch (error) {
      console.error('Failed to add section:', error);
      return false;
    }
  },

  // Update a section
  updateSection: async (oldName, newName, newEmoji) => {
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
          ...(typeof s === 'object' ? s : {}),
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

    try {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.rpc('rename_chat_section', {
          requested_old_name: oldName,
          requested_new_name: newName,
          requested_emoji: newEmoji || null,
        });
        if (error) throw new Error(`Failed to update section: ${error.message}`);
      }
      set({ sections: updatedSections, channels: updatedChannels });
      saveChatDataToLocalStorage(updatedChannels, state.messages, updatedSections);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  },

  // Delete a section
  deleteSection: async (sectionName) => {
    const state = get();
    let updatedChannels = state.channels;

    const updatedSections = state.sections.filter(s => {
      const sName = typeof s === 'string' ? s : s.name;
      return sName !== sectionName;
    });

    try {
      if (isSupabaseConfigured && supabase) {
        const { count, error: countError } = await supabase
          .from(TABLES.channels)
          .select('id', { count: 'exact', head: true })
          .eq('section_name', sectionName);
        if (countError) throw new Error(`Failed to verify section contents: ${countError.message}`);
        if ((count ?? 0) > 0) return false;

        const existingSection = state.sections.find(section => section.name === sectionName);
        const query = supabase.from(TABLES.sections).delete();
        const { data, error } = existingSection?.id
          ? await query.eq('id', existingSection.id).select('name').single()
          : await query.eq('name', sectionName).select('name').single();
        requireData(data, error, 'Failed to delete section');
      } else {
        const normalizedName = sectionName.trim().toLocaleLowerCase();
        const containsChannels = state.channels.some(channel =>
          String(channel.section || '').trim().toLocaleLowerCase() === normalizedName
        );
        if (containsChannels) return false;
      }
      updatedChannels = get().channels.filter(channel => channel.section !== sectionName);
      set({ sections: updatedSections, channels: updatedChannels });
      saveChatDataToLocalStorage(updatedChannels, state.messages, updatedSections);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
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
