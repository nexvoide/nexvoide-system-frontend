import React, { useState, useRef, useEffect } from "react";
import { Send, Smile, Plus, X, File, CheckCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase, isSupabaseConfigured } from "../../lib/supabase.js";

const EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "🙃",
  "😉",
  "😌",
  "😍",
  "🥰",
  "😘",
  "😗",
  "😙",
  "😚",
  "😋",
  "😛",
  "😝",
  "😜",
  "🤪",
  "🤨",
  "🧐",
  "🤓",
  "😎",
  "🤩",
  "🥳",
  "😏",
  "😒",
  "😞",
  "😔",
  "😟",
  "😕",
  "🙁",
  "☹️",
  "😣",
  "😖",
  "😫",
  "😩",
  "🥺",
  "😢",
  "😭",
  "😤",
  "😠",
  "😡",
  "🤬",
  "🤯",
  "😳",
  "🥵",
  "🥶",
  "😱",
  "😨",
  "😰",
  "😥",
  "😓",
  "🤗",
  "🤔",
  "🤭",
  "🤫",
  "🤥",
  "😶",
  "😐",
  "😑",
  "😬",
  "🙄",
  "😯",
  "😦",
  "😧",
  "😮",
  "😲",
  "🥱",
  "😴",
  "🤤",
  "😪",
  "😵",
  "🤐",
  "🥴",
  "🤢",
  "🤮",
  "🤧",
  "😷",
  "🤒",
  "🤕",
  "🤑",
  "🤠",
  "😈",
  "👿",
  "👹",
  "👺",
  "🤡",
  "💩",
  "👻",
  "💀",
  "☠️",
  "👽",
  "👾",
  "🤖",
  "🎃",
  "😺",
  "😸",
  "😹",
  "😻",
  "😼",
  "😽",
  "🙀",
  "😿",
  "😾",
];

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
};

