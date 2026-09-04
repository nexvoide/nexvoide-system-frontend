import React, { useEffect, useMemo, useState } from 'react';
import { Clock3, Download, Plus, X } from 'lucide-react';
import { dbDailyWorkLogs } from '../lib/db.js';
import { downloadMonthlyWorkLogPDF } from '../utils/workLogReport.js';
import { hasRole, normalizeRoles, ROLES } from '../utils/permissions.js';

const today = () => new Date().toLocaleDateString('en-CA');
const formatMinutes = (minutes) => `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}${minutes % 60 ? `${minutes % 60}m` : ''}`.trim() || '0m';

export default function DailyWorkLog({ employee, currentUser }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today());
  const [entries, setEntries] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ projectTask: '', activity: '', hours: '', minutes: '', notes: '' });
  const identity = String(currentUser?.userId || currentUser?.user_id || currentUser?.name || '').toLowerCase();
  const canSubmit = identity && [employee.name, employee.id].some((value) => String(value || '').toLowerCase() === identity);
  const canDownload = hasRole(normalizeRoles(currentUser?.role, ''), [ROLES.ADMIN, ROLES.MANAGER]);
  const totalMinutes = useMemo(() => entries.reduce((sum, row) => sum + (Number(row.minutes_spent || row.minutesSpent) || 0), 0), [entries]);
  const load = async () => setEntries(await dbDailyWorkLogs.getByEmployeeAndDate(employee.id, date));
  useEffect(() => { if (open) load().catch((error) => console.error(error)); }, [open, date, employee.id]);
  const submit = async (event) => {
    event.preventDefault();
    const minutesSpent = (Number(form.hours) || 0) * 60 + (Number(form.minutes) || 0);
    setSaving(true);
    try {
      await dbDailyWorkLogs.create({ employeeId: employee.id, workDate: date, projectTask: form.projectTask, activity: form.activity, minutesSpent, notes: form.notes });
      setForm({ projectTask: '', activity: '', hours: '', minutes: '', notes: '' });
      await load();
    } catch (error) { alert(error.message || 'Failed to save work log.'); }
    finally { setSaving(false); }
  };
  return <>
    <button type='button' className='glass min-h-[40px] rounded-lg px-3 text-xs inline-flex items-center gap-1.5' onClick={() => setOpen(true)}><Clock3 size={14}/> Daily Work Log</button>
    {open && <div className='fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/70 p-0 sm:p-4'>
      <div className='glass min-h-full sm:min-h-0 w-full max-w-2xl sm:rounded-2xl p-4'>
        <div className='flex items-center justify-between'><div><h2 className='text-lg font-semibold'>{employee.name} · Daily Work Log</h2><p className='text-xs text-slate-400'>Daily total: {formatMinutes(totalMinutes)}</p></div><button className='min-h-[44px] min-w-[44px] grid place-items-center' onClick={() => setOpen(false)}><X/></button></div>
        <div className='my-4 flex flex-wrap items-center justify-between gap-2'><input type='date' className='glass h-11 rounded-xl px-3' value={date} max={today()} onChange={(e)=>setDate(e.target.value)}/>{canDownload && <button type='button' className='btn btn-secondary min-h-[44px] inline-flex items-center gap-2' onClick={async()=>{try{const month=date.slice(0,7);const rows=await dbDailyWorkLogs.getByEmployeeAndMonth(employee.id,month);downloadMonthlyWorkLogPDF(employee,month,rows);}catch(error){alert(error.message||'Failed to download report.');}}}><Download size={16}/> Download Monthly Report</button>}</div>
        <div className='grid gap-2'>{entries.map((row)=><div key={row.id} className='rounded-xl border border-slate-700/60 bg-slate-900/50 p-3'><div className='flex justify-between gap-3'><div className='font-medium text-slate-100'>{row.activity}</div><div className='whitespace-nowrap text-sm text-blue-300'>{formatMinutes(Number(row.minutes_spent || row.minutesSpent))}</div></div><div className='text-sm text-slate-400'>{row.project_task || row.projectTask}</div>{row.notes && <div className='mt-1 text-xs text-slate-500'>{row.notes}</div>}</div>)}</div>
        {!entries.length && <div className='py-6 text-center text-sm text-slate-500'>No activities logged for this date.</div>}
        {canSubmit && <form onSubmit={submit} className='mt-4 grid gap-3 border-t border-slate-700 pt-4'><h3 className='font-medium'>Add Activity</h3><input required className='glass h-11 rounded-xl px-3' placeholder='Project / Task' value={form.projectTask} onChange={(e)=>setForm({...form,projectTask:e.target.value})}/><input required className='glass h-11 rounded-xl px-3' placeholder='Activity / Description' value={form.activity} onChange={(e)=>setForm({...form,activity:e.target.value})}/><div className='grid grid-cols-2 gap-2'><input type='number' min='0' max='24' className='glass h-11 rounded-xl px-3' placeholder='Hours' value={form.hours} onChange={(e)=>setForm({...form,hours:e.target.value})}/><input type='number' min='0' max='59' className='glass h-11 rounded-xl px-3' placeholder='Minutes' value={form.minutes} onChange={(e)=>setForm({...form,minutes:e.target.value})}/></div><textarea className='glass min-h-20 rounded-xl p-3' placeholder='Optional notes' value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})}/><button disabled={saving} className='btn btn-primary min-h-[44px] inline-flex items-center justify-center gap-2'><Plus size={16}/>{saving?'Saving…':'Add Activity'}</button></form>}
      </div>
    </div>}
  </>;
}
