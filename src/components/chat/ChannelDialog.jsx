import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Hash, Edit2, FolderPlus } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore.js';

export default function ChannelDialog({ onClose, editing, sections, userId, onCreateSection }) {
  const { createChannel, updateChannel, deleteChannel } = useChatStore();
  
  // Helper to get section name (handle both string and object formats)
  const getSectionName = (sec) => {
    if (!sec) return '';
    if (typeof sec === 'string') return sec;
    return sec.name || '';
  };
  
  // Get default section name
  const getDefaultSection = () => {
    if (!sections || sections.length === 0) return '';
    return getSectionName(sections[0]);
  };
  
  const [name, setName] = useState(editing?.name || '');
  const [section, setSection] = useState(editing?.section ? getSectionName(editing.section) : getDefaultSection());
  const [description, setDescription] = useState(editing?.description || '');
  const [readOnly, setReadOnly] = useState(editing?.readOnly || false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Update form when editing changes
  useEffect(() => {
    const defaultSectionName = getDefaultSection();
    if (editing) {
      setName(editing.name || '');
      setSection(editing.section ? getSectionName(editing.section) : defaultSectionName);
      setDescription(editing.description || '');
      setReadOnly(editing.readOnly || false);
    } else {
      setName('');
      setSection(defaultSectionName);
      setDescription('');
      setReadOnly(false);
    }
  }, [editing, sections]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = originalStyle;
      document.body.style.position = '';
      document.body.style.width = '';
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      alert('Channel name is required');
      return;
    }
    
    // Ensure section is a string, not an object
    const sectionName = typeof section === 'string' ? section : (section?.name || getDefaultSection());
    
    if (!sectionName) {
      alert('Please select a section');
      return;
    }

    setIsSaving(true);
    const success = editing
      ? await updateChannel(editing.id, {
        name: name.trim(),
        section: sectionName,
        description: description.trim(),
        readOnly,
        type: 'text',
        userLimit: null,
      })
      : await createChannel({
        name: name.trim(),
        section: sectionName,
        description: description.trim(),
        readOnly,
        type: 'text',
        userLimit: null,
        createdBy: userId,
      });
    setIsSaving(false);

    if (!success) {
      setError(`Failed to ${editing ? 'update' : 'create'} channel. Verify that the Phase 1 database migration has been applied.`);
      return;
    }
    onClose();
  };

  const handleDelete = async () => {
    if (editing) {
      setIsSaving(true);
      const success = await deleteChannel(editing.id);
      setIsSaving(false);
      if (!success) {
        setError('Failed to delete channel. Please try again.');
        return;
      }
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start sm:items-center justify-center p-0 sm:p-2 md:p-4 overflow-y-auto">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative bg-[#0a0a1a] border-0 sm:border border-slate-800 rounded-none sm:rounded-xl w-full max-w-md shadow-2xl min-h-full sm:min-h-0 max-h-full sm:max-h-[90vh] overflow-hidden flex flex-col my-0 sm:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800 flex items-center justify-between flex-shrink-0 sticky top-0 bg-[#0a0a1a] z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            {editing ? <Edit2 size={18} className="sm:w-5 sm:h-5 text-[#3b82f6]" /> : <Hash size={18} className="sm:w-5 sm:h-5 text-[#3b82f6]" />}
            <h3 className="text-base sm:text-lg font-bold text-white">
              {editing ? 'Edit Channel' : 'Create Channel'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <X size={18} className="sm:w-5 sm:h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 scrollbar-thin pb-safe">
          {/* Channel Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Channel Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Important Discussion"
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
              required
              autoFocus
            />
          </div>

          {/* Section */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Section
            </label>
            <div className="flex gap-2">
              <select
                value={section}
                onChange={(e) => setSection(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
              >
                {sections.map((sec) => {
                  const sectionName = typeof sec === 'string' ? sec : sec.name;
                  const sectionEmoji = typeof sec === 'object' ? (sec.emoji || '📁') : '📁';
                  return (
                    <option key={sectionName} value={sectionName}>
                      {sectionEmoji} {sectionName}
                    </option>
                  );
                })}
              </select>
              {onCreateSection && (
                <button
                  type="button"
                  onClick={onCreateSection}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
                  title="Manage Sections"
                >
                  <FolderPlus size={18} />
                </button>
              )}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Channel description..."
              rows={3}
              className="w-full px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-white placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
            />
          </div>

          {/* Read-Only Option */}
          <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-slate-700">
              <input
                type="checkbox"
                id="readOnly"
                checked={readOnly}
                onChange={(e) => setReadOnly(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-[#3b82f6] focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-2 focus:ring-offset-slate-800"
              />
              <label htmlFor="readOnly" className="flex-1 cursor-pointer">
                <div className="text-sm font-medium text-white">Read-Only Channel</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Users can view messages but only admins can send messages
                </div>
              </label>
          </div>

          {/* Actions */}
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-4 border-t border-slate-800">
            {editing && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors text-sm font-medium sm:flex-none"
              >
                Delete Channel
              </button>
            )}
            <div className="flex flex-col sm:flex-row gap-2 sm:ml-auto w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 sm:flex-none px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white rounded-lg transition-colors font-medium"
              >
                {isSaving ? 'Saving...' : editing ? 'Save Changes' : 'Create Channel'}
              </button>
            </div>
          </div>
        </form>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <div className="px-6 pb-6">
            <div className="bg-red-600/10 border border-red-600/30 rounded-lg p-4">
              <p className="text-sm text-red-400 mb-3">
                Are you sure you want to delete this channel? This action cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 bg-slate-800/50 hover:bg-slate-700 text-slate-300 rounded text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isSaving}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
