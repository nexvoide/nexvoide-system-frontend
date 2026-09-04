import React, { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Upload, File, Trash2, Loader2 } from "lucide-react";
import { useAppStore } from "../stores/appStore.js";
import AssignFromHR from "./AssignFromHR.jsx";
import { notifyAssignedEmployees } from "../utils/whatsapp.js";
import { uploadFile, deleteFile } from "../utils/storage.js";
import { notifyProjectAssignment } from "../utils/notificationHelpers.js";

const today = () => new Date().toLocaleDateString('en-CA');

export default function ProjectForm({ editing, onDone, triggerLabel }) {
  const { addProject, updateProject, profiles, agencies, brands, employees, rate, user, userRole, allUsers } = useAppStore();
  const [form, setForm] = useState({
    platform: "Fiverr",
    profileId: "",
    agencyId: "",
    brandId: "",
    clientName: "",
    projectName: "",
    service: "",
    quantity: "",
    amount: "",
    paidAt: today(),
    currency: "USD",
    assigned: [],
    status: "In Progress",
    isRevision: false,
    startDate: "",
    endDate: "",
    deadline: "",
    rawSourceLink: "",
    rawSourceLinks: [""],
    attachments: [],
    notes: ""
  });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});

  const availableProfiles = useMemo(() => {
    return profiles.filter(p => p.platform === form.platform);
  }, [profiles, form.platform]);

  const getDefaultForm = () => ({
    platform: "Fiverr",
    profileId: "",
    agencyId: "",
    brandId: "",
    clientName: "",
    projectName: "",
    service: "",
    quantity: "",
    amount: "",
    paidAt: today(),
    currency: "USD",
    assigned: [],
    status: "In Progress",
    isRevision: false,
    startDate: "",
    endDate: "",
    deadline: "",
    rawSourceLink: "",
    rawSourceLinks: [""],
    attachments: [],
    notes: ""
  });

  // Helper function to convert deadline to datetime-local format
  const formatDeadlineForInput = (deadline) => {
    if (!deadline) return "";
    try {
      // Parse the deadline - handle Supabase TIMESTAMP (may not have timezone)
      let deadlineStr = String(deadline).trim();
      
      // If it's a timestamp without timezone (from Supabase TIMESTAMP column)
      // Treat it as UTC by appending 'Z' so JavaScript parses it correctly
      if (deadlineStr.includes('T') && !deadlineStr.endsWith('Z') && !deadlineStr.match(/[+-]\d{2}:\d{2}$/)) {
        deadlineStr = deadlineStr + 'Z';
      }
      
      const date = new Date(deadlineStr);
      if (isNaN(date.getTime())) return "";
      
      // Convert to local time and format as YYYY-MM-DDTHH:mm for datetime-local input
      // Use local time methods to ensure we get the time as it appears in user's timezone
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting deadline:', error);
      return "";
    }
  };

  useEffect(() => {
    if (editing) {
      // When editing, use revisionQuantity if it's a revision project, otherwise use quantity
      const quantityValue = editing.isRevision ? (editing.revisionQuantity || editing.quantity || '') : (editing.quantity || '');
      // Ensure assigned is always an array
      let assigned = editing.assigned || [];
      if (typeof assigned === 'string') {
        try {
          assigned = JSON.parse(assigned);
        } catch {
          assigned = [];
        }
      }
      if (!Array.isArray(assigned)) assigned = [];
      // Ensure attachments is always an array
      let attachments = editing.attachments || [];
      if (typeof attachments === 'string') {
        try {
          attachments = JSON.parse(attachments);
        } catch {
          attachments = [];
        }
      }
      if (!Array.isArray(attachments)) attachments = [];
      
      // Derive rawSourceLinks array from existing single/raw string
      const existingRawSource =
        editing.rawSourceLink || editing.raw_source_link || "";
      const rawSourceLinks =
        typeof existingRawSource === "string" && existingRawSource.trim()
          ? existingRawSource
              .split(/\r?\n/)
              .map((l) => l.trim())
              .filter(Boolean)
          : [""];

      // Format deadline for datetime-local input
      const formattedDeadline = formatDeadlineForInput(editing.deadline);
      
      setForm({ 
        ...editing, 
        quantity: quantityValue, 
        assigned, 
        attachments,
        rawSourceLinks,
        deadline: formattedDeadline,
        notes: editing.notes || ""
      });
    } else {
      setForm(getDefaultForm());
    }
  }, [editing]);

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setAssigned(i, k, v) {
    setForm((f) => {
      const assigned = f.assigned ? [...f.assigned] : [];
      assigned[i] = { ...assigned[i], [k]: v };
      return { ...f, assigned };
    });
  }

  function setRawSourceLinkAt(index, value) {
    setForm((f) => {
      const links = Array.isArray(f.rawSourceLinks)
        ? [...f.rawSourceLinks]
        : [f.rawSourceLink || ""];
      links[index] = value;
      return { ...f, rawSourceLinks: links };
    });
  }

  function addRawSourceLink() {
    setForm((f) => ({
      ...f,
      rawSourceLinks: [...(f.rawSourceLinks || []), ""],
    }));
  }

  function removeRawSourceLink(index) {
    setForm((f) => {
      const links = (f.rawSourceLinks || []).filter((_, i) => i !== index);
      return { ...f, rawSourceLinks: links.length ? links : [""] };
    });
  }

  function addAssignee() {
    setForm((f) => ({ ...f, assigned: [...(f.assigned || []), { employeeId: "", name: "", costType: "fixed", costValue: "" }] }));
  }

  function removeAssignee(idx) {
    setForm((f) => ({ ...f, assigned: (f.assigned || []).filter((_, i) => i !== idx) }));
  }

  async function handleFileUpload(event) {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    // Use project ID if editing, otherwise use a temporary ID that will be replaced when project is created
    const projectId = editing?.id || `temp-${Date.now()}`;

    try {
      const uploadPromises = files.map(async (file, index) => {
        try {
          setUploadProgress(prev => ({ ...prev, [file.name]: 'uploading' }));
          const result = await uploadFile(file, projectId);
          setUploadProgress(prev => ({ ...prev, [file.name]: 'success' }));
          return result;
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
          throw error;
        }
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      const successfulUploads = uploadedFiles.filter(f => f !== null);

      if (successfulUploads.length > 0) {
        setForm((f) => ({
          ...f,
          attachments: [...(f.attachments || []), ...successfulUploads]
        }));
      }

      // Clear file input
      event.target.value = '';
    } catch (error) {
      console.error('File upload error:', error);
      alert(`Failed to upload files: ${error.message || 'Please try again.'}`);
    } finally {
      setUploading(false);
      setTimeout(() => setUploadProgress({}), 2000);
    }
  }

  async function handleRemoveAttachment(index) {
    const attachment = form.attachments[index];
    if (!attachment) return;

    // If it's a new upload (has path), delete from storage
    if (attachment.path && !editing) {
      try {
        await deleteFile(attachment.path);
      } catch (error) {
        console.error('Failed to delete file from storage:', error);
        // Continue anyway - remove from form
      }
    }

    setForm((f) => ({
      ...f,
      attachments: (f.attachments || []).filter((_, i) => i !== index)
    }));
  }

  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  async function submit(e) {
    e.preventDefault();
    try {
      // Handle quantity: preserve the value if it exists, convert empty string to null
      const quantityValue = form.quantity && form.quantity.trim() !== '' ? form.quantity.trim() : null;
      
      // Convert deadline from datetime-local format to ISO string
      // datetime-local gives "YYYY-MM-DDTHH:mm" (local time, no timezone)
      // The user enters a time like "11:40 AM" which they want to be 11:40 AM in their timezone
      let deadlineValue = form.deadline || null;
      if (deadlineValue && deadlineValue.trim() !== '') {
        try {
          // Parse the datetime-local value - it represents local time without timezone
          const [datePart, timePart] = deadlineValue.split('T');
          if (datePart && timePart) {
            const [year, month, day] = datePart.split('-').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            
            // Create a date object representing the local time the user entered
            // new Date(year, month, day, hours, minutes) creates a date in LOCAL timezone
            const localDate = new Date(year, month - 1, day, hours, minutes);
            
            if (!isNaN(localDate.getTime())) {
              // Convert to ISO string (UTC)
              // This correctly converts the local time to UTC
              // Example: 11:40 AM in UTC+5 becomes 6:40 AM UTC
              // When read back, JavaScript will convert 6:40 AM UTC back to 11:40 AM local
              deadlineValue = localDate.toISOString();
            } else {
              deadlineValue = null;
            }
          } else {
            deadlineValue = null;
          }
        } catch (error) {
          console.error('Error converting deadline:', error);
          deadlineValue = null;
        }
      } else {
        deadlineValue = null;
      }

      // Normalize raw source links: support multiple links via array
      const linksArray = Array.isArray(form.rawSourceLinks)
        ? form.rawSourceLinks
        : [form.rawSourceLink || ""];
      const normalizedLinks = linksArray
        .map((l) => (l || "").trim())
        .filter(Boolean);
      const rawSourceLinkValue =
        normalizedLinks.length > 0 ? normalizedLinks.join("\n") : "";
      
      const payload = {
        ...form,
        quantity: form.isRevision ? null : quantityValue,
        revisionQuantity: form.isRevision ? quantityValue : null,
        amount: Number(form.amount) || 0,
        paidAt: form.paidAt ? new Date(`${form.paidAt}T12:00:00`).toISOString() : new Date().toISOString(),
        assigned: (form.assigned || []).filter((a) => a.name).map((a) => ({ ...a, costValue: Number(a.costValue) || 0 })),
        deadline: deadlineValue,
        rawSourceLink: rawSourceLinkValue,
        rawSourceLinks: undefined,
        notes: form.notes || ""
      };
      
      // Get old assigned employees for comparison (if editing)
      // Ensure assigned is always an array
      let oldAssigned = editing?.assigned || [];
      if (typeof oldAssigned === 'string') {
        try {
          oldAssigned = JSON.parse(oldAssigned);
        } catch {
          oldAssigned = [];
        }
      }
      if (!Array.isArray(oldAssigned)) oldAssigned = [];
      const newAssigned = payload.assigned || [];
      
      if (editing) {
        await updateProject(editing.id, payload);
        // Notify newly assigned employees
        if (newAssigned.length > 0 && employees && employees.length > 0) {
          console.log('📱 Notifying newly assigned employees:', newAssigned, 'from', oldAssigned);
          notifyAssignedEmployees(newAssigned, oldAssigned, { ...payload, ...editing }, employees, rate);
          // Send in-app notifications
          notifyProjectAssignment(newAssigned, oldAssigned, { ...payload, ...editing, id: editing.id }, employees, allUsers);
        } else {
          console.warn('⚠️ Cannot notify: newAssigned=', newAssigned, 'employees=', employees);
        }
      } else {
        const createdProject = await addProject(payload);
        // Notify all assigned employees for new projects
        if (newAssigned.length > 0 && employees && employees.length > 0) {
          console.log('📱 Notifying assigned employees for new project:', newAssigned);
          notifyAssignedEmployees(newAssigned, [], payload, employees, rate);
          // Send in-app notifications
          notifyProjectAssignment(newAssigned, [], { ...payload, ...createdProject }, employees, allUsers);
        } else {
          console.warn('⚠️ Cannot notify: newAssigned=', newAssigned, 'employees=', employees);
        }
      }
      // Only close form and reset if save is successful
      setForm(getDefaultForm());
      setOpen(false);
      if (onDone) {
        onDone();
      }
    } catch (error) {
      console.error('Failed to save project:', error);
      // Don't close form on error - let user try again
      // Error message is already shown in Zustand store
    }
  }

  const [open, setOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (editing && triggerLabel) setOpen(true);
  }, [editing, triggerLabel]);

  useEffect(() => {
    if (open && !editing) {
      setForm(getDefaultForm());
    }
  }, [open, editing]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      return () => {
        document.body.style.overflow = originalStyle;
        document.body.style.position = '';
        document.body.style.width = '';
      };
    }
  }, [open]);

  // Single close handler to prevent double-closing
  const handleClose = () => {
    if (isClosing || !open) return; // Prevent multiple calls
    setIsClosing(true);
    setOpen(false);
    setForm(getDefaultForm());
    if (onDone) {
      onDone();
    }
    // Reset closing flag after a short delay
    setTimeout(() => setIsClosing(false), 100);
  };

  if (triggerLabel) {
    return (
      <>
        <button className="btn btn-primary inline-flex items-center gap-2" onClick={() => setOpen(true)} type="button"><Plus size={16}/>{triggerLabel}</button>
        {open && createPortal(
          <div className="fixed inset-0 z-[2147483647] flex items-start sm:items-center justify-center p-0 sm:p-2 md:p-4 overflow-y-auto">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
            <div className="relative w-full max-w-2xl rounded-none sm:rounded-xl md:rounded-2xl shadow-2xl border-0 sm:border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden min-h-full sm:min-h-0 max-h-full sm:max-h-[90vh] flex flex-col my-0 sm:my-auto" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 sm:px-4 md:px-5 py-3 sm:py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0 sticky top-0 bg-white dark:bg-slate-950 z-10">
                <div className="text-base sm:text-base md:text-lg font-semibold">{editing ? "Edit Project" : "New Project"}</div>
                <button type="button" className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 touch-manipulation hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center" onClick={handleClose}><X size={18}/></button>
              </div>
              <form onSubmit={submit} className="px-4 sm:px-4 md:px-5 py-4 sm:py-4 overflow-y-auto flex-1 scrollbar-thin pb-safe">
                {renderForm(true)}
              </form>
            </div>
          </div>, document.body)
        }
      </>
    );
  }

  function renderForm(isDrawer) {
    return (
      <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="text-xs text-slate-500">Client / Platform</label>
          <select className="glass w-full px-3 h-11 rounded-xl" value={form.platform} onChange={(e) => { 
            set("platform", e.target.value); 
            set("profileId", ""); 
            set("agencyId", ""); 
            set("brandId", ""); 
            set("clientName", ""); 
          }}>
            <option>Fiverr</option>
            <option>Upwork</option>
            <option>Direct</option>
            <option>Agency</option>
          </select>
        </div>
        {(form.platform === "Fiverr" || form.platform === "Upwork") && availableProfiles.length > 0 && (
          <div>
            <label className="text-xs text-slate-500">Select Profile</label>
            <select className="glass w-full px-3 h-11 rounded-xl" value={form.profileId} onChange={(e) => {
              const selectedProfile = availableProfiles.find(p => p.id === e.target.value);
              set("profileId", e.target.value);
              if (selectedProfile) set("clientName", selectedProfile.name);
            }}>
              <option value="">Select profile...</option>
              {availableProfiles.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.username})</option>
              ))}
            </select>
          </div>
        )}
        {form.platform === "Agency" && agencies.length > 0 && (
          <div>
            <label className="text-xs text-slate-500">Select Agency</label>
            <select className="glass w-full px-3 h-11 rounded-xl" value={form.agencyId} onChange={(e) => {
              const selectedAgency = agencies.find(a => a.id === e.target.value);
              set("agencyId", e.target.value);
              if (selectedAgency) set("clientName", selectedAgency.name);
            }}>
              <option value="">Select agency...</option>
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>{a.name}{a.service ? ` • ${a.service}` : ''}</option>
              ))}
            </select>
          </div>
        )}
        {form.platform === "Direct" && brands.length > 0 && (
          <div>
            <label className="text-xs text-slate-500">Select Brand</label>
            <select className="glass w-full px-3 h-11 rounded-xl" value={form.brandId} onChange={(e) => {
              const selectedBrand = brands.find(b => b.id === e.target.value);
              set("brandId", e.target.value);
              if (selectedBrand) set("clientName", selectedBrand.name);
            }}>
              <option value="">Select brand...</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}{b.service ? ` • ${b.service}` : ''}</option>
              ))}
            </select>
          </div>
        )}
        {((form.platform === "Direct" || form.platform === "Agency") || (form.platform === "Fiverr" || form.platform === "Upwork")) && (
          <div>
            <label className="text-xs text-slate-500">Client or Company name</label>
            <input className="glass w-full px-3 h-11 rounded-xl" value={form.clientName} onChange={(e) => set("clientName", e.target.value)} />
          </div>
        )}
      </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <label className="text-xs text-slate-500">Project name</label>
          <input className="glass w-full px-3 h-11 rounded-xl" value={form.projectName} onChange={(e) => set("projectName", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Project value</label>
          <div className="flex gap-2">
            <select className="glass px-3 h-11 rounded-xl" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              <option>USD</option>
              <option>PKR</option>
            </select>
            <input className="glass w-full px-3 h-11 rounded-xl" type="number" step="0.01" value={form.amount} onChange={(e) => set("amount", e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-slate-50 dark:bg-slate-800/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors">
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
            checked={form.isRevision || false}
            onChange={(e) => set("isRevision", e.target.checked)}
          />
          <span className="text-sm text-slate-700 dark:text-slate-300">This is a paid revision project</span>
        </label>
      </div>

      <div className="text-xs uppercase tracking-wider text-slate-500 mt-3">Assigned employee(s) & cost</div>
      <AssignFromHR onPick={(emp)=>{
        setForm(f=>({
          ...f,
          assigned: [
            ...(f.assigned||[]),
            { employeeId: emp.id, name: emp.name, costType: 'fixed', costValue: '' }
          ]
        }));
      }} />
      <div className="grid gap-2 mt-2">
        {(form.assigned || []).length === 0 && (
          <div className="text-slate-500 text-sm">No employees assigned yet.</div>
        )}
        {(form.assigned || []).map((a, i) => (
          <div key={i} className="glass rounded-xl px-3 py-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-1 flex flex-col justify-end">
              <label className="text-xs text-slate-500 mb-1">Employee</label>
              <div className="font-medium h-9 flex items-center">{a.name || '-'}</div>
            </div>
            <div className="sm:col-span-1 flex flex-col justify-end">
              <label className="text-xs text-slate-500 mb-1">Employee Cost (PKR)</label>
              <input
                className="glass w-full px-3 h-9 rounded-xl"
                type="number"
                step="0.01"
                value={a.costValue || ''}
                onChange={(e) => setAssigned(i, "costValue", e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="sm:col-span-1 flex flex-col justify-end">
              <label className="text-xs text-slate-500 mb-1 invisible">Remove</label>
              <button type="button" className="btn btn-secondary h-9 w-full" onClick={() => removeAssignee(i)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <label className="text-xs text-slate-500">Service</label>
          <input className="glass w-full px-3 h-11 rounded-xl" value={form.service} onChange={(e) => set("service", e.target.value)} placeholder="e.g. Book cover design, Video editing" />
        </div>
        <div>
          <label className="text-xs text-slate-500">{form.isRevision ? "Revision Quantity" : "Quantity"}</label>
          <input className="glass w-full px-3 h-11 rounded-xl" type="number" min="0" step="1" value={form.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder={form.isRevision ? "e.g. 3 revisions" : "e.g. 10 videos, 2 book covers"} />
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs text-slate-500">
            Raw Source Link(s) (Google Drive, etc.)
          </label>
          <button
            type="button"
            onClick={addRawSourceLink}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
          >
            <Plus size={12} />
            Add link
          </button>
        </div>
        <div className="mt-2 space-y-2">
          {(form.rawSourceLinks && form.rawSourceLinks.length
            ? form.rawSourceLinks
            : [""]
          ).map((link, index) => (
            <div key={index} className="flex gap-2">
              <input
                className="glass w-full px-3 h-11 rounded-xl"
                type="url"
                value={link || ""}
                onChange={(e) => setRawSourceLinkAt(index, e.target.value)}
                placeholder="https://drive.google.com/..."
              />
              {((form.rawSourceLinks || []).length > 1 || index > 0) && (
                <button
                  type="button"
                  onClick={() => removeRawSourceLink(index)}
                  className="h-11 w-11 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/30 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/50"
                  title="Remove link"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-400 mt-1">
          One link per field. Use the + button to add multiple sources.
        </div>
      </div>

      <div className="mt-3">
        <label className="text-xs text-slate-500 mb-1">
          Internal Notes / Instructions for Employee
        </label>
        <textarea
          className="glass w-full px-3 py-2 rounded-xl min-h-[80px] resize-y"
          value={form.notes || ""}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Write any important notes, instructions or context for the assigned employee. These will also be included in the WhatsApp message."
        />
      </div>

      <div className="mt-3">
        <label className="text-xs text-slate-500 mb-2 block">Attachments (Files will auto-delete after 72 hours)</label>
        <div className="glass rounded-xl p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
          <label className="flex flex-col items-center justify-center cursor-pointer">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
              accept="image/*,video/*,application/pdf,application/zip,application/x-zip-compressed,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            />
            <div className="flex flex-col items-center gap-2">
              {uploading ? (
                <Loader2 className="text-blue-500 animate-spin" size={24} />
              ) : (
                <Upload className="text-slate-400" size={24} />
              )}
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {uploading ? 'Uploading...' : 'Click to upload files or drag and drop'}
              </span>
              <span className="text-xs text-slate-400">Max 50MB per file</span>
            </div>
          </label>
        </div>

        {/* Display uploaded files */}
        {form.attachments && form.attachments.length > 0 && (
          <div className="mt-3 space-y-2">
            {form.attachments.map((attachment, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
              >
                <File size={16} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <a
                    href={attachment.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline truncate block"
                  >
                    {attachment.name || 'Unnamed file'}
                  </a>
                  <div className="text-xs text-slate-400">
                    {attachment.size ? formatFileSize(attachment.size) : ''}
                    {attachment.expiresAt && (
                      <span className="ml-2">
                        • Expires: {new Date(attachment.expiresAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveAttachment(index)}
                  className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                  title="Remove attachment"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <label className="text-xs text-slate-500">Order Status</label>
          <select className="glass w-full px-3 h-11 rounded-xl" value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option>In Progress</option>
            <option>Completed</option>
            <option>Revising</option>
            <option>Cancel</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Timer / Deadline (date & time)</label>
          <input className="glass w-full px-3 h-11 rounded-xl" type="datetime-local" value={form.deadline || ""} onChange={(e) => set("deadline", e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
        <div>
          <label className="text-xs text-slate-500">Client payment date</label>
          <input className="glass w-full px-3 h-11 rounded-xl" type="date" required value={form.paidAt ? String(form.paidAt).slice(0, 10) : ""} onChange={(e) => set("paidAt", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Start date</label>
          <input className="glass w-full px-3 h-11 rounded-xl" type="date" value={form.startDate || ""} onChange={(e) => set("startDate", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-slate-500">End date</label>
          <input className="glass w-full px-3 h-11 rounded-xl" type="date" value={form.endDate || ""} onChange={(e) => set("endDate", e.target.value)} />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-4 pb-2">
        <button className="btn btn-primary flex-1 sm:flex-none" type="submit">{editing ? "Save Changes" : "Create Project"}</button>
        {editing && (
          <button type="button" className="btn btn-secondary flex-1 sm:flex-none" onClick={() => onDone && onDone()}>Cancel</button>
        )}
      </div>
      </>
    );
  }

  return <form onSubmit={submit}>{renderForm(false)}</form>;
}
