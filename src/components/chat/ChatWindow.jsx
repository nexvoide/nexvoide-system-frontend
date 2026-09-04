import React from "react";
import { Users, Edit2, Menu, MoreVertical, ArrowLeft } from "lucide-react";
import { RealtimeChat } from "./realtime-chat.jsx";

export default function ChatWindow({
  channel,
  isAdmin,
  selectedChannelId,
  onManageUsers,
  onEditChannel,
  onOpenSidebar,
  onBack,
}) {
  if (!channel) {
    return (
      <div className='flex-1 flex items-center justify-center bg-[#010333]'>
        <p className='text-slate-400'>Select a channel to start chatting</p>
      </div>
    );
  }

  return (
    <div className='flex-1 min-w-0 min-h-0 h-full overflow-hidden flex flex-col bg-[#060912]'>
      {/* Channel Header */}
      <div className='h-[68px] md:h-20 px-3 md:px-6 border-b border-slate-400/10 flex items-center justify-between bg-[#080d18] flex-shrink-0'>
        <div className='flex items-center gap-2 md:gap-3 min-w-0 flex-1'>
          <button onClick={onBack} className='md:hidden w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0 text-[#b8c7de] hover:bg-[#0c1423] active:scale-95 transition-[background-color,transform]' aria-label='Back to dashboard'>
            <ArrowLeft size={21} />
          </button>
          <button onClick={onOpenSidebar} className='md:hidden w-10 h-10 rounded-[10px] border border-[#1b283d] bg-[#0c1423] flex items-center justify-center flex-shrink-0' aria-label='Open conversations'>
            <Menu size={19} className='text-[#b8c7de]' />
          </button>
          <div className='min-w-0 flex-1'>
            <h3 className='font-semibold tracking-tight text-[#f8fafc] text-[15px] md:text-lg truncate'>{channel.name}</h3>
            {channel.description && (
              <p className='text-[11px] md:text-xs text-[#8ea0b8] truncate'>{channel.description}</p>
            )}
          </div>
        </div>
        {isAdmin && (
          <div className='flex items-center gap-1 md:gap-2 flex-shrink-0'>
            <button
              onClick={onManageUsers}
              className='h-10 md:h-[42px] px-3 bg-white/[0.035] hover:bg-white/[0.07] border border-slate-400/10 rounded-xl flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors duration-150 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
              title='Manage Channel Users'>
              <Users size={16} />
              <span className='hidden md:inline'>Users</span>
            </button>
            <button
              onClick={onEditChannel}
              className='h-10 md:h-[42px] px-3 bg-white/[0.035] hover:bg-white/[0.07] border border-slate-400/10 rounded-xl flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors duration-150 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
              title='Edit Channel'>
              <Edit2 size={16} />
              <span className='hidden md:inline'>Edit</span>
            </button>
          </div>
        )}
        <button className='md:hidden w-10 h-10 rounded-[10px] flex items-center justify-center text-[#8ea0b8]' aria-label='Conversation actions'>
          <MoreVertical size={20} />
        </button>
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
