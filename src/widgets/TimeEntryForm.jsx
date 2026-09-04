import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useAppStore } from "../stores/appStore.js";

export default function TimeEntryForm() {
  const { addTimeEntry, updateTimeEntry, deleteTimeEntry, projects, employees, timeEntries } = useAppStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    projectId: "",
    employeeId: "",
    entryDate: new Date().toISOString().slice(0, 10),
    hours: "",
    isOvertime: false,
    notes: "",
  });

  const activeProjects = useMemo(() => (Array.isArray(projects) ? projects : []).filter((p) => !p.archived), [projects]);
  const recentEntries = useMemo(
    () => (Array.isArray(timeEntries) ? timeEntries : []).slice(0, 8),
    [timeEntries]
  );
  const projectNameById = useMemo(() => {
    const map = new Map();
    for (const p of activeProjects) map.set(String(p.id), p.projectName || p.project_name || "Project");
    return map;
  }, [activeProjects]);
  const employeeNameById = useMemo(() => {
    const map = new Map();
    for (const e of Array.isArray(employees) ? employees : []) map.set(String(e.id), e.name || "Employee");
    return map;
  }, [employees]);

  useEffect(() => {
    if (!open) return undefined;
    const originalOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!form.projectId || !form.employeeId || Number(form.hours) <= 0) {
      alert("Please select project, employee and valid hours.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateTimeEntry(editingId, {
          projectId: form.projectId,
          employeeId: form.employeeId,
          entryDate: form.entryDate,
          hours: Number(form.hours),
          isOvertime: form.isOvertime,
          notes: form.notes,
        });
      } else {
        await addTimeEntry({
          projectId: form.projectId,
          employeeId: form.employeeId,
          entryDate: form.entryDate,
          hours: Number(form.hours),
          isOvertime: form.isOvertime,
          notes: form.notes,
        });
      }
      setEditingId(null);
      setForm({
        projectId: "",
        employeeId: "",
        entryDate: new Date().toISOString().slice(0, 10),
        hours: "",
        isOvertime: false,
        notes: "",
      });
    } catch (error) {
      alert(`Failed to save time entry: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button className="btn btn-secondary inline-flex items-center gap-2" onClick={() => setOpen(true)} type="button">
        <Plus size={16} />
        Log Time
      </button>
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <form
              onSubmit={onSubmit}
              className="relative w-full max-w-lg rounded-none sm:rounded-2xl bg-white dark:bg-slate-950 border-0 sm:border border-slate-200 dark:border-slate-800 p-4 grid gap-3 min-h-full sm:min-h-0 sm:max-h-[90vh] overflow-y-auto"
            >
              <div className="text-lg font-semibold">Log Time Entry</div>
              <select className="glass w-full px-3 h-11 rounded-xl" value={form.projectId} onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}>
                <option value="">Select project</option>
                {activeProjects.map((project) => (
                  <option key={project.id} value={project.id}>{project.projectName || project.project_name}</option>
                ))}
              </select>
              <select className="glass w-full px-3 h-11 rounded-xl" value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
                <option value="">Select employee</option>
                {(Array.isArray(employees) ? employees : []).map((employee) => (
                  <option key={employee.id} value={employee.id}>{employee.name}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input className="glass w-full px-3 h-11 rounded-xl" type="date" value={form.entryDate} onChange={(e) => setForm((f) => ({ ...f, entryDate: e.target.value }))} />
                <input className="glass w-full px-3 h-11 rounded-xl" type="number" min="0" step="0.25" placeholder="Hours" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))} />
              </div>
              <label className="text-sm flex items-center gap-2">
                <input type="checkbox" checked={form.isOvertime} onChange={(e) => setForm((f) => ({ ...f, isOvertime: e.target.checked }))} />
                Mark as overtime
              </label>
              <textarea className="glass w-full px-3 py-2 rounded-xl min-h-[70px]" placeholder="Notes (optional)" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setEditingId(null);
                  setForm({
                    projectId: "",
                    employeeId: "",
                    entryDate: new Date().toISOString().slice(0, 10),
                    hours: "",
                    isOvertime: false,
                    notes: "",
                  });
                  setOpen(false);
                }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : (editingId ? "Update Entry" : "Save Entry")}</button>
              </div>

              <div className="mt-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <div className="text-sm font-semibold mb-2">Recent Entries</div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {recentEntries.length === 0 && (
                    <div className="text-xs text-slate-500">No entries yet.</div>
                  )}
                  {recentEntries.map((entry) => {
                    const projectId = String(entry.projectId || entry.project_id || "");
                    const employeeId = String(entry.employeeId || entry.employee_id || "");
                    return (
                      <div key={entry.id} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{projectNameById.get(projectId) || "Project"} - {employeeNameById.get(employeeId) || "Employee"}</div>
                          <div className="text-slate-500">{entry.entryDate || entry.entry_date} - {Number(entry.hours || 0).toFixed(2)}h {entry.isOvertime || entry.is_overtime ? "(overtime)" : ""}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-secondary px-2 py-1 text-xs"
                            onClick={() => {
                              setEditingId(entry.id);
                              setForm({
                                projectId: String(entry.projectId || entry.project_id || ""),
                                employeeId: String(entry.employeeId || entry.employee_id || ""),
                                entryDate: entry.entryDate || entry.entry_date || new Date().toISOString().slice(0, 10),
                                hours: String(entry.hours || ""),
                                isOvertime: Boolean(entry.isOvertime || entry.is_overtime),
                                notes: entry.notes || "",
                              });
                            }}
                            title="Edit time entry"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary px-2 py-1 text-xs text-red-500"
                            onClick={async () => {
                              if (!confirm("Delete this time entry?")) return;
                              try {
                                await deleteTimeEntry(entry.id);
                                if (editingId && String(editingId) === String(entry.id)) {
                                  setEditingId(null);
                                  setForm({
                                    projectId: "",
                                    employeeId: "",
                                    entryDate: new Date().toISOString().slice(0, 10),
                                    hours: "",
                                    isOvertime: false,
                                    notes: "",
                                  });
                                }
                              } catch (error) {
                                alert(`Failed to delete time entry: ${error.message || error}`);
                              }
                            }}
                            title="Delete time entry"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </form>
          </div>,
          document.body
        )}
    </>
  );
}
