import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Reply, MoreVertical, Edit2, Trash2, File, Download } from "lucide-react";
import { cn } from "../../lib/utils";
import { parseMessageParts } from "../../utils/chatUtils";
import { useAppStore } from "../../stores/appStore.js";
import Avatar from "../Avatar";

export const ChatMessageItem = ({ 
  message, 
  isOwnMessage, 
  showHeader,
  replyToMessage = null,
  allUsers = [],
  onReply = null,
  onEdit = null,
  onDelete = null,
}) => {
  const { user } = useAppStore();
  const [showActions, setShowActions] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const deliveryStatus = message.deliveryStatus || 'sent';
  const isMentioned = message.mentions && message.mentions.includes(user?.id || user?.username);
  const isRead = deliveryStatus === 'read' || (message.readBy && message.readBy.length > 0);
  const hasAttachments = Array.isArray(message.attachments) && message.attachments.length > 0;

  const messageIdentity = String(message.user?.id || message.user?.username || '').trim().toLowerCase();
  const messageUser = allUsers.find(candidate => {
    const identities = [
      candidate.id,
      candidate.userId,
      candidate.user_id,
      candidate.username,
    ].filter(Boolean).map(value => String(value).trim().toLowerCase());

    return messageIdentity && identities.includes(messageIdentity);
  });
  const senderName = messageUser?.name || message.user?.name || messageUser?.username || 'Unknown';

  // Render delivery status ticks
  const renderTicks = () => {
    if (!isOwnMessage) return null;

    if (isRead) {
      return <CheckCheck size={14} className="text-blue-400" />; // Blue double tick (read)
    } else if (deliveryStatus === 'delivered') {
      return <CheckCheck size={14} className="text-slate-400" />; // Gray double tick (delivered)
    } else {
      return <Check size={14} className="text-slate-400" />; // Single tick (sent)
    }
  };

  // Parse message parts for mention highlighting
  const messageParts = parseMessageParts(
    message.content,
    user?.id || user?.username,
    allUsers
  );

  return (
    <motion.div
      className={`flex group ${showHeader ? 'mt-4' : 'mt-1'} ${isOwnMessage ? "justify-end" : "justify-start"} px-0`}
      initial={{ opacity: 0, y: 8 }}
      animate={isMentioned ? { 
        opacity: 1, 
        y: 0,
        scale: [1, 1.01, 1]
      } : { 
        opacity: 1, 
        y: 0 
      }}
      transition={isMentioned ? { 
        duration: 0.4,
        ease: "easeOut"
      } : { 
        duration: 0.2,
        ease: "easeOut"
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {!isOwnMessage && (
        <div className={`flex-shrink-0 mr-3 ${showHeader ? '' : 'invisible'}`}>
          <Avatar
            src={message.user.avatar}
            name={message.user.name}
            size="sm"
          />
        </div>
      )}
      
      <div className={cn("min-w-0 max-w-[calc(100%-48px)] sm:max-w-[72%] md:max-w-[68%] flex flex-col", {
          "items-end": isOwnMessage,
        })}>
        {/* Header with sender name and timestamp */}
        {showHeader && (
          <div className={cn("flex items-center gap-2 mb-1.5 px-1", {
            "justify-end": isOwnMessage,
            })}>
            <span className='font-medium text-slate-200 text-xs sm:text-sm'>
              {senderName}
            </span>
            <span className='text-slate-400 text-xs'>
              {new Date(message.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
              {', '}
              {new Date(message.createdAt).toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
            {message.isEdited && (
              <span className="text-slate-500 text-[10px] italic">(edited)</span>
            )}
          </div>
        )}
        
        {/* Reply indicator with vertical line */}
        {message.replyTo && replyToMessage && (
          <div className={cn("flex items-start gap-2 mb-1", {
            "justify-end": isOwnMessage,
          })}>
            <div className="w-0.5 h-8 bg-slate-600 rounded-full mt-1"></div>
            <div className="text-xs text-slate-400">
              <div className="font-medium text-slate-300">{replyToMessage.user.name}</div>
              <div className="truncate max-w-[300px] text-slate-500">{replyToMessage.content}</div>
            </div>
          </div>
        )}
        
        <div className="relative">
        <div
          className={cn(
              "py-3 px-4 rounded-[14px] text-sm w-fit max-w-full break-words relative group/message transition-all duration-150 border overflow-hidden",
            hasAttachments && "max-w-[560px]",
            isOwnMessage
              ? hasAttachments
                ? "bg-transparent text-white border-transparent rounded-none p-0"
                : "bg-[#12366a] text-white border-[#1f59a8]/80 rounded-br-[4px]"
                : isMentioned
                ? "bg-slate-800/90 text-white border-yellow-500/35 rounded-bl-md"
                : "bg-[#0d1726] text-white border-[#1b283d]/80 rounded-bl-[4px]"
            )}>
            {/* Message content */}
            {message.content && (
              <div className="whitespace-pre-wrap leading-relaxed">
                {messageParts.map((part, idx) => {
                  if (part.type === 'mention') {
                    return (
                      <span
                        key={`mention-${idx}`}
                        className={part.isMentioned ? 'text-yellow-300 font-semibold' : 'text-blue-400 font-medium'}
                      >
                        {part.content}
                      </span>
                    );
                  }
                  return <span key={`text-${idx}`} className="text-white">{part.content}</span>;
                })}
              </div>
            )}

            {/* Attachments */}
            {message.attachments && Array.isArray(message.attachments) && message.attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {message.attachments.map((attachment, idx) => {
                  const isImage = attachment.type && attachment.type.startsWith('image/');
                  const isVideo = attachment.type && attachment.type.startsWith('video/');
                  
                  return (
                    <div key={idx} className="max-w-[560px] rounded-xl overflow-hidden border border-slate-400/15 bg-[#0d1422]">
                      {isImage ? (
                        <a href={attachment.url} target="_blank" rel="noopener noreferrer" className="block">
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="block w-full h-auto max-h-96 object-contain cursor-pointer hover:opacity-90 transition-opacity bg-[#060912]"
                          />
                        </a>
                      ) : isVideo ? (
                        <video
                          src={attachment.url}
                          controls
                          className="max-w-full max-h-96"
                        >
                          Your browser does not support the video tag.
                        </video>
                      ) : (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-slate-600 flex items-center justify-center flex-shrink-0">
                            <File size={20} className="text-slate-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate font-medium">{attachment.name}</p>
                            {attachment.size && (
                              <p className="text-xs text-slate-400">
                                {(attachment.size / 1024).toFixed(1)} KB
                              </p>
                            )}
                          </div>
                          <Download size={16} className="text-slate-400 flex-shrink-0" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Message actions (hover) */}
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  "absolute top-0 flex items-center gap-0.5 bg-slate-900/95 backdrop-blur-sm rounded-xl p-1 shadow-2xl border border-slate-700/50 z-10",
                  isOwnMessage ? "left-full ml-2" : "right-full mr-2"
                )}
              >
                {onReply && (
                  <button
                    onClick={() => onReply(message)}
                    className="p-2 hover:bg-slate-700/80 rounded-lg transition-all duration-150 hover:scale-110"
                    title="Reply"
                  >
                    <Reply size={14} className="text-slate-300" />
                  </button>
                )}
                {isOwnMessage && onEdit && (
                  <button
                    onClick={() => onEdit(message)}
                    className="p-2 hover:bg-slate-700/80 rounded-lg transition-all duration-150 hover:scale-110"
                    title="Edit"
                  >
                    <Edit2 size={14} className="text-slate-300" />
                  </button>
                )}
                {isOwnMessage && onDelete && (
                  <button
                    onClick={() => onDelete(message)}
                    className="p-2 hover:bg-red-600/80 rounded-lg transition-all duration-150 hover:scale-110"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-red-300" />
                  </button>
                )}
              </motion.div>
            )}
          </div>

          {/* Delivery status and timestamp for own messages */}
          {isOwnMessage && (
            <div className="flex items-center gap-1 mt-1.5 justify-end">
              {renderTicks()}
              <span className="text-[10px] text-slate-400">
                {new Date(message.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
                {', '}
                {new Date(message.createdAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true,
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
