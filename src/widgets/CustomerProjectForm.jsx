import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X } from 'lucide-react';
import { useAppStore } from '../stores/appStore.js';
import { dbCompanyDedicatedEditors } from '../lib/db.js';

export default function CustomerProjectForm({ editing = null, onDone }) {
  const { addProject, updateProject, employees, profiles, agencies, brands, user } = useAppStore();
  const [open, setOpen] = useState(false);
  const [editorIds, setEditorIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', editorId: '', briefLink: '', footageLink: '', instructions: '', deadline: '', priority: 'normal' });
  const closeForm = () => {
    if (saving) return;
    setOpen(false);
    onDone?.();
  };

  useEffect(() => {
    if (!editing) return;
    let assigned = editing.assigned || [];
    if (typeof assigned === 'string') {
      try { assigned = JSON.parse(assigned); } catch { assigned = []; }
    }
    const assignee = Array.isArray(assigned) ? assigned[0] : null;
    const deadline = editing.deadline ? new Date(editing.deadline) : null;
    const localDeadline = deadline && !Number.isNaN(deadline.getTime())
      ? new Date(deadline.getTime() - deadline.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
      : '';
    setForm({
      title: editing.projectName || '',
      editorId: assignee?.employeeId || assignee?.employee_id || assignee?.id || '',
      briefLink: editing.rawSourceLink || editing.raw_source_link || '',
      footageLink: editing.footageLink || editing.footage_link || '',
      instructions: editing.notes || '',
      deadline: localDeadline,
      priority: editing.priority || 'normal',
    });
    setOpen(true);
  }, [editing]);

  useEffect(() => {
    if (!open || !user?.companyName && !user?.company_name) return;
    const companyName = String(user.companyName || user.company_name).trim().toLowerCase();
    const entities = [
      ...profiles.map(item => ({ entityType: 'profile', entityId: item.id, name: item.name })),
      ...agencies.map(item => ({ entityType: 'agency', entityId: item.id, name: item.name })),
      ...brands.map(item => ({ entityType: 'brand', entityId: item.id, name: item.name })),
    ].filter(item => String(item.name || '').trim().toLowerCase() === companyName);
    dbCompanyDedicatedEditors.getByEntities(entities)
      .then((rows) => setEditorIds(rows.map((row) => row.employee_id || row.employeeId)))
      .catch((error) => console.error('Failed to load assigned editors:', error));
  }, [open, user?.companyName, user?.company_name, profiles, agencies, brands]);

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !saving) closeForm();
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, saving, onDone]);

  const editors = employees.filter((employee) => editorIds.some((id) => String(id) === String(employee.id)));
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event) => {
    event.preventDefault();
    const editor = editors.find((employee) => String(employee.id) === String(form.editorId));
    if (!editor) return alert('Select one of your assigned editors.');
    let existingAssigned = editing?.assigned || [];
    if (typeof existingAssigned === 'string') {
      try { existingAssigned = JSON.parse(existingAssigned); } catch { existingAssigned = []; }
    }
    const existingAssignee = Array.isArray(existingAssigned)
      ? existingAssigned.find(assignee => String(assignee?.employeeId || assignee?.employee_id || assignee?.id || '') === String(editor.id))
      : null;
    setSaving(true);
    try {
      const payload = {
        platform: 'Direct', clientName: user.name || user.userId || user.user_id || user.username,
        projectName: form.title.trim(), assigned: [{
          ...existingAssignee,
          employeeId: editor.id,
          name: editor.name,
          costType: existingAssignee?.costType || existingAssignee?.cost_type || 'fixed',
          costValue: Number(existingAssignee?.costValue ?? existingAssignee?.cost_value ?? 0),
        }],
        rawSourceLink: form.briefLink.trim(), footageLink: form.footageLink.trim(), notes: form.instructions.trim(),
        deadline: form.deadline ? new Date(form.deadline).toISOString() : null, priority: form.priority,
        status: 'In Progress', amount: 0, currency: 'USD', paidAt: new Date().toISOString(),
      };
      if (editing) {
        delete payload.status;
        delete payload.amount;
        delete payload.currency;
        delete payload.paidAt;
        await updateProject(editing.id, payload);
      } else {
        await addProject(payload);
      }
      setOpen(false);
      setForm({ title: '', editorId: '', briefLink: '', footageLink: '', instructions: '', deadline: '', priority: 'normal' });
      onDone?.();
    } catch (error) { alert(error.message || 'Failed to create task.'); }
    finally { setSaving(false); }
  };

  return <>
    {!editing && <button className='btn btn-primary inline-flex items-center gap-2' onClick={() => setOpen(true)}><Plus size={16}/> New Task</button>}
    {open && createPortal(<div
      className='flex items-start justify-center overflow-y-auto p-0 sm:items-center sm:p-4'
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        width: '100vw',
        height: '100dvh',
        background: 'rgba(0, 0, 0, 0.88)',
        isolation: 'isolate',
      }}
      role='dialog'
      aria-modal='true'
      aria-labelledby='customer-task-title'
      onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) closeForm(); }}>
      <form onSubmit={submit} className='relative grid min-h-full w-full max-w-xl gap-3 overflow-y-auto rounded-none border border-slate-800 bg-[#080d18] p-4 text-white shadow-2xl sm:min-h-0 sm:max-h-[calc(100dvh-2rem)] sm:rounded-2xl'>
        <div className='flex items-center justify-between'><h2 id='customer-task-title' className='text-lg font-semibold'>{editing ? 'Edit Task' : 'Create Project / Task'}</h2><button type='button' aria-label='Close task form' className='min-h-[44px] min-w-[44px] grid place-items-center' onClick={closeForm} disabled={saving}><X/></button></div>
        <label className='text-xs text-slate-400'>Project Title<input required className='glass mt-1 w-full h-11 rounded-xl px-3 text-base' value={form.title} onChange={(e)=>set('title',e.target.value)}/></label>
        <label className='text-xs text-slate-400'>Select Editor<select required className='glass mt-1 w-full h-11 rounded-xl px-3' value={form.editorId} onChange={(e)=>set('editorId',e.target.value)}><option value=''>Select assigned editor…</option>{editors.map((e)=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        {!editors.length && <div className='rounded-xl bg-amber-500/10 p-3 text-sm text-amber-300'>No editor is assigned to your account. Contact an Admin or Manager.</div>}
        <label className='text-xs text-slate-400'>Google Drive / Brief Link<input type='url' className='glass mt-1 w-full h-11 rounded-xl px-3' value={form.briefLink} onChange={(e)=>set('briefLink',e.target.value)}/></label>
        <label className='text-xs text-slate-400'>Frame.io / Footage Link<input type='url' className='glass mt-1 w-full h-11 rounded-xl px-3' value={form.footageLink} onChange={(e)=>set('footageLink',e.target.value)}/></label>
        <label className='text-xs text-slate-400'>Instructions / Description<textarea required className='glass mt-1 w-full min-h-28 rounded-xl p-3' value={form.instructions} onChange={(e)=>set('instructions',e.target.value)}/></label>
        <div className='grid sm:grid-cols-2 gap-3'><label className='text-xs text-slate-400'>Expected Completion Time<input required type='datetime-local' className='glass mt-1 w-full h-11 rounded-xl px-3' value={form.deadline} onChange={(e)=>set('deadline',e.target.value)}/></label><label className='text-xs text-slate-400'>Priority<select className='glass mt-1 w-full h-11 rounded-xl px-3' value={form.priority} onChange={(e)=>set('priority',e.target.value)}><option value='low'>Low</option><option value='normal'>Normal</option><option value='high'>High</option><option value='urgent'>Urgent</option></select></label></div>
        <button disabled={saving || !editors.length} className='btn btn-primary min-h-[44px] disabled:opacity-50'>{saving ? 'Saving…' : editing ? 'Save Changes' : 'Submit Task'}</button>
      </form>
    </div>, document.body)}
  </>;
}
