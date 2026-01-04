import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, FolderPlus, Trash2, Edit2, Smile } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore.js';

const POPULAR_EMOJIS = ['🎬', '🎨', '💻', '📱', '🌐', '📊', '🎯', '🚀', '⚡', '🔥', '💡', '🎪', '🎭', '📝', '📚', '🔧', '⚙️', '🎮', '🎵', '🎤', '📸', '🎥', '🎞️', '🎬', '🎨', '🖌️', '✏️', '📐', '📏', '📌', '📍', '🗂️', '📁', '📂', '📋', '📄', '📃', '📑', '📊', '📈', '📉', '💼', '👔', '🎓', '🏆', '🥇', '🥈', '🥉'];

export default function SectionDialog({ onClose, sections: initialSections }) {
  const { addSection, deleteSection, updateSection, channels, sections } = useChatStore();
  const [newSectionName, setNewSectionName] = useState('');
  const [newSectionEmoji, setNewSectionEmoji] = useState('📁');
  const [editingSection, setEditingSection] = useState(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [error, setError] = useState('');

  const handleAddSection = (e) => {
    e.preventDefault();
    setError('');
    
    if (!newSectionName.trim()) {
      setError('Section name cannot be empty');
      return;
    }

    const trimmedName = newSectionName.trim();
    if (sections.some(s => s.name === trimmedName)) {
      setError('Section already exists');
      return;
    }

    const success = addSection(trimmedName, newSectionEmoji);
    if (success) {
      setNewSectionName('');
      setNewSectionEmoji('📁');
      setError('');
    } else {
      setError('Failed to add section');
    }
  };

  const handleEditSection = (section) => {
    setEditingSection(section);
    setEditName(section.name);
    setEditEmoji(section.emoji || '📁');
    setError('');
  };

  const handleSaveEdit = (oldName) => {
    setError('');
    
    if (!editName.trim()) {
      setError('Section name cannot be empty');
      return;
    }

    const trimmedName = editName.trim();
    if (sections.some(s => s.name === trimmedName && s.name !== oldName)) {
      setError('Section name already exists');
      return;
    }

    const success = updateSection(oldName, trimmedName, editEmoji);
    if (success) {
      setEditingSection(null);
      setEditName('');
      setEditEmoji('📁');
      setError('');
    } else {
      setError('Failed to update section');
    }
  };

  const handleCancelEdit = () => {
    setEditingSection(null);
    setEditName('');
    setEditEmoji('📁');
    setError('');
  };

  const handleDeleteSection = (sectionName) => {
    if (window.confirm(`Are you sure you want to delete the section "${sectionName}"? This can only be done if no channels use this section.`)) {
      const success = deleteSection(sectionName);
      if (!success) {
        alert('Cannot delete section. There are channels using this section. Please delete or move those channels first.');
      }
    }
  };

  const getChannelCount = (sectionName) => {
    return channels.filter(ch => ch.section === sectionName).length;
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-3 md:p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[#0a0a1a] border border-slate-800 rounded-xl w-full max-w-md shadow-2xl max-h-[95vh] sm:max-h-[90vh] flex flex-col mx-2 sm:mx-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <FolderPlus size={18} className="sm:w-5 sm:h-5 text-[#3b82f6]" />
            <h3 className="text-base sm:text-lg font-bold text-white">Manage Sections</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 rounded-lg transition-colors touch-manipulation"
          >
            <X size={18} className="sm:w-5 sm:h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin">
          {/* Add New Section */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Create New Section
            </label>
            <form onSubmit={handleAddSection} className="space-y-2">
              <div className="flex gap-2">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className="px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-2xl hover:bg-slate-700 transition-colors"
                    title="Select emoji"
                  >
                    {newSectionEmoji}
                  </button>
                  {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-2 w-64 h-48 bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-y-auto scrollbar-thin z-10 grid grid-cols-8 gap-2">
                      {POPULAR_EMOJIS.map((emoji, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setNewSectionEmoji(emoji);
                            setShowEmojiPicker(false);
                          }}
                          className="text-xl hover:bg-slate-700 rounded p-1 transition-colors"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  value={newSectionName}
                  onChange={(e) => {
                    setNewSectionName(e.target.value);
                    setError('');
                  }}
                  placeholder="e.g., Web Development"
                  className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg transition-colors font-medium"
                >
                  Add
                </button>
              </div>
              {error && (
                <p className="text-sm text-red-400">{error}</p>
              )}
            </form>
          </div>

          {/* Existing Sections */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Existing Sections
            </label>
            <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
              {sections.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No sections yet</p>
              ) : (
                sections.map((section) => {
                  const sectionName = typeof section === 'string' ? section : section.name;
                  const sectionEmoji = typeof section === 'object' ? (section.emoji || '📁') : '📁';
                  const channelCount = getChannelCount(sectionName);
                  const isEditing = editingSection?.name === sectionName;
                  
                  return (
                    <div
                      key={sectionName}
                      className="p-3 bg-slate-800/30 rounded-lg border border-slate-700"
                    >
                      {isEditing ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-2xl hover:bg-slate-600 transition-colors"
                              >
                                {editEmoji}
                              </button>
                              {showEmojiPicker && (
                                <div className="absolute top-full left-0 mt-2 w-64 h-48 bg-slate-800 border border-slate-700 rounded-lg p-3 overflow-y-auto scrollbar-thin z-10 grid grid-cols-8 gap-2">
                                  {POPULAR_EMOJIS.map((emoji, idx) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setEditEmoji(emoji);
                                        setShowEmojiPicker(false);
                                      }}
                                      className="text-xl hover:bg-slate-700 rounded p-1 transition-colors"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => {
                                setEditName(e.target.value);
                                setError('');
                              }}
                              className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6]"
                              autoFocus
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveEdit(sectionName)}
                              className="px-3 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded text-sm transition-colors"
                            >
                              Save
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-sm transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            <span className="text-2xl">{sectionEmoji}</span>
                            <div className="flex-1">
                              <div className="font-medium text-white">{sectionName}</div>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {channelCount} channel{channelCount !== 1 ? 's' : ''}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditSection(typeof section === 'object' ? section : { name: sectionName, emoji: sectionEmoji })}
                              className="p-2 text-blue-400 hover:bg-blue-600/20 rounded-lg transition-colors"
                              title="Edit section"
                            >
                              <Edit2 size={16} />
                            </button>
                            {channelCount === 0 && (
                              <button
                                onClick={() => handleDeleteSection(sectionName)}
                                className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                                title="Delete section"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-800 flex justify-end flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors w-full sm:w-auto"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
