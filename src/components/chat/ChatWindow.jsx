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
    <div className='flex-1 min-w-0 flex flex-col bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.10),transparent_34%),linear-gradient(180deg,#07091d_0%,#010333_100%)]'>
      {/* Channel Header */}
      <div className='h-16 md:h-[72px] px-4 md:px-6 border-b border-white/[0.06] flex items-center justify-between bg-[#080a1c]/85 backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.16)] flex-shrink-0'>
        <div className='flex items-center gap-2 md:gap-3 min-w-0 flex-1'>
          <div className='w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-400/15 flex items-center justify-center flex-shrink-0'>
            <Hash size={17} className='text-blue-400' />
          </div>
          <div className='min-w-0 flex-1'>
            <h3 className='font-semibold tracking-tight text-white text-sm md:text-base truncate'>{channel.name}</h3>
            {channel.description && (
              <p className='text-xs text-slate-400 truncate hidden md:block'>{channel.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className='flex items-center gap-1 md:gap-2 flex-shrink-0'>
            <button
              onClick={onManageUsers}
              className='p-2 md:px-3 md:py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-all touch-manipulation'
              title='Manage Channel Users'>
              <Users size={16} />
              <span className='hidden md:inline'>Users</span>
            </button>
            <button
              onClick={onEditChannel}
              className='p-2 md:px-3 md:py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] rounded-xl flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-all touch-manipulation'
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
