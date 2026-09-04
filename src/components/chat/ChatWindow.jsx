import React from "react";
import { Users, Hash, Edit2 } from "lucide-react";
import { RealtimeChat } from "./realtime-chat.jsx";

export default function ChatWindow({
  channel,
  isAdmin,
  selectedChannelId,
  onManageUsers,
  onEditChannel,
}) {
  if (!channel) {
    return (
      <div className='flex-1 flex items-center justify-center bg-[#010333]'>
        <p className='text-slate-400'>Select a channel to start chatting</p>
      </div>
    );
  }

  return (
    <div className='flex-1 flex flex-col bg-[#010333]'>
      {/* Channel Header */}
      <div className='h-14 md:h-16 px-3 md:px-6 border-b border-slate-800/50 flex items-center justify-between bg-gradient-to-r from-[#0a0a1a] to-[#0f0f1f] backdrop-blur-sm shadow-sm flex-shrink-0'>
        <div className='flex items-center gap-2 md:gap-3 min-w-0 flex-1'>
          <Hash size={18} className='text-[#3b82f6] flex-shrink-0' />
          <div className='min-w-0 flex-1'>
            <h3 className='font-bold text-white text-sm md:text-base truncate'>{channel.name}</h3>
            {channel.description && (
              <p className='text-xs text-slate-400 truncate hidden md:block'>{channel.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className='flex items-center gap-1 md:gap-2 flex-shrink-0'>
            <button
              onClick={onManageUsers}
              className='p-2 md:px-3 md:py-1.5 bg-slate-800/50 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors touch-manipulation'
              title='Manage Channel Users'>
              <Users size={16} />
              <span className='hidden md:inline'>Users</span>
            </button>
            <button
              onClick={onEditChannel}
              className='p-2 md:px-3 md:py-1.5 bg-slate-800/50 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-sm transition-colors touch-manipulation'
              title='Edit Channel'>
              <Edit2 size={16} />
              <span className='hidden md:inline'>Edit</span>
            </button>
          </div>
        )}
      </div>

      <RealtimeChat
        key={channel.id}
        roomName={channel.id}
        readOnly={channel.readOnly}
        isAdmin={isAdmin}
        selectedChannelId={channel.id}
      />
    </div>
  );
}
