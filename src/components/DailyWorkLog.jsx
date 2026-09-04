import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, Download, Pencil, Plus, X } from 'lucide-react';
import { dbDailyWorkLogs } from '../lib/db.js';
import { downloadMonthlyWorkLogPDF } from '../utils/workLogReport.js';
import { hasRole, normalizeRoles, ROLES } from '../utils/permissions.js';

const today = () => new Date().toLocaleDateString('en-CA');
const formatMinutes = (minutes) => `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() || '0m';

export default function DailyWorkLog({ employee, currentUser, todayOnly = false, triggerLabel = 'Daily Work Log' }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [form, setForm] = useState({ projectTask: '', activity: '', hours: '', minutes: '', notes: '' });
  const roles = normalizeRoles(currentUser?.role, '');
  const normalizeIdentity = (value) => String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const userIdentities = new Set(
    [currentUser?.id, currentUser?.userId, currentUser?.user_id, currentUser?.username, currentUser?.name, currentUser?.email]
      .map(normalizeIdentity)
      .filter(Boolean)
  );
  const employeeIdentities = [employee?.id, employee?.userId, employee?.user_id, employee?.name, employee?.employeeName, employee?.employee_name, employee?.email]
    .map(normalizeIdentity)
    .filter(Boolean);
  const canSubmit = hasRole(roles, ROLES.EMPLOYEE) && employeeIdentities.some((identity) => userIdentities.has(identity));
  const canDownload = hasRole(roles, [ROLES.ADMIN, ROLES.MANAGER]);
  const totalMinutes = useMemo(() => entries.reduce((sum, row) => sum + (Number(row.minutes_spent || row.minutesSpent) || 0), 0), [entries]);
  const load = async () => setEntries(await dbDailyWorkLogs.getByEmployeeAndDate(employee.id, date));
  useEffect(() => { if (open) load().catch((error) => console.error(error)); }, [open, date, employee.id]);
  useEffect(() => {
    if (!open || !todayOnly) return undefined;
    let active = true;
    const refreshToday = async () => {
      const currentDate = today();
      if (currentDate !== date) {
        setDate(currentDate);
        return;
      }
      try {
        const rows = await dbDailyWorkLogs.getByEmployeeAndDate(employee.id, currentDate);
        if (active) setEntries(rows);
      } catch (error) {
        console.error('Failed to refresh today’s work log:', error);
      }
    };
    const intervalId = window.setInterval(refreshToday, 15000);
    const handleFocus = () => refreshToday();
    window.addEventListener('focus', handleFocus);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [open, todayOnly, date, employee.id]);
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, saving]);
  const submit = async (event) => {
    event.preventDefault();
    const minutesSpent = (Number(form.hours) || 0) * 60 + (Number(form.minutes) || 0);
    setSaving(true);
    try {
      if (editingEntryId) {
        await dbDailyWorkLogs.update(editingEntryId, { projectTask: form.projectTask, activity: form.activity, minutesSpent, notes: form.notes });
      } else {
        await dbDailyWorkLogs.create({ employeeId: employee.id, workDate: date, projectTask: form.projectTask, activity: form.activity, minutesSpent, notes: form.notes });
      }
      setForm({ projectTask: '', activity: '', hours: '', minutes: '', notes: '' });
      setEditingEntryId(null);
      await load();
    } catch (error) { alert(error.message || 'Failed to save work log.'); }
    finally { setSaving(false); }
  };
  return <>
    <button type='button' className='glass min-h-[40px] rounded-lg px-3 text-xs inline-flex items-center gap-1.5' onClick={() => { if (todayOnly) setDate(today()); setOpen(true); }}><Clock3 size={14}/> {triggerLabel}</button>
    {open && createPortal(<div className='fixed inset-0 z-[2147483647] flex items-start justify-center overflow-y-auto bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4' role='dialog' aria-modal='true' aria-labelledby='daily-work-log-title' onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setOpen(false); }}>
      <div className='glass min-h-full w-full max-w-2xl overflow-y-auto rounded-none p-4 sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl'>
        <div className='flex items-center justify-between gap-3'><div className='min-w-0'><h2 id='daily-work-log-title' className='truncate text-lg font-semibold'>{employee.name} · Daily Work Log</h2><p className='text-xs text-slate-400'>Daily total: {formatMinutes(totalMinutes)}</p></div><button type='button' aria-label='Close work log' className='min-h-[44px] min-w-[44px] grid place-items-center' onClick={() => setOpen(false)} disabled={saving}><X/></button></div>
        <div className='my-4 flex flex-wrap items-center justify-between gap-2'>
          {todayOnly
            ? <div className='glass flex h-11 items-center rounded-xl px-3 text-sm text-slate-200'>{new Date(`${date}T12:00:00`).toLocaleDateString()}</div>
            : <input type='date' className='glass h-11 rounded-xl px-3' value={date} max={today()} onChange={(e)=>setDate(e.target.value)}/>
          }
          {canDownload && <button type='button' className='btn btn-secondary min-h-[44px] inline-flex items-center gap-2' onClick={async()=>{try{const month=date.slice(0,7);const rows=await dbDailyWorkLogs.getByEmployeeAndMonth(employee.id,month);downloadMonthlyWorkLogPDF(employee,month,rows);}catch(error){alert(error.message||'Failed to download report.');}}}><Download size={16}/> Download Monthly Report</button>}
        </div>
        <div className='grid gap-2'>{entries.map((row)=><div key={row.id} className='rounded-xl border border-slate-700/60 bg-slate-900/50 p-3'><div className='flex justify-between gap-3'><div className='font-medium text-slate-100'>{row.activity}</div><div className='flex items-center gap-2'><div className='whitespace-nowrap text-sm text-blue-300'>{formatMinutes(Number(row.minutes_spent || row.minutesSpent))}</div>{canSubmit && <button type='button' className='grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-blue-500/15 hover:text-blue-300' aria-label={`Edit ${row.activity}`} onClick={() => { const minutes = Number(row.minutes_spent || row.minutesSpent) || 0; setEditingEntryId(row.id); setForm({ projectTask: row.project_task || row.projectTask || '', activity: row.activity || '', hours: String(Math.floor(minutes / 60) || ''), minutes: String(minutes % 60 || ''), notes: row.notes || '' }); }}><Pencil size={14}/></button>}</div></div><div className='text-sm text-slate-400'>{row.project_task || row.projectTask}</div>{row.notes && <div className='mt-1 text-xs text-slate-500'>{row.notes}</div>}</div>)}</div>
        {!entries.length && <div className='py-6 text-center text-sm text-slate-500'>No activities logged for this date.</div>}
        {canSubmit && <form onSubmit={submit} className='mt-4 grid gap-3 border-t border-slate-700 pt-4'><div className='flex items-center justify-between gap-2'><h3 className='font-medium'>{editingEntryId ? 'Edit Activity' : 'Add Activity'}</h3>{editingEntryId && <button type='button' className='text-xs text-slate-400 hover:text-white' onClick={() => { setEditingEntryId(null); setForm({ projectTask: '', activity: '', hours: '', minutes: '', notes: '' }); }}>Cancel edit</button>}</div><input required className='glass h-11 rounded-xl px-3' placeholder='Project / Task' value={form.projectTask} onChange={(e)=>setForm({...form,projectTask:e.target.value})}/><input required className='glass h-11 rounded-xl px-3' placeholder='Activity / Description' value={form.activity} onChange={(e)=>setForm({...form,activity:e.target.value})}/><div className='grid grid-cols-2 gap-2'><input type='number' min='0' max='24' className='glass h-11 rounded-xl px-3' placeholder='Hours' value={form.hours} onChange={(e)=>setForm({...form,hours:e.target.value})}/><input type='number' min='0' max='59' className='glass h-11 rounded-xl px-3' placeholder='Minutes' value={form.minutes} onChange={(e)=>setForm({...form,minutes:e.target.value})}/></div><textarea className='glass min-h-20 rounded-xl p-3' placeholder='Optional notes' value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/><button disabled={saving} className='btn btn-primary min-h-[44px] inline-flex items-center justify-center gap-2'>{editingEntryId ? <Pencil size={16}/> : <Plus size={16}/>} {saving?'Saving…':editingEntryId?'Save Changes':'Add Activity'}</button></form>}
      </div>
    </div>, document.body)}
  </>;
}
