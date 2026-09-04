import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, TABLES } from '../lib/supabase';
import { parseMentions } from '../utils/chatUtils';
import { useAppStore } from "../stores/appStore.js";

/**
 * Enhanced realtime chat hook with mentions, delivery status, and read receipts
 */
// Helper function to resolve avatar from allUsers and employees
function resolveUserAvatar(userId, userName, allUsers = [], employees = []) {
  console.log("🔍 Resolving avatar for:", { userId, userName, allUsersCount: allUsers?.length, employeesCount: employees?.length });
  
  // First, try to find in allUsers
  if (allUsers && allUsers.length > 0) {
    // Try to find user by ID first
    let foundUser = allUsers.find(u => {
      const uId = u.id || u.username;
      const searchId = userId;
      return uId === searchId || String(uId) === String(searchId);
    });
    
    // If not found by ID, try by name (case-insensitive)
    if (!foundUser && userName) {
      foundUser = allUsers.find(u => {
        const uName = (u.name || '').trim().toLowerCase();
        const searchName = userName.trim().toLowerCase();
        return uName === searchName;
      });
    }
    
    // If still not found, try by username
    if (!foundUser && userName) {
      foundUser = allUsers.find(u => {
        const uUsername = (u.username || '').trim().toLowerCase();
        const searchName = userName.trim().toLowerCase();
        return uUsername === searchName;
      });
    }
    
    if (foundUser) {
      const avatar = foundUser.avatar || 
                     foundUser.profile_picture || 
                     foundUser.profilePicture || 
                     foundUser.avatar_url || 
                     foundUser.avatarUrl;
      if (avatar) {
        console.log("✅ Found avatar in allUsers:", { name: foundUser.name, avatar });
        return avatar;
      } else {
        console.log("⚠️ User found but no avatar:", { name: foundUser.name, user: foundUser });
      }
    }
  }
  
  // If not found in users, try employees (matching by name or ID)
  if (employees && employees.length > 0 && userName) {
    const searchName = userName.trim().toLowerCase();
    const foundEmployee = employees.find(emp => {
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
                     foundEmployee.avatarUrl;
      if (avatar) {
        console.log("✅ Found avatar in employees:", { name: foundEmployee.name || foundEmployee.employee_name, avatar });
        return avatar;
      } else {
        console.log("⚠️ Employee found but no avatar:", { name: foundEmployee.name || foundEmployee.employee_name, employee: foundEmployee });
      }
    }
  }
  
  console.log("❌ No avatar found for:", { userId, userName });
  return null;
}

function resolveMessageUser(message, allUsers = [], employees = []) {
  const canonicalId = message.author_id;
  const canonicalUser = allUsers.find(user => String(user.id) === String(canonicalId));
  const name = canonicalUser?.name || canonicalUser?.user_id || canonicalUser?.username || 'Unknown user';
  const avatar = canonicalUser?.avatar
    || canonicalUser?.profile_picture
    || canonicalUser?.profilePicture
    || canonicalUser?.avatar_url
    || canonicalUser?.avatarUrl
    || resolveUserAvatar(canonicalId, name, allUsers, employees);

  return { id: canonicalId, name, avatar: avatar || null };
}

async function resolveAttachmentUrls(attachments) {
  if (!Array.isArray(attachments)) return null;
  return Promise.all(attachments.map(async attachment => {
    if (!attachment?.path) return attachment;
    const { data, error } = await supabase.storage
      .from('chat-files')
      .createSignedUrl(attachment.path, 3600);
    return { ...attachment, url: error ? null : data?.signedUrl || null };
  }));
}

export function useEnhancedRealtimeChat({ 
  roomName, 
  username, 
  userId, 
  userAvatar,
  allUsers = [],
  employees = []
}) {
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [deliveryStatuses, setDeliveryStatuses] = useState({}); // messageId -> status

  // Re-resolve avatars when allUsers or employees change
  useEffect(() => {
    if (messages.length > 0 && (allUsers.length > 0 || employees.length > 0)) {
      console.log("🔄 Re-resolving avatars for", messages.length, "messages");
      setMessages((current) => {
        let updated = false;
        const updatedMessages = current.map((msg) => {
          // Re-resolve avatar (even if one exists, in case user updated their avatar)
          const resolvedAvatar = resolveUserAvatar(msg.user.id, msg.user.name, allUsers, employees);
          if (resolvedAvatar && resolvedAvatar !== msg.user.avatar) {
            console.log("✅ Updating avatar for message:", msg.user.name, "->", resolvedAvatar);
            updated = true;
            return {
              ...msg,
              user: {
                ...msg.user,
                avatar: resolvedAvatar,
              },
            };
          }
          return msg;
        });
        return updated ? updatedMessages : current;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers.length, employees.length]);
  const channelRef = useRef(null);

  // Load message history from database (optimized for faster loading)
  useEffect(() => {
    if (!supabase || !roomName) {
      setIsLoading(false);
      return;
    }

    const loadMessages = async () => {
      try {
        setIsLoading(true);
        console.log("📚 Loading message history for:", roomName);

        // OPTIMIZATION: Load only recent messages first (last 50) for faster initial load
        // Then load older messages if needed (lazy loading)
        const { data, error } = await supabase
          .from(TABLES.messages)
          .select("*")
          .eq("channel_id", roomName)
          .order("created_at", { ascending: false })
          .limit(50); // Load last 50 messages first for faster display

        if (error) {
          console.error("❌ Error loading messages:", error);
          setIsLoading(false);
          return;
        }

        // Reverse to show oldest first (ascending order)
        const reversedData = data.reverse();

        // Transform database messages to match our format
        const formattedMessages = await Promise.all(reversedData.map(async (msg) => {
          // Resolve avatar from allUsers and employees if not present in message
          const resolvedUser = resolveMessageUser(msg, allUsers, employees);
          
          return {
            id: msg.id,
            content: msg.content,
            user: resolvedUser,
            createdAt: msg.created_at,
            mentions: msg.mentions || [],
            replyTo: msg.reply_to,
            deliveryStatus: msg.delivery_status || 'sent',
            readBy: msg.read_by || [],
            isEdited: msg.is_edited || false,
            editedAt: msg.edited_at,
            attachments: await resolveAttachmentUrls(msg.attachments),
          };
        }));

        console.log("✅ Loaded", formattedMessages.length, "messages (last 50)");
        
        // Set messages immediately - don't wait for all processing
        setMessages(formattedMessages);
        
        // Mark as loaded immediately after setting messages
        setIsLoading(false);
        
        // OPTIONAL: Load older messages in background if there are more than 50
        // This can be done asynchronously without blocking the UI
        if (data.length === 50) {
          // There might be more messages - load them in background
          setTimeout(async () => {
            try {
              const { data: olderData, error: olderError } = await supabase
                .from(TABLES.messages)
                .select("*")
                .eq("channel_id", roomName)
                .order("created_at", { ascending: true })
                .limit(200); // Load up to 200 more messages
              
              if (!olderError && olderData && olderData.length > 50) {
                // Only update if we got more messages
                const allFormattedMessages = await Promise.all(olderData.map(async (msg) => {
                  const resolvedUser = resolveMessageUser(msg, allUsers, employees);
                  return {
                    id: msg.id,
                    content: msg.content,
                    user: resolvedUser,
                    createdAt: msg.created_at,
                    mentions: msg.mentions || [],
                    replyTo: msg.reply_to,
                    deliveryStatus: msg.delivery_status || 'sent',
                    readBy: msg.read_by || [],
                    isEdited: msg.is_edited || false,
                    editedAt: msg.edited_at,
                    attachments: await resolveAttachmentUrls(msg.attachments),
                  };
                }));
                
                console.log("✅ Loaded additional", allFormattedMessages.length, "messages in background");
                setMessages(allFormattedMessages);
              }
            } catch (bgError) {
              console.warn("⚠️ Background message load failed (non-critical):", bgError);
            }
          }, 100); // Load older messages 100ms after initial display
        }
      } catch (error) {
        console.error("❌ Error in loadMessages:", error);
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [roomName, allUsers, employees]);

  // Setup realtime subscription
  useEffect(() => {
    let disposed = false;
    setIsConnected(false);

    if (!supabase || !roomName) {
      console.error("Supabase is not configured or roomName is missing");
      return;
    }

    // Clean up previous channel if it exists
    if (channelRef.current) {
      console.log("🧹 Cleaning up previous channel subscription");
      supabase.removeChannel(channelRef.current).catch(err => console.warn("Error removing channel:", err));
      channelRef.current = null;
    }

    const uniqueChannelName = `nexvoide-chat:${roomName}`;
    console.log("🔗 Creating realtime channel:", uniqueChannelName);

    const newChannel = supabase.channel(uniqueChannelName, {
      config: {
        presence: { key: '' }
      }
    });

    // Authenticated Postgres changes remain the source of truth. Once 005 is
    // enabled, message RLS filters these events by canonical channel access.
    newChannel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: TABLES.messages,
          filter: `channel_id=eq.${roomName}`,
        },
        async (payload) => {
          if (disposed) return;
          console.log("📨 New message from database:", payload.new);

          // Resolve avatar from allUsers and employees if not present in message
          const resolvedUser = resolveMessageUser(payload.new, allUsers, employees);
          
          const newMessage = {
            id: payload.new.id,
            content: payload.new.content,
            user: resolvedUser,
            createdAt: payload.new.created_at,
            mentions: payload.new.mentions || [],
            replyTo: payload.new.reply_to,
            deliveryStatus: payload.new.delivery_status || 'sent',
            readBy: payload.new.read_by || [],
            isEdited: payload.new.is_edited || false,
            editedAt: payload.new.edited_at,
            attachments: await resolveAttachmentUrls(payload.new.attachments),
          };

          setMessages((current) => {
            const exists = current.some((msg) => msg.id === newMessage.id);
            if (exists) {
              return current;
            }
            console.log("✅ Adding new message:", newMessage.id);
            return [...current, newMessage];
          });

          // Update delivery status to 'delivered' for messages sent by current user
          if (newMessage.user.id === userId) {
            setTimeout(async () => {
              try {
                await supabase
                  .from(TABLES.messages)
                  .update({ delivery_status: 'delivered' })
                  .eq('id', newMessage.id);
              } catch (e) {
                console.warn('Failed to update delivery status:', e);
              }
            }, 100);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: TABLES.messages,
          filter: `channel_id=eq.${roomName}`,
        },
        async (payload) => {
          if (disposed) return;
          const resolvedAttachments = await resolveAttachmentUrls(payload.new.attachments);
          // Update message delivery status or read receipts
          setMessages((current) =>
            current.map((msg) => {
              if (msg.id === payload.new.id) {
                // Resolve avatar if it was updated or missing
                const resolvedAvatar = msg.user.avatar ||
                  resolveUserAvatar(payload.new.author_id || msg.user.id, msg.user.name, allUsers, employees);
                
                return {
                  ...msg,
                  user: {
                    ...msg.user,
                    avatar: resolvedAvatar,
                  },
                  deliveryStatus: payload.new.delivery_status || msg.deliveryStatus,
                  readBy: payload.new.read_by || msg.readBy,
                  content: payload.new.content || msg.content,
                  isEdited: payload.new.is_edited || msg.isEdited,
                  editedAt: payload.new.edited_at || msg.editedAt,
                  attachments: resolvedAttachments || msg.attachments || null,
                };
              }
              return msg;
            })
          );
        }
      )
      .subscribe((status, err) => {
        if (disposed) return;

        console.log("🔌 Channel status for", uniqueChannelName, ":", status);
        if (err) {
          console.error("❌ Channel subscription error:", err);
          setIsConnected(false);
          return;
        }
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          console.log("✅ Successfully subscribed to channel:", uniqueChannelName);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          setIsConnected(false);
          console.error("❌ Channel error or closed:", status);
        } else {
          // For other statuses like "JOINED", also mark as connected for faster UI
          if (status === "JOINED") {
            setIsConnected(true);
            console.log("✅ Channel joined:", uniqueChannelName);
          } else {
            setIsConnected(false);
          }
        }
      });

    channelRef.current = newChannel;
    setChannel(newChannel);

    return () => {
      disposed = true;
      console.log("🧹 Cleaning up channel:", uniqueChannelName);
      if (channelRef.current === newChannel) {
        channelRef.current = null;
      }
      supabase.removeChannel(newChannel).catch(err => console.warn("Error removing channel:", err));
    };
  }, [roomName, userId]);

  const sendMessage = useCallback(
    async (content, replyToId = null, attachments = []) => {
      if (!supabase || !isConnected) {
        console.log("❌ Cannot send: Supabase not available or not connected");
        return;
      }

      if (!content?.trim() && (!attachments || attachments.length === 0)) {
        console.log("❌ Cannot send empty message without attachments");
        return;
      }

      console.log("📤 Saving message to database for room:", roomName);

      try {
        // Parse mentions from content
        const mentions = parseMentions(content || '', allUsers);

        // Process attachments - get public URLs
        let attachmentData = null;
        if (attachments && attachments.length > 0) {
          attachmentData = await Promise.all(
            attachments.map(async (file) => {
              if (file.uploadPath) {
                return {
                  name: file.name,
                  url: file.url || null,
                  path: file.uploadPath,
                  type: file.type || 'application/octet-stream',
                  size: file.size || 0,
                };
              }
              return null;
            })
          );
          attachmentData = attachmentData.filter(Boolean);
        }

        // Prepare message content (text only, attachments are rendered separately in UI)
        const messageContent = (content || '').trim();

        // Resolve avatar from allUsers and employees if not provided
        const resolvedAvatar = userAvatar || resolveUserAvatar(userId, username, allUsers, employees);
        const optimisticId = crypto.randomUUID();
        const optimisticCreatedAt = new Date().toISOString();
        
        const messageData = {
          id: optimisticId,
          // Content is required in base schema; allow empty string when sending attachments-only messages
          content: messageContent || '',
          channel_id: roomName,
          author_id: userId,
          created_at: optimisticCreatedAt,
        };

        const optimisticMessage = {
          id: optimisticId,
          content: messageContent,
          user: { id: userId, name: username, avatar: resolvedAvatar },
          createdAt: optimisticCreatedAt,
          mentions,
          replyTo: replyToId,
          deliveryStatus: 'sending',
          readBy: [],
          isEdited: false,
          editedAt: null,
          attachments: attachmentData,
        };

        setMessages(current => [...current, optimisticMessage]);

        console.log("📤 Inserting message data (basic):", messageData);

        // Try to insert with basic fields first
        let { data, error } = await supabase
          .from(TABLES.messages)
          .insert(messageData)
          .select()
          .single();

        // If basic insert succeeds, try to update with extended fields
        if (!error && data) {
          const updateData = {};
          if (mentions.length > 0) {
            updateData.mentions = mentions;
          }
          if (replyToId) {
            updateData.reply_to = replyToId;
          }
          if (attachmentData && attachmentData.length > 0) {
            updateData.attachments = attachmentData;
          }
          updateData.delivery_status = 'sent';

          // Try to update with extended fields (will fail silently if columns don't exist)
          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from(TABLES.messages)
              .update(updateData)
              .eq('id', data.id);
            
            if (updateError) {
              console.warn('⚠️ Extended fields not available. Run supabase-chat-messages-migration.sql to enable full features:', updateError.message);
            } else {
              // Reload the message with extended fields
              const { data: updatedData } = await supabase
                .from(TABLES.messages)
                .select('*')
                .eq('id', data.id)
                .single();
              if (updatedData) data = updatedData;
            }
          }
        }

        if (error) {
          setMessages(current => current.filter(message => message.id !== optimisticId));
          console.error("❌ Error saving message:", error);
          console.error("❌ Error details:", {
            message: error.message,
            details: error.details,
            hint: error.hint,
            code: error.code,
          });
          alert(`Failed to send message: ${error.message || 'Unknown error'}`);
          return;
        }

        console.log("✅ Message saved to database:", data.id);

        const confirmedMessage = {
          id: data.id,
          content: data.content,
          user: {
            ...resolveMessageUser(data, allUsers, employees),
          },
          createdAt: data.created_at,
          mentions: data.mentions || mentions,
          replyTo: data.reply_to || replyToId,
          deliveryStatus: data.delivery_status || 'sent',
          readBy: data.read_by || [],
          isEdited: data.is_edited || false,
          editedAt: data.edited_at || null,
          attachments: data.attachments || attachmentData,
        };

        setMessages(current =>
          current.some(message => message.id === confirmedMessage.id)
            ? current.map(message => message.id === confirmedMessage.id ? confirmedMessage : message)
            : [...current, confirmedMessage]
        );

        // Create mention records for mentioned users
        if (mentions.length > 0) {
          const mentionRecords = mentions.map(mentionedUserId => ({
            user_id: mentionedUserId,
            message_id: data.id,
            channel_id: roomName,
            mentioned_by: userId,
            is_read: false,
          }));

          await supabase
            .from('user_mentions')
            .insert(mentionRecords);
        }

        // Update unread count for all users in channel (except sender)
        // This will be handled by the unread messages hook
      } catch (error) {
        console.error("❌ Error in sendMessage:", error);
      }
    },
    [supabase, isConnected, roomName, userId, username, userAvatar, allUsers]
  );

  // Mark message as read
  const markAsRead = useCallback(async (messageId) => {
    if (!supabase || !userId || !messageId) return;

    try {
      // Get current message
      const { data: message, error: fetchError } = await supabase
        .from(TABLES.messages)
        .select('read_by')
        .eq('id', messageId)
        .single();

      if (fetchError || !message) return;

      const readBy = message.read_by || [];
      if (readBy.includes(userId)) return; // Already read

      // Add user to read_by array
      const updatedReadBy = [...readBy, userId];

      const { error: readError } = await supabase.rpc('mark_chat_message_read', {
        requested_message_id: messageId,
      });
      if (readError) throw readError;

      // Update local state
      setMessages((current) =>
        current.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                readBy: updatedReadBy,
                deliveryStatus: 'read',
              }
            : msg
        )
      );
    } catch (e) {
      console.warn('Failed to mark message as read:', e);
    }
  }, [supabase, userId]);

  // Update message (for editing)
  const updateMessage = useCallback(async (messageId, newContent, attachments = []) => {
    if (!supabase || !messageId) {
      console.log("❌ Cannot update: Supabase not available or no message ID");
      return;
    }

    if (!newContent?.trim() && (!attachments || attachments.length === 0)) {
      console.log("❌ Cannot update with empty content");
      return;
    }

    console.log("✏️ Updating message:", messageId);

    try {
      // Process attachments if provided
      let attachmentData = null;
      if (attachments && attachments.length > 0) {
        attachmentData = await Promise.all(
          attachments.map(async (file) => {
            if (file.uploadPath) {
              return {
                name: file.name,
                url: file.url || null,
                path: file.uploadPath,
                type: file.type || 'application/octet-stream',
                size: file.size || 0,
              };
            }
            return null;
          })
        );
        attachmentData = attachmentData.filter(Boolean);
      }

      // Prepare update data
      const updateData = {
        content: newContent?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      // Add extended fields if available
      if (attachmentData && attachmentData.length > 0) {
        updateData.attachments = attachmentData;
      }
      updateData.is_edited = true;
      updateData.edited_at = new Date().toISOString();

      console.log("✏️ Updating message with data:", updateData);

      // Update message in database
      const { data, error } = await supabase
        .from(TABLES.messages)
        .update(updateData)
        .eq('id', messageId)
        .select()
        .single();

      if (error) {
        console.error("❌ Error updating message:", error);
        console.error("❌ Error details:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code,
        });
        alert(`Failed to update message: ${error.message || 'Unknown error'}`);
        return;
      }

      console.log("✅ Message updated:", data.id);

      // Update local state immediately
      setMessages((current) =>
        current.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                content: data.content || msg.content,
                attachments: data.attachments || msg.attachments || null,
                isEdited: true,
                editedAt: data.edited_at || new Date().toISOString(),
              }
            : msg
        )
      );
    } catch (error) {
      console.error("❌ Error in updateMessage:", error);
    }
  }, [supabase]);

  return { 
    messages, 
    sendMessage, 
    isConnected, 
    isLoading,
    markAsRead,
    updateMessage,
    deliveryStatuses,
  };
}