export default function MessageInput({
  onSend,
  readOnly = false,
  isAdmin = false,
  isConnected = true,
  replyTo = null,
  editingMessage = null,
  onCancelReply = null,
  allUsers = [],
}) {
  const [message, setMessage] = useState(editingMessage?.content || "");
  const [showEmojis, setShowEmojis] = useState(false);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(-1);
  const inputRef = useRef(null);
  const emojiRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const isDisabled = (readOnly && !isAdmin) || !isConnected;

  // Update message when editing
  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
    } else if (!editingMessage && message === editingMessage?.content) {
      setMessage("");
    }
  }, [editingMessage]);

  // Filter users for mention suggestions
  const mentionSuggestions = mentionQuery
    ? allUsers
        .filter(user => {
          const name = (user.name || '').toLowerCase();
          const username = (user.username || '').toLowerCase();
          const query = mentionQuery.toLowerCase();
          return name.includes(query) || username.includes(query);
        })
        .slice(0, 5)
    : [];

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        emojiRef.current &&
        !emojiRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setShowEmojis(false);
      }
    }

    if (showEmojis) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showEmojis]);

  // Upload a single file to Supabase chat-files bucket
  const uploadFileToChat = async (fileObj) => {
    const fileName = fileObj.name;

    if (!isSupabaseConfigured || !supabase) {
      console.warn("Supabase not configured. Cannot upload chat attachments.");
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.name === fileName ? { ...f, uploading: false, error: "Supabase not configured" } : f
        )
      );
      return;
    }

    // Mark as uploading
    setUploadedFiles((prev) =>
      prev.map((f) =>
        f.name === fileName ? { ...f, uploading: true, error: null } : f
      )
    );

    try {
      const file = fileObj.originalFile;
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 15);
      const baseName = file.name || `file-${timestamp}`;
      const ext = baseName.includes(".") ? baseName.split(".").pop() : "";
      const uniqueName = ext ? `${timestamp}-${randomId}.${ext}` : `${timestamp}-${randomId}`;
      const filePath = `chat-uploads/${uniqueName}`;

      const { error } = await supabase.storage
        .from("chat-files")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) {
        console.error("Upload error for chat attachment:", error);
        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.name === fileName
              ? { ...f, uploading: false, error: error.message || "Upload failed" }
              : f
          )
        );
        return;
      }

      const { data: urlData } = supabase.storage
        .from("chat-files")
        .getPublicUrl(filePath);

      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.name === fileName
            ? {
                ...f,
                uploading: false,
                uploaded: true,
                uploadPath: filePath,
                url: urlData?.publicUrl || null,
                error: null,
              }
            : f
        )
      );
    } catch (err) {
      console.error("Upload exception for chat attachment:", err);
      setUploadedFiles((prev) =>
        prev.map((f) =>
          f.name === fileName
            ? { ...f, uploading: false, error: err.message || "Upload failed" }
            : f
        )
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const successfulFiles = uploadedFiles.filter(
      (f) => f.uploaded && f.url
    );
    if ((!message.trim() && successfulFiles.length === 0) || isDisabled) return;

    // Send message (will handle edit if editingMessage is set)
    onSend(message, successfulFiles);
    setMessage("");
    setUploadedFiles([]);
    if (onCancelReply) onCancelReply();
    inputRef.current?.focus();
  };

  // Handle mention autocomplete
  const handleInputChange = (e) => {
    const value = e.target.value;
    setMessage(value);

    // Check for @mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setShowMentionSuggestions(true);
      setMentionIndex(0);
    } else {
      setShowMentionSuggestions(false);
      setMentionQuery("");
    }
  };

  const insertMention = (user) => {
    const cursorPos = inputRef.current?.selectionStart || 0;
    const textBeforeCursor = message.substring(0, cursorPos);
    const textAfterCursor = message.substring(cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);
    
    if (mentionMatch) {
      const beforeMention = textBeforeCursor.substring(0, mentionMatch.index);
      const newMessage = `${beforeMention}@${user.username || user.name} ${textAfterCursor}`;
      setMessage(newMessage);
      setShowMentionSuggestions(false);
      setMentionQuery("");
      
      // Set cursor position after mention
      setTimeout(() => {
        const newPos = beforeMention.length + (user.username || user.name).length + 2;
        inputRef.current?.setSelectionRange(newPos, newPos);
        inputRef.current?.focus();
      }, 0);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const insertEmoji = (emoji) => {
    setMessage((prev) => prev + emoji);
    setShowEmojis(false);
    inputRef.current?.focus();
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Add files with previews and start upload
    const newFiles = selectedFiles.map((file) => {
      const preview = URL.createObjectURL(file);
      return {
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        preview,
        uploading: false,
        uploaded: false,
        uploadPath: null,
        url: null,
        error: null,
        originalFile: file,
      };
    });

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    // Trigger upload for each newly added file
    newFiles.forEach((f) => uploadFileToChat(f));

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (fileName) => {
    setUploadedFiles((prev) => {
      const file = prev.find((f) => f.name === fileName);
      if (file && file.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter((f) => f.name !== fileName);
    });
  };

  const handlePlusClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div className='mb-2 space-y-2'>
          {uploadedFiles.map((file, idx) => (
            <motion.div
              key={`${file.name}-${idx}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className='flex items-center gap-3 px-3 py-1 bg-slate-800/50 border border-slate-700 rounded-lg'>
              {/* File Preview/Icon */}
              {file.type && file.type.startsWith("image/") ? (
                <div className='w-12 h-12 rounded-lg overflow-hidden border border-slate-600 flex-shrink-0 bg-slate-900'>
                  <img
                    src={file.preview}
                    alt={file.name}
                    className='w-full h-full object-cover'
                  />
                </div>
              ) : (
                <div className='w-12 h-12 rounded-lg border border-slate-600 bg-slate-900 flex items-center justify-center flex-shrink-0'>
                  <File size={20} className='text-slate-400' />
                </div>
              )}

              {/* File Info */}
              <div className='flex-1 min-w-0'>
                <p className='text-sm text-white truncate' title={file.name}>
                  {file.name}
                </p>
                {file.error ? (
                  <p className='text-xs text-red-400'>
                    Error: {file.error}
                  </p>
                ) : file.uploaded && file.url ? (
                  <p className='text-xs text-green-400 flex items-center gap-1'>
                    <CheckCircle size={12} />
                    Uploaded ({formatBytes(file.size)})
                  </p>
                ) : file.uploading ? (
                  <p className='text-xs text-blue-400 flex items-center gap-1'>
                    <Loader2 size={12} className='animate-spin' />
                    Uploading...
                  </p>
                ) : (
                  <p className='text-xs text-slate-400'>
                    {formatBytes(file.size)} • Ready to upload
                  </p>
                )}
              </div>

              {/* Remove Button */}
              {!file.uploading && (
                <button
                  type='button'
                  onClick={() => removeFile(file.name)}
                  className='p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0'>
                  <X size={16} />
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {readOnly && (
        <div
          className={`mb-2 px-3 py-2 border rounded-lg text-sm flex items-center gap-2 ${
            isAdmin
              ? "bg-blue-600/20 border-blue-600/30 text-blue-400"
              : "bg-yellow-600/20 border-yellow-600/30 text-yellow-400"
          }`}>
          <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 20 20'>
            <path
              fillRule='evenodd'
              d='M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z'
              clipRule='evenodd'
            />
          </svg>
          {isAdmin
            ? "This channel is read-only, but you can send messages as an admin."
            : "This channel is read-only. Only admins can send messages."}
        </div>
      )}
      <form onSubmit={handleSubmit} className='flex items-center gap-2'>
        {/* Emoji Picker */}
        {showEmojis && (
          <motion.div
            ref={emojiRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className='absolute bottom-full left-0 mb-2 w-80 h-64 bg-slate-800 rounded-lg border border-slate-700 p-4 overflow-y-auto scrollbar-thin z-50 shadow-2xl'>
            <div className='grid grid-cols-8 gap-2'>
              {EMOJIS.map((emoji, index) => (
                <button
                  key={index}
                  type='button'
                  onClick={() => insertEmoji(emoji)}
                  className='text-2xl hover:bg-slate-700 rounded p-1 transition-colors'
                  title={emoji}>
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Input Field */}
        <div className='flex-1 relative'>
          {/* Mention Suggestions */}
          {showMentionSuggestions && mentionSuggestions.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              className="absolute bottom-full left-0 mb-2 w-full max-w-md bg-slate-800/95 backdrop-blur-sm rounded-xl border border-slate-700/50 shadow-2xl z-50 max-h-48 overflow-y-auto">
              {mentionSuggestions.map((user, idx) => (
                <button
                  key={user.id || user.username}
                  type="button"
                  onClick={() => insertMention(user)}
                  className={`w-full px-3 py-2.5 flex items-center gap-3 hover:bg-slate-700/50 transition-all duration-150 ${
                    idx === mentionIndex ? 'bg-slate-700/50' : ''
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-xs font-semibold text-white shadow-md">
                    {(user.name || user.username || 'U')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="text-sm font-semibold text-white">{user.name || user.username}</div>
                    {user.username && user.username !== user.name && (
                      <div className="text-xs text-slate-400">@{user.username}</div>
                    )}
                  </div>
                </button>
              ))}
            </motion.div>
          )}

          {/* Reply-to indicator */}
          {replyTo && (
            <div className="absolute bottom-full left-0 mb-2 w-full px-3 py-2 bg-slate-800/90 border border-slate-700 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Replying to</span>
                <span className="font-medium text-white">{replyTo.user.name}</span>
                <span className="text-slate-500 text-xs truncate max-w-[200px]">{replyTo.content}</span>
              </div>
              {onCancelReply && (
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* Editing indicator */}
          {editingMessage && (
            <div className="absolute bottom-full left-0 mb-2 w-full px-3 py-2 bg-blue-800/90 border border-blue-700 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-blue-300">Editing message</span>
              </div>
              {onCancelReply && (
                <button
                  type="button"
                  onClick={onCancelReply}
                  className="text-blue-300 hover:text-white transition-colors"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <textarea
            ref={inputRef}
            value={message}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onKeyDown={(e) => {
              // Handle arrow keys in mention suggestions
              if (showMentionSuggestions && mentionSuggestions.length > 0) {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setMentionIndex(prev => (prev + 1) % mentionSuggestions.length);
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setMentionIndex(prev => (prev - 1 + mentionSuggestions.length) % mentionSuggestions.length);
                } else if (e.key === 'Enter' && mentionIndex >= 0) {
                  e.preventDefault();
                  insertMention(mentionSuggestions[mentionIndex]);
                } else if (e.key === 'Escape') {
                  setShowMentionSuggestions(false);
                }
              }
            }}
            placeholder={
              !isConnected
                ? "Connecting..."
                : readOnly && !isAdmin
                ? "This channel is read-only..."
                : replyTo
                ? `Replying to ${replyTo.user.name}...`
                : editingMessage
                ? "Editing message..."
                : "Type a message... (use @ to mention)"
            }
            rows={1}
            disabled={isDisabled}
            className={`w-full p-3.5 pr-24 bg-slate-800/60 border border-slate-700/60 rounded-xl text-white placeholder-slate-400/70 resize-none focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 focus:border-[#3b82f6]/50 transition-all duration-200 shadow-lg ${
              isDisabled ? "opacity-50 cursor-not-allowed" : "hover:border-slate-600"
            }`}
            style={{
              minHeight: "48px",
              maxHeight: "120px",
            }}
            onInput={(e) => {
              if (!isDisabled) {
                e.target.style.height = "auto";
                e.target.style.height = `${Math.min(
                  e.target.scrollHeight,
                  120
                )}px`;
              }
            }}
          />
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type='file'
            onChange={handleFileSelect}
            className='hidden'
            accept='image/*,video/*,.pdf,.doc,.docx,.txt'
          />

          <div className='absolute right-2 bottom-3.5 flex items-center gap-1'>
            <button
              type='button'
              onClick={handlePlusClick}
              disabled={isDisabled}
              className={`p-2 text-slate-400 transition-all duration-150 rounded-lg ${
                isDisabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:text-[#3b82f6] hover:bg-slate-700/50 hover:scale-110 active:scale-95"
              }`}
              title='Upload file'>
              <Plus size={20} />
            </button>
            <button
              type='button'
              onClick={() => setShowEmojis(!showEmojis)}
              disabled={isDisabled}
              className={`p-2 text-slate-400 transition-all duration-150 rounded-lg ${
                isDisabled
                  ? "cursor-not-allowed opacity-50"
                  : showEmojis
                  ? "text-[#3b82f6] bg-slate-700/50 scale-110"
                  : "hover:text-[#3b82f6] hover:bg-slate-700/50 hover:scale-110 active:scale-95"
              }`}
              title='Add emoji'>
              <Smile size={20} />
            </button>
          </div>
        </div>

        {/* Send Button */}
        <button
          type='submit'
          disabled={!message.trim() || isDisabled}
          className='p-3 bg-gradient-to-br from-[#3b82f6] to-[#2563eb] hover:from-[#2563eb] hover:to-[#1d4ed8] disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed rounded-xl transition-all duration-200 shadow-lg hover:shadow-blue-500/20 disabled:shadow-none hover:scale-105 active:scale-95'
          title={
            !isConnected
              ? "Connecting..."
              : readOnly && !isAdmin
              ? "Channel is read-only"
              : "Send message"
          }>
          <Send size={20} className='text-white' />
        </button>
      </form>
    </div>
  );
}
