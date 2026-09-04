import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Eye, Pencil, Trash2, X } from 'lucide-react';

export default function ProjectActions({ project, onView, onEdit, onDelete }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const [position, setPosition] = useState({ top: 0, right: 12 });

  useEffect(() => {
    if (!open) return undefined;
    const close = event => {
      if (event.key === 'Escape') setOpen(false);
      if (event.type === 'mousedown' && !menuRef.current?.contains(event.target) && !buttonRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', close);
    document.addEventListener('mousedown', close);
    return () => {
      document.removeEventListener('keydown', close);
      document.removeEventListener('mousedown', close);
    };
  }, [open]);

  useEffect(() => {
    if (!confirming) return undefined;
    const close = event => {
      if (event.key === 'Escape' && !deleting) setConfirming(false);
    };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, [confirming, deleting]);

  const toggleMenu = () => {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: Math.min(rect.bottom + 6, window.innerHeight - 190),
        right: Math.max(12, window.innerWidth - rect.right),
      });
    }
    setOpen(value => !value);
  };

  const choose = callback => {
    setOpen(false);
    callback?.();
  };

  const confirmDelete = async () => {
    if (!onDelete || deleting) return;
    setDeleting(true);
    try {
      await onDelete();
      setConfirming(false);
    } catch {
      // The parent displays the persistence error; keep confirmation open for retry/cancel.
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="inline-flex h-11 w-11 md:h-9 md:w-9 flex-shrink-0 items-center justify-center rounded-xl border border-slate-700/60 bg-slate-900/60 text-slate-300 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Project actions for ${project.projectName}`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreHorizontal size={19} />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="fixed inset-x-3 bottom-[max(12px,env(safe-area-inset-bottom))] z-[100] rounded-2xl border border-slate-700 bg-[#111827] p-2 shadow-2xl md:inset-x-auto md:bottom-auto md:w-52 md:rounded-xl"
          style={window.innerWidth >= 768 ? position : undefined}
        >
          <div className="flex items-center justify-between px-3 py-2 md:hidden">
            <span className="truncate pr-3 text-sm font-semibold text-white">{project.projectName}</span>
            <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-400" aria-label="Close project actions"><X size={20} /></button>
          </div>
          {onView && <MenuButton icon={Eye} label="View Details" onClick={() => choose(onView)} />}
          {onEdit && <MenuButton icon={Pencil} label="Edit Project" onClick={() => choose(onEdit)} />}
          {onDelete && (
            <div className="mt-1 border-t border-slate-700/70 pt-1">
              <MenuButton icon={Trash2} label="Delete Project" destructive onClick={() => { setOpen(false); setConfirming(true); }} />
            </div>
          )}
        </div>,
        document.body
      )}

      {confirming && createPortal(
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="delete-project-title">
          <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-[#111827] p-5 shadow-2xl">
            <h2 id="delete-project-title" className="text-lg font-semibold text-white">Delete “{project.projectName}”?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">This project and its associated information will be removed. This action cannot be undone.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={deleting} onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 hover:bg-slate-800">Cancel</button>
              <button type="button" disabled={deleting} onClick={confirmDelete} className="min-h-11 rounded-xl bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60">{deleting ? 'Deleting…' : 'Delete Project'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function MenuButton({ icon: Icon, label, destructive = false, onClick }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${destructive ? 'text-red-400 hover:bg-red-500/10' : 'text-slate-200 hover:bg-slate-800'}`}>
      <Icon size={17} />
      {label}
    </button>
  );
}
