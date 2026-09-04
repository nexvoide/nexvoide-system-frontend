import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Plus, ChevronDown, ChevronRight, Video, Palette, Users, FolderPlus, GripVertical, Trash2, Search, X } from 'lucide-react';
import { useAppStore } from '../../stores/appStore.js';
import { useUnreadMessages } from '../../hooks/useUnreadMessages.js';

// Legacy icon mapping (for fallback)
const sectionIcons = {
  'Video Editing': Video,
  'Graphic Designing': Palette,
};

export default function ChatSidebar({
  channels,
  sections,
  selectedChannel,
  onSelectChannel,
  isAdmin,
  onCreateChannel,
  onManageUsers,
  onCreateSection,
  onReorderSections,
  onReorderChannels,
  onDeleteChannel,
  onDeleteSection,
  allUsers = [],
  employees = [],
  onClose,
}) {
  const { user } = useAppStore();
  const { unreadCounts, mentionCounts, hasUnread, hasMentions } = useUnreadMessages(channels, selectedChannel);
  
  const [expandedSections, setExpandedSections] = useState(
    sections.reduce((acc, section) => {
      const sectionName = typeof section === 'string' ? section : section.name;
      acc[sectionName] = true;
      return acc;
    }, {})
  );

  const [draggedSection, setDraggedSection] = useState(null);
  const [draggedChannel, setDraggedChannel] = useState(null);
  const [dragOverSection, setDragOverSection] = useState(null);
  const [dragOverChannel, setDragOverChannel] = useState(null);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getChannelsForSection = (section) => {
    return channels
      .filter(ch => ch.section === section)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  };

  // Section drag handlers
  const handleSectionDragStart = (e, sectionName) => {
    if (!isAdmin) return;
    setDraggedSection(sectionName);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sectionName);
  };

  const handleSectionDragOver = (e, sectionName) => {
    if (!isAdmin || !draggedSection || draggedSection === sectionName) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverSection(sectionName);
  };

  const handleSectionDragLeave = () => {
    setDragOverSection(null);
  };

  const handleSectionDrop = async (e, targetSectionName) => {
    if (!isAdmin || !draggedSection || draggedSection === targetSectionName) return;
    e.preventDefault();
    e.stopPropagation();
    
    const currentOrder = sections.map(s => typeof s === 'string' ? s : s.name);
    const draggedIndex = currentOrder.indexOf(draggedSection);
    const targetIndex = currentOrder.indexOf(targetSectionName);
    
    if (draggedIndex === -1 || targetIndex === -1) {
      console.warn('Section not found in current order');
      setDraggedSection(null);
      setDragOverSection(null);
      return;
    }
    
    // Reorder array
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedSection);
    
    console.log('Reordering sections:', {
      dragged: draggedSection,
      target: targetSectionName,
      draggedIndex,
      targetIndex,
      currentOrder,
      newOrder
    });
    
    if (onReorderSections) {
      const success = await onReorderSections(newOrder);
      if (!success) window.alert('Failed to save section order. Please try again.');
    } else {
      console.warn('onReorderSections callback not provided');
    }
    
    setDraggedSection(null);
    setDragOverSection(null);
  };

  // Channel drag handlers
  const handleChannelDragStart = (e, channelId, sectionName) => {
    if (!isAdmin) return;
    setDraggedChannel({ id: channelId, section: sectionName });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', channelId);
  };

  const handleChannelDragOver = (e, channelId, sectionName) => {
    if (!isAdmin || !draggedChannel || draggedChannel.id === channelId || draggedChannel.section !== sectionName) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverChannel(channelId);
  };

  const handleChannelDragLeave = () => {
    setDragOverChannel(null);
  };

  const handleChannelDrop = async (e, targetChannelId, sectionName) => {
    if (!isAdmin || !draggedChannel || draggedChannel.id === targetChannelId || draggedChannel.section !== sectionName) return;
    e.preventDefault();
    
    const sectionChannels = getChannelsForSection(sectionName);
    const currentOrder = sectionChannels.map(ch => ch.id);
    const draggedIndex = currentOrder.indexOf(draggedChannel.id);
    const targetIndex = currentOrder.indexOf(targetChannelId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedChannel(null);
      setDragOverChannel(null);
      return;
    }
    
    // Reorder array
    const newOrder = [...currentOrder];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedChannel.id);
    
    const success = await onReorderChannels(sectionName, newOrder);
    if (!success) window.alert('Failed to save channel order. Please try again.');
    setDraggedChannel(null);
    setDragOverChannel(null);
  };

  return (
    <div className="w-[330px] md:w-[300px] lg:w-[320px] max-w-[84vw] h-full bg-[#080d18] border-r border-slate-400/10 flex flex-col">
      {/* Header */}
      <div className="h-20 px-6 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-3">
          <span className="hidden md:flex w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-400/15 items-center justify-center">
            <Hash size={18} className="text-blue-400" />
          </span>
          Conversations
        </h2>
        <button onClick={onClose} className="md:hidden w-10 h-10 rounded-[10px] bg-[#0c1423] border border-[#1b283d] flex items-center justify-center" aria-label="Close conversations"><X size={18} /></button>
      </div>

      <div className="px-4 pb-3">
        <div className="h-11 rounded-xl bg-[#0d1422] border border-slate-400/10 flex items-center gap-3 px-3 text-xs text-[#94a3b8]">
          <Search size={15} />
          <span>Search channels</span>
        </div>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin py-1 px-4">
        {sections.map((section) => {
          const sectionName = typeof section === 'string' ? section : section.name;
          const sectionEmoji = typeof section === 'object' ? section.emoji : null;
          const sectionChannels = getChannelsForSection(sectionName);
          const isExpanded = expandedSections[sectionName];
          const Icon = sectionIcons[sectionName] || Hash;
          const isDragging = draggedSection === sectionName;
          const isDragOver = dragOverSection === sectionName;

          if (sectionChannels.length === 0 && !isAdmin) return null;

          return (
            <div 
              key={sectionName} 
              className={`mb-2 ${
                isDragOver ? 'border-t-2 border-[#3b82f6] -mt-0.5' : ''
              } ${isDragging ? 'opacity-50' : ''}`}
              draggable={isAdmin}
              onDragStart={(e) => handleSectionDragStart(e, sectionName)}
              onDragOver={(e) => handleSectionDragOver(e, sectionName)}
              onDragLeave={handleSectionDragLeave}
              onDrop={(e) => handleSectionDrop(e, sectionName)}
              onDragEnd={() => {
                setDraggedSection(null);
                setDragOverSection(null);
              }}
            >
              {/* Section Header */}
              <div
                className={`relative group ${isDragging ? 'opacity-50' : ''}`}
              >
                {isAdmin && (
                  <div className="absolute left-0 top-0 bottom-0 flex items-center px-1 cursor-move opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <GripVertical size={14} className="text-slate-500" />
                  </div>
                )}
                <div className="flex items-center">
                  <button
                    onClick={() => toggleSection(sectionName)}
                    className={`flex-1 min-h-10 px-2 py-2 flex items-center gap-2 text-[#8ea0b8] hover:text-white rounded-lg transition-colors uppercase tracking-[.08em] text-[11px] ${
                      isAdmin ? 'pl-6' : ''
                    }`}
                  >
                    {isExpanded ? (
                      <ChevronDown size={16} className="group-hover:text-[#3b82f6]" />
                    ) : (
                      <ChevronRight size={16} className="group-hover:text-[#3b82f6]" />
                    )}
                    {sectionEmoji ? (
                      <span className="text-lg">{sectionEmoji}</span>
                    ) : (
                      <Icon size={16} />
                    )}
                    <span className="text-sm font-semibold flex-1 text-left">{sectionName}</span>
                  </button>
                  {isAdmin && onDeleteSection && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const channelCount = sectionChannels.length;
                        if (channelCount > 0) {
                          window.alert(`Move or delete the ${channelCount} channel${channelCount !== 1 ? 's' : ''} in "${sectionName}" before deleting this section.`);
                        } else {
                          if (window.confirm(`Delete section "${sectionName}"?`)) {
                            onDeleteSection(sectionName);
                          }
                        }
                      }}
                      className="px-2 py-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 opacity-0 group-hover:opacity-100 transition-all rounded-lg mr-1"
                      title="Delete section"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Section Channels */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {sectionChannels.map((channel, index) => {
                      const isChannelDragging = draggedChannel?.id === channel.id;
                      const isChannelDragOver = dragOverChannel === channel.id;
                      
                      return (
                        <div
                          key={channel.id}
                          draggable={isAdmin}
                          onDragStart={(e) => handleChannelDragStart(e, channel.id, sectionName)}
                          onDragOver={(e) => handleChannelDragOver(e, channel.id, sectionName)}
                          onDragLeave={handleChannelDragLeave}
                          onDrop={(e) => handleChannelDrop(e, channel.id, sectionName)}
                          onDragEnd={() => {
                            setDraggedChannel(null);
                            setDragOverChannel(null);
                          }}
                          className={`relative ${
                            isChannelDragOver ? 'border-t-2 border-[#3b82f6]' : ''
                          } ${isChannelDragging ? 'opacity-50' : ''}`}
                        >
                          {isAdmin && (
                            <div className="absolute left-0 top-0 bottom-0 flex items-center px-1 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                              <GripVertical size={12} className="text-slate-500" />
                            </div>
                          )}
                          <button
                            onClick={() => {
                              if (onSelectChannel) {
                                onSelectChannel(channel.id);
                              }
                            }}
                            className={`w-full min-h-10 px-3 py-2 flex items-center gap-2.5 text-sm transition-colors duration-150 group relative rounded-[10px] ${
                              selectedChannel === channel.id
                                ? 'bg-[#12325f] text-[#eaf2ff]'
                                : 'text-[#b8c7de] hover:text-white hover:bg-white/[0.035]'
                            } ${isAdmin ? 'pl-8' : ''}`}
                          >
                            <Hash size={14} className={selectedChannel === channel.id ? 'text-[#3b82f6]' : ''} />
                            <span className="flex-1 text-left truncate">{channel.name}</span>
                            
                            {/* Unread/Mention Badges */}
                            <div className="flex items-center gap-1">
                              {hasMentions(channel.id) && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="bg-yellow-500 text-yellow-900 text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5"
                                  title={`${mentionCounts[channel.id] || 0} mention(s)`}
                                >
                                  {mentionCounts[channel.id] > 99 ? '99+' : mentionCounts[channel.id]}
                                </motion.span>
                              )}
                              {hasUnread(channel.id) && (
                                <motion.span
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  className="bg-[#3b82f6] text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1.5"
                                  title={`${unreadCounts[channel.id] || 0} unread message(s)`}
                                >
                                  {unreadCounts[channel.id] > 99 ? '99+' : unreadCounts[channel.id]}
                                </motion.span>
                              )}
                            </div>
                            
                            {isAdmin && selectedChannel === channel.id && (
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onManageUsers(channel);
                                  }}
                                  className="p-1 hover:bg-slate-700 rounded transition-colors"
                                  title="Manage Users"
                                >
                                  <Users size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(`Are you sure you want to delete "${channel.name}"? This action cannot be undone.`)) {
                                      onDeleteChannel(channel.id);
                                    }
                                  }}
                                  className="p-1 hover:bg-red-600/20 hover:text-red-400 rounded transition-colors"
                                  title="Delete Channel"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </button>
                          
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Admin Actions (Admin Only) */}
      {isAdmin && (
        <div className="p-4 border-t border-slate-400/10 space-y-3 bg-transparent">
          <button
            onClick={onCreateSection}
            className="w-full px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 rounded-xl flex items-center gap-2 transition-colors font-medium text-sm"
          >
            <FolderPlus size={16} />
            Manage Sections
          </button>
          <button
            onClick={onCreateChannel}
            className="w-full px-4 py-2.5 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-400/15 text-blue-300 rounded-xl flex items-center gap-2 transition-colors font-medium text-sm"
          >
            <Plus size={16} />
            Create Channel
          </button>
        </div>
      )}
    </div>
  );
}
