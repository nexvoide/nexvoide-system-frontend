import React, { useState, useEffect } from "react";
import { useAppStore } from "../stores/appStore.js";
import {
  Plus,
  Pencil,
  Trash2,
  X,
  User,
  Building2,
  Briefcase,
  Download,
  MapPin,
} from "lucide-react";
import { generateInvoicePDF } from "../utils/pdfGenerator.js";
import {
  useFilteredClients,
  useFilteredProjects,
} from "../hooks/useRoleFilter.js";

export default function Setup() {
  const {
    currency,
    rate,
    addProfile,
    updateProfile,
    deleteProfile,
    addAgency,
    updateAgency,
    deleteAgency,
    addBrand,
    updateBrand,
    deleteBrand,
  } = useAppStore();
  const { profiles, agencies, brands } = useFilteredClients(); // Use filtered clients based on role
  const projects = useFilteredProjects(); // Use filtered projects based on role
  const [activeTab, setActiveTab] = useState("profiles");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [editType, setEditType] = useState("profile");

  function startCreate(type) {
    setEditType(type);
    setEditing(null);
    setOpen(true);
  }

  function startEdit(item, type) {
    setEditType(type);
    setEditing(item);
    setOpen(true);
  }

  async function handleSave(data) {
    try {
      if (editType === "profile") {
        if (editing) await updateProfile(editing.id, data);
        else await addProfile(data);
      } else if (editType === "agency") {
        if (editing) await updateAgency(editing.id, data);
        else await addAgency(data);
      } else if (editType === "brand") {
        if (editing) await updateBrand(editing.id, data);
        else await addBrand(data);
      }
      setOpen(false);
    } catch (error) {
      console.error("Failed to save:", error);
      alert("Failed to save. Please try again.");
    }
  }

  return (
    <div className='grid gap-3'>
      <div className='glass rounded-2xl h-auto md:h-11 px-3 py-2 md:py-0 flex flex-col md:flex-row items-stretch md:items-center gap-2 overflow-x-auto'>
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <button
            className={`px-3 py-1.5 md:py-1 rounded-lg text-xs md:text-sm whitespace-nowrap touch-manipulation ${
              activeTab === "profiles" ? "bg-accent text-accent-foreground" : ""
            }`}
            onClick={() => setActiveTab("profiles")}>
            Freelance Profiles
          </button>
          <button
            className={`px-3 py-1.5 md:py-1 rounded-lg text-xs md:text-sm whitespace-nowrap touch-manipulation ${
              activeTab === "agencies" ? "bg-accent text-accent-foreground" : ""
            }`}
            onClick={() => setActiveTab("agencies")}>
            Collaborative Agencies
          </button>
          <button
            className={`px-3 py-1.5 md:py-1 rounded-lg text-xs md:text-sm whitespace-nowrap touch-manipulation ${
              activeTab === "brands" ? "bg-accent text-accent-foreground" : ""
            }`}
            onClick={() => setActiveTab("brands")}>
            Business and Brands
          </button>
        </div>
        <div className='flex-1 hidden md:block' />
        <button
          className='btn btn-primary inline-flex items-center gap-2 text-sm whitespace-nowrap touch-manipulation'
          onClick={() =>
            startCreate(
              activeTab === "profiles"
                ? "profile"
                : activeTab === "agencies"
                ? "agency"
                : "brand"
            )
          }>
          <Plus size={16} /> Add{" "}
          {activeTab === "profiles"
            ? "Profile"
            : activeTab === "agencies"
            ? "Agency"
            : "Brand"}
        </button>
      </div>

      {activeTab === "profiles" && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4'>
          {profiles.map((p) => (
            <div
              key={p.id}
              className='card group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative'>
              {/* Gradient background accent */}
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-red-500'></div>

              <div className='p-4'>
                <div className='flex items-start gap-4 mb-4'>
                  <div className='relative'>
                    {p.logo ? (
                      <div className='w-16 h-16 rounded-2xl overflow-hidden border-2 border-orange-200 dark:border-orange-800 shadow-xl ring-4 ring-orange-500/20 dark:ring-orange-400/10'>
                        <img
                          src={p.logo}
                          alt={p.name}
                          className='w-full h-full object-cover'
                        />
                      </div>
                    ) : (
                      <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-red-500 flex items-center justify-center text-white font-bold text-xl shadow-xl ring-4 ring-orange-500/20 dark:ring-orange-400/10'>
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className='absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center'>
                      <User size={12} className='text-orange-500' />
                    </div>
                  </div>
                  <div className='flex-1 min-w-0 pt-1'>
                    <div className='font-bold text-lg mb-1 truncate'>
                      {p.name}
                    </div>
                    <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium'>
                      <User size={11} />
                      {p.platform}
                    </div>
                  </div>
                </div>

                {p.service && (
                  <div className='mb-4 p-3 rounded-xl bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/20 dark:to-pink-950/20 border border-orange-200/50 dark:border-orange-800/30'>
                    <div className='text-xs font-medium text-orange-700 dark:text-orange-300 mb-1.5 uppercase tracking-wide'>
                      Service
                    </div>
                    <div className='font-semibold text-sm text-slate-900 dark:text-slate-100 truncate'>
                      {p.service}
                    </div>
                  </div>
                )}

                {p.username && (
                  <div className='mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                    <div className='text-xs text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide'>
                      Username
                    </div>
                    <div className='text-sm font-semibold text-slate-900 dark:text-slate-100 truncate flex items-center gap-2'>
                      <div className='w-1.5 h-1.5 rounded-full bg-green-500'></div>
                      {p.username}
                    </div>
                  </div>
                )}

                <div className='mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                  <button
                    className='btn btn-secondary px-4 py-2 text-xs font-medium hover:bg-blue-500 hover:text-white transition-colors'
                    onClick={() => startEdit(p, "profile")}>
                    <Pencil size={14} className='mr-1.5' />
                    Edit
                  </button>
                  <button
                    className='btn btn-secondary px-4 py-2 text-xs font-medium hover:bg-red-500 hover:text-white transition-colors'
                    onClick={async () => {
                      if (
                        confirm("Are you sure you want to delete this profile?")
                      ) {
                        try {
                          await deleteProfile(p.id);
                        } catch (error) {
                          console.error("Failed to delete profile:", error);
                          alert("Failed to delete profile. Please try again.");
                        }
                      }
                    }}>
                    <Trash2 size={14} className='mr-1.5' />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {profiles.length === 0 && (
            <div className='col-span-full text-center py-12 text-slate-500'>
              <User size={48} className='mx-auto mb-3 opacity-50' />
              <div className='text-sm'>No profiles yet.</div>
            </div>
          )}
        </div>
      )}

      {activeTab === "agencies" && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4'>
          {agencies.map((a) => (
            <div
              key={a.id}
              className='card group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative'>
              {/* Gradient background accent */}
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-teal-500 to-emerald-500'></div>

              <div className='p-4'>
                <div className='flex items-start gap-4 mb-4'>
                  <div className='relative'>
                    {a.logo ? (
                      <div className='w-16 h-16 rounded-2xl overflow-hidden border-2 border-green-200 dark:border-green-800 shadow-xl ring-4 ring-green-500/20 dark:ring-green-400/10'>
                        <img
                          src={a.logo}
                          alt={a.name}
                          className='w-full h-full object-cover'
                        />
                      </div>
                    ) : (
                      <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 via-teal-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xl shadow-xl ring-4 ring-green-500/20 dark:ring-green-400/10'>
                        {a.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className='absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center'>
                      <Building2 size={12} className='text-green-500' />
                    </div>
                  </div>
                  <div className='flex-1 min-w-0 pt-1'>
                    <div className='font-bold text-lg mb-1 truncate'>
                      {a.name}
                    </div>
                    <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium'>
                      <Building2 size={11} />
                      Agency
                    </div>
                  </div>
                </div>

                {a.service && (
                  <div className='mb-4 p-3 rounded-xl bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20 border border-green-200/50 dark:border-green-800/30'>
                    <div className='text-xs font-medium text-green-700 dark:text-green-300 mb-1.5 uppercase tracking-wide'>
                      Service
                    </div>
                    <div className='font-semibold text-sm text-slate-900 dark:text-slate-100 truncate'>
                      {a.service}
                    </div>
                  </div>
                )}

                {(a.street || a.city || a.state || a.country || a.zip) && (
                  <div className='mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                    <div className='flex items-start gap-2 mb-2'>
                      <MapPin size={14} className='text-green-500 mt-0.5' />
                      <div className='text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide'>
                        Address
                      </div>
                    </div>
                    <div className='text-sm text-slate-700 dark:text-slate-300'>
                      {a.street && <div>{a.street}</div>}
                      {(a.city || a.state || a.zip) && (
                        <div>
                          {[a.city, a.state, a.zip].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {a.country && <div>{a.country}</div>}
                    </div>
                  </div>
                )}

                <div className='mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center'>
                  <button
                    className='glass px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:bg-green-500/15 hover:text-green-400 transition-colors'
                    onClick={() => {
                      try {
                        generateInvoicePDF(
                          a,
                          projects,
                          "agency",
                          currency,
                          rate
                        );
                      } catch (error) {
                        console.error("Failed to generate PDF:", error);
                        alert("Failed to generate PDF. Please try again.");
                      }
                    }}>
                    <Download size={14} />
                    Invoice PDF
                  </button>
                  <div className='flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                    <button
                      className='btn btn-secondary px-4 py-2 text-xs font-medium hover:bg-blue-500 hover:text-white transition-colors'
                      onClick={() => startEdit(a, "agency")}>
                      <Pencil size={14} className='mr-1.5' />
                      Edit
                    </button>
                    <button
                      className='btn btn-secondary px-4 py-2 text-xs font-medium hover:bg-red-500 hover:text-white transition-colors'
                      onClick={async () => {
                        if (
                          confirm(
                            "Are you sure you want to delete this agency?"
                          )
                        ) {
                          try {
                            await deleteAgency(a.id);
                          } catch (error) {
                            console.error("Failed to delete agency:", error);
                            alert("Failed to delete agency. Please try again.");
                          }
                        }
                      }}>
                      <Trash2 size={14} className='mr-1.5' />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {agencies.length === 0 && (
            <div className='col-span-full text-center py-12 text-slate-500'>
              <Building2 size={48} className='mx-auto mb-3 opacity-50' />
              <div className='text-sm'>No agencies yet.</div>
            </div>
          )}
        </div>
      )}

      {activeTab === "brands" && (
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4'>
          {brands.map((b) => (
            <div
              key={b.id}
              className='card group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative'>
              {/* Gradient background accent */}
              <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-violet-500'></div>

              <div className='p-4'>
                <div className='flex items-start gap-4 mb-4'>
                  <div className='relative'>
                    {b.logo ? (
                      <div className='w-16 h-16 rounded-2xl overflow-hidden border-2 border-purple-200 dark:border-purple-800 shadow-xl ring-4 ring-purple-500/20 dark:ring-purple-400/10'>
                        <img
                          src={b.logo}
                          alt={b.name}
                          className='w-full h-full object-cover'
                        />
                      </div>
                    ) : (
                      <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xl shadow-xl ring-4 ring-purple-500/20 dark:ring-purple-400/10'>
                        {b.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className='absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center'>
                      <Briefcase size={12} className='text-purple-500' />
                    </div>
                  </div>
                  <div className='flex-1 min-w-0 pt-1'>
                    <div className='font-bold text-lg mb-1 truncate'>
                      {b.name}
                    </div>
                    <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium'>
                      <Briefcase size={11} />
                      Brand
                    </div>
                  </div>
                </div>

                {b.service && (
                  <div className='mb-4 p-3 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200/50 dark:border-purple-800/30'>
                    <div className='text-xs font-medium text-purple-700 dark:text-purple-300 mb-1.5 uppercase tracking-wide'>
                      Service
                    </div>
                    <div className='font-semibold text-sm text-slate-900 dark:text-slate-100 truncate'>
                      {b.service}
                    </div>
                  </div>
                )}

                {(b.street || b.city || b.state || b.country || b.zip) && (
                  <div className='mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                    <div className='flex items-start gap-2 mb-2'>
                      <MapPin size={14} className='text-purple-500 mt-0.5' />
                      <div className='text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide'>
                        Address
                      </div>
                    </div>
                    <div className='text-sm text-slate-700 dark:text-slate-300'>
                      {b.street && <div>{b.street}</div>}
                      {(b.city || b.state || b.zip) && (
                        <div>
                          {[b.city, b.state, b.zip].filter(Boolean).join(", ")}
                        </div>
                      )}
                      {b.country && <div>{b.country}</div>}
                    </div>
                  </div>
                )}

                <div className='mt-5 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center'>
                  <button
                    className='glass px-3 py-1.5 rounded-lg text-xs inline-flex items-center gap-1 text-slate-700 dark:text-slate-300 hover:bg-purple-500/15 hover:text-purple-400 transition-colors'
                    onClick={() => {
                      try {
                        generateInvoicePDF(
                          b,
                          projects,
                          "brand",
                          currency,
                          rate
                        );
                      } catch (error) {
                        console.error("Failed to generate PDF:", error);
                        alert("Failed to generate PDF. Please try again.");
                      }
                    }}>
                    <Download size={14} />
                    Invoice PDF
                  </button>
                  <div className='flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300'>
                    <button
                      className='btn btn-secondary px-4 py-2 text-xs font-medium hover:bg-blue-500 hover:text-white transition-colors'
                      onClick={() => startEdit(b, "brand")}>
                      <Pencil size={14} className='mr-1.5' />
                      Edit
                    </button>
                    <button
                      className='btn btn-secondary px-4 py-2 text-xs font-medium hover:bg-red-500 hover:text-white transition-colors'
                      onClick={async () => {
                        if (
                          confirm("Are you sure you want to delete this brand?")
                        ) {
                          try {
                            await deleteBrand(b.id);
                          } catch (error) {
                            console.error("Failed to delete brand:", error);
                            alert("Failed to delete brand. Please try again.");
                          }
                        }
                      }}>
                      <Trash2 size={14} className='mr-1.5' />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {brands.length === 0 && (
            <div className='col-span-full text-center py-12 text-slate-500'>
              <Briefcase size={48} className='mx-auto mb-3 opacity-50' />
              <div className='text-sm'>No brands yet.</div>
            </div>
          )}
        </div>
      )}

      {open && (
        <SetupDrawer
          type={editType}
          initial={editing}
          onClose={() => setOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function SetupDrawer({ type, initial, onClose, onSave }) {
  const [form, setForm] = useState(
    () =>
      initial || {
        name: "",
        platform: "Fiverr",
        username: "",
        service: "",
        logo: "",
        street: "",
        city: "",
        state: "",
        country: "",
        zip: "",
        notes: "",
      }
  );
  useEffect(() => {
    if (initial) setForm(initial);
  }, [initial]);
  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      // 2MB limit
      alert("Image size must be less than 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      set("logo", reader.result);
    };
    reader.readAsDataURL(file);
  }

  function submit(e) {
    e.preventDefault();
    onSave(form);
  }

  // Prevent body scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className='fixed inset-0 z-[2147483647] flex items-center justify-center p-2 sm:p-3 md:p-4'>
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />
      <div className='relative w-full max-w-md rounded-xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden max-h-[95vh] sm:max-h-[90vh] flex flex-col mx-2 sm:mx-0' onClick={(e) => e.stopPropagation()}>
        <div className='flex items-center justify-between px-3 sm:px-4 md:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex-shrink-0'>
          <div className='text-base sm:text-lg font-semibold'>
            {initial ? `Edit ${type}` : `Add ${type}`}
          </div>
          <button
            type='button'
            className='p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors touch-manipulation'
            onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <form
          onSubmit={submit}
          className='px-3 sm:px-4 md:px-5 py-3 sm:py-4 overflow-y-auto flex-1 scrollbar-thin'>
          <div className='grid gap-3'>
            <div>
              <label className='text-xs text-slate-500'>Name</label>
              <input
                className='glass w-full px-3 h-11 rounded-xl'
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div>
              <label className='text-xs text-slate-500'>Logo / Image</label>
              <div className='flex items-center gap-3'>
                {form.logo && (
                  <div className='w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 flex-shrink-0'>
                    <img
                      src={form.logo}
                      alt='Logo'
                      className='w-full h-full object-cover'
                    />
                  </div>
                )}
                <label className='flex-1 cursor-pointer'>
                  <input
                    type='file'
                    accept='image/*'
                    onChange={handleImageUpload}
                    className='hidden'
                  />
                  <div className='glass w-full px-3 h-11 rounded-xl flex items-center justify-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors'>
                    {form.logo ? "Change Logo" : "Upload Logo"}
                  </div>
                </label>
                {form.logo && (
                  <button
                    type='button'
                    onClick={() => set("logo", "")}
                    className='btn btn-secondary px-3 h-11 text-xs'>
                    Remove
                  </button>
                )}
              </div>
            </div>
            {type === "profile" && (
              <>
                <div>
                  <label className='text-xs text-slate-500'>Platform</label>
                  <select
                    className='glass w-full px-3 h-11 rounded-xl'
                    value={form.platform}
                    onChange={(e) => set("platform", e.target.value)}>
                    <option>Fiverr</option>
                    <option>Upwork</option>
                  </select>
                </div>
                <div>
                  <label className='text-xs text-slate-500'>Service</label>
                  <input
                    className='glass w-full px-3 h-11 rounded-xl'
                    value={form.service || ""}
                    onChange={(e) => set("service", e.target.value)}
                    placeholder='e.g. Book cover design, Video editing'
                  />
                </div>
                <div>
                  <label className='text-xs text-slate-500'>Username</label>
                  <input
                    className='glass w-full px-3 h-11 rounded-xl'
                    value={form.username || ""}
                    onChange={(e) => set("username", e.target.value)}
                  />
                </div>
              </>
            )}
            {(type === "agency" || type === "brand") && (
              <>
                <div>
                  <label className='text-xs text-slate-500'>Service</label>
                  <input
                    className='glass w-full px-3 h-11 rounded-xl'
                    value={form.service || ""}
                    onChange={(e) => set("service", e.target.value)}
                    placeholder='e.g. Book cover design, Video editing'
                  />
                </div>
                <div>
                  <label className='text-xs text-slate-500'>
                    Street Address
                  </label>
                  <input
                    className='glass w-full px-3 h-11 rounded-xl'
                    value={form.street || ""}
                    onChange={(e) => set("street", e.target.value)}
                    placeholder='Street address'
                  />
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <div>
                    <label className='text-xs text-slate-500'>City</label>
                    <input
                      className='glass w-full px-3 h-11 rounded-xl'
                      value={form.city || ""}
                      onChange={(e) => set("city", e.target.value)}
                      placeholder='City'
                    />
                  </div>
                  <div>
                    <label className='text-xs text-slate-500'>
                      State/Province
                    </label>
                    <input
                      className='glass w-full px-3 h-11 rounded-xl'
                      value={form.state || ""}
                      onChange={(e) => set("state", e.target.value)}
                      placeholder='State'
                    />
                  </div>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <div>
                    <label className='text-xs text-slate-500'>Country</label>
                    <input
                      className='glass w-full px-3 h-11 rounded-xl'
                      value={form.country || ""}
                      onChange={(e) => set("country", e.target.value)}
                      placeholder='Country'
                    />
                  </div>
                  <div>
                    <label className='text-xs text-slate-500'>
                      ZIP/Postal Code
                    </label>
                    <input
                      className='glass w-full px-3 h-11 rounded-xl'
                      value={form.zip || ""}
                      onChange={(e) => set("zip", e.target.value)}
                      placeholder='ZIP Code'
                    />
                  </div>
                </div>
              </>
            )}
            <div>
              <label className='text-xs text-slate-500'>Notes</label>
              <textarea
                className='glass w-full px-3 py-2 rounded-xl'
                rows={3}
                value={form.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            <div className='flex items-center gap-2 mt-2'>
              <button className='btn btn-primary' type='submit'>
                Save
              </button>
              <button
                type='button'
                className='btn btn-secondary'
                onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
