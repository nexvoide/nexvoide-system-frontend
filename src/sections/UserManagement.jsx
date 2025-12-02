import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, X, User, Shield, Users, Briefcase, Crown, Eye, EyeOff, Search, ChevronDown, Check } from "lucide-react";
import { useAppStore } from "../stores/appStore.js";
import { hashPassword, generatePassword } from "../utils/password.js";
import { ROLES, ROLE_LABELS, getRoleBadgeProps, normalizeRoles } from "../utils/permissions.js";
import * as db from "../lib/db.js";
import RoleBadge from "../components/RoleBadge.jsx";

export default function UserManagement() {
  const { user: currentUser } = useAppStore();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [showPassword, setShowPassword] = useState({});
  const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false);
  const rolesDropdownRef = useRef(null);

  // Form state
  const [form, setForm] = useState({
    username: "",
    password: "",
    roles: ["employee"], // Changed to array for multiple roles
    name: "",
    email: "",
    service: "",
    user_id: "",
    active: true,
    avatar: "",
  });

  // Load users
  useEffect(() => {
    loadUsers();
  }, []);

  // Close roles dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (rolesDropdownRef.current && !rolesDropdownRef.current.contains(event.target)) {
        setRolesDropdownOpen(false);
      }
    };

    if (rolesDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [rolesDropdownOpen]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await db.dbUsers.getAll();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load users:", error);
      alert("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (user = null) => {
    if (user) {
      setEditing(user);
      // Normalize role to array
      const roles = normalizeRoles(user.role, 'employee');
      
      setForm({
        username: user.username || "",
        password: "", // Don't show existing password
        roles: roles,
        name: user.name || "",
        email: user.email || "",
        service: user.service || "",
        user_id: user.user_id || "",
        active: user.active !== false,
        avatar: user.avatar || user.profile_picture || user.profilePicture || "",
      });
    } else {
      setEditing(null);
      setForm({
        username: "",
        password: "",
        roles: ["employee"],
        name: "",
        email: "",
        service: "",
        user_id: "",
        active: true,
        avatar: "",
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditing(null);
    setRolesDropdownOpen(false);
    setForm({
      username: "",
      password: "",
      roles: ["employee"],
      name: "",
      email: "",
      service: "",
      user_id: "",
      active: true,
      avatar: "",
    });
  };
  
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm({ ...form, avatar: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.username || !form.name) {
      alert("Username and name are required");
      return;
    }

    if (!editing && !form.password) {
      alert("Password is required for new users");
      return;
    }

    // Check if username is already taken (if editing and username changed, or if creating new user)
    if (editing && form.username !== editing.username) {
      // Username changed, check if new username is available
      const existingUser = users.find(u => u.username === form.username && u.id !== editing.id);
      if (existingUser) {
        alert(`Username "${form.username}" is already taken. Please choose a different username.`);
        return;
      }
    } else if (!editing) {
      // Creating new user, check if username exists
      const existingUser = users.find(u => u.username === form.username);
      if (existingUser) {
        alert(`Username "${form.username}" is already taken. Please choose a different username.`);
        return;
      }
    }

    try {
      // Store roles as JSON string in database (for compatibility with existing schema)
      const roleValue = Array.isArray(form.roles) && form.roles.length > 0 
        ? JSON.stringify(form.roles) 
        : JSON.stringify(["employee"]);
      
      const userData = {
        username: form.username,
        name: form.name,
        role: roleValue, // Store as JSON string
        email: form.email || null,
        service: form.service || null,
        user_id: form.user_id || null,
        active: form.active,
        avatar: form.avatar || null,
      };

      if (form.password) {
        userData.password_hash = hashPassword(form.password);
      }

      if (editing) {
        await db.dbUsers.update(editing.id, userData);
      } else {
        await db.dbUsers.create(userData);
      }

      await loadUsers();
      handleClose();
    } catch (error) {
      console.error("Failed to save user:", error);
      alert(`Failed to save user: ${error.message}`);
    }
  };

  const handleDelete = async (userId) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await db.dbUsers.delete(userId);
      await loadUsers();
    } catch (error) {
      console.error("Failed to delete user:", error);
      alert("Failed to delete user. Please try again.");
    }
  };

  const handleGeneratePassword = () => {
    const newPassword = generatePassword(12);
    setForm({ ...form, password: newPassword });
    setShowPassword({ ...showPassword, new: true });
  };

  const filteredUsers = useMemo(() => {
    if (!query) return users;
    const q = query.toLowerCase();
    return users.filter(
      (u) =>
        u.username?.toLowerCase().includes(q) ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.role?.toLowerCase().includes(q)
    );
  }, [users, query]);

  const roleIcons = {
    admin: Crown,
    manager: Shield,
    teamlead: Users,
    employee: User,
    client: Briefcase,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="glass rounded-2xl h-auto md:h-14 px-3 py-2 md:py-0 flex flex-col md:flex-row items-stretch md:items-center gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full pl-10 pr-4 py-2 bg-transparent border-none outline-none text-white placeholder-white/60 text-sm md:text-base"
            placeholder="Search users..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <button
          onClick={() => handleOpen()}
          className="btn btn-primary h-9 md:h-9 px-4 flex items-center justify-center gap-2 text-sm whitespace-nowrap touch-manipulation"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New </span>User
        </button>
      </div>

      <div className="grid gap-3">
        {filteredUsers.map((user) => {
          // Normalize role to array for display
          const userRoles = normalizeRoles(user.role, 'employee');
          const primaryRole = userRoles[0] || "employee";
          const RoleIcon = roleIcons[primaryRole] || User;
          return (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  {/* User Avatar */}
                  {user.avatar || user.profile_picture || user.profilePicture ? (
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border-2 border-slate-600 shadow-lg ring-2 ring-slate-500/20">
                        <img 
                          src={user.avatar || user.profile_picture || user.profilePicture} 
                          alt={user.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const parent = e.target.parentElement;
                            if (parent) {
                              parent.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-slate-700"><svg class="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg></div>`;
                            }
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="p-2 rounded-lg bg-slate-700 flex-shrink-0">
                      <RoleIcon size={20} className="text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-100 truncate">
                      {user.name}
                    </div>
                    <div className="text-sm text-slate-400 truncate">
                      @{user.username}
                    </div>
                    {user.email && (
                      <div className="text-xs text-slate-500 truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {userRoles.map((role) => (
                      <RoleBadge key={role} role={role} />
                    ))}
                  </div>
                  {!user.active && (
                    <span className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 border border-red-500/30">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpen(user)}
                    className="btn btn-secondary small"
                  >
                    <Pencil size={14} />
                  </button>
                  {user.id !== currentUser?.id && (
                    <button
                      onClick={() => handleDelete(user.id)}
                      className="btn btn-danger small"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}

        {filteredUsers.length === 0 && (
          <div className="text-center py-12 text-slate-500">
            {query ? "No users found matching your search." : "No users found."}
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden max-h-[90vh] overflow-y-auto my-4"
          >
            <div className="p-4 md:p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {editing ? "Edit User" : "Create New User"}
                </h2>
                <button
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {/* Profile Picture/Avatar */}
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    Profile Photo / Avatar
                  </label>
                  <div className="flex items-center gap-3">
                    {form.avatar && (
                      <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 flex-shrink-0">
                        <img src={form.avatar} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <label className="flex-1 cursor-pointer">
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleImageUpload} 
                        className="hidden" 
                      />
                      <div className="glass w-full px-3 py-2 rounded-xl flex items-center justify-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                        {form.avatar ? 'Change Photo' : 'Upload Photo'}
                      </div>
                    </label>
                    {form.avatar && (
                      <button 
                        type="button" 
                        onClick={() => setForm({ ...form, avatar: '' })} 
                        className="btn btn-secondary px-3 py-2 text-xs"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div>
                    <label className="text-xs md:text-sm text-slate-500 mb-1 block">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      placeholder="Enter username"
                      className="glass w-full px-3 h-11 rounded-xl text-base md:text-sm"
                    />
                    {editing && (
                      <p className="text-xs text-slate-400 mt-1">
                        Note: Changing username will require the user to login with the new username
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs md:text-sm text-slate-500 mb-1 block">
                      Name *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Enter full name"
                      className="glass w-full px-3 h-11 rounded-xl text-base md:text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    Password {editing ? "(leave blank to keep current)" : "*"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword[editing ? "edit" : "new"] ? "text" : "password"}
                      value={form.password}
                      onChange={(e) =>
                        setForm({ ...form, password: e.target.value })
                      }
                      placeholder={editing ? "Enter new password" : "Enter password"}
                      className="glass w-full px-3 h-11 rounded-xl pr-20"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleGeneratePassword}
                        className="text-xs text-blue-400 hover:text-blue-300"
                      >
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword({
                            ...showPassword,
                            [editing ? "edit" : "new"]: !showPassword[editing ? "edit" : "new"],
                          })
                        }
                        className="text-slate-400 hover:text-slate-300"
                      >
                        {showPassword[editing ? "edit" : "new"] ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                  <div className="relative" ref={rolesDropdownRef}>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Roles * (Select multiple)
                    </label>
                    <button
                      type="button"
                      onClick={() => setRolesDropdownOpen(!rolesDropdownOpen)}
                      className="glass w-full px-3 h-11 rounded-xl flex items-center justify-between text-left hover:bg-slate-700/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        {form.roles.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            {form.roles.map((role) => (
                              <span
                                key={role}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30"
                              >
                          {ROLE_LABELS[role]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">Select roles...</span>
                        )}
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-slate-400 transition-transform flex-shrink-0 ${
                          rolesDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {rolesDropdownOpen && (
                      <div className="absolute z-50 w-full mt-1 glass rounded-xl border border-slate-700 shadow-xl max-h-64 overflow-y-auto">
                        <div className="p-2 space-y-1">
                          {Object.values(ROLES).map((role) => {
                            const isSelected = form.roles.includes(role);
                            return (
                              <label
                                key={role}
                                className="flex items-center gap-2 cursor-pointer hover:bg-slate-700/50 p-2 rounded-lg transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                }}
                              >
                                <div className="relative flex items-center justify-center w-4 h-4">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (e.target.checked) {
                                        setForm({
                                          ...form,
                                          roles: [...form.roles, role],
                                        });
                                      } else {
                                        setForm({
                                          ...form,
                                          roles: form.roles.filter((r) => r !== role),
                                        });
                                      }
                                    }}
                                    className="absolute w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500 cursor-pointer opacity-0 peer"
                                  />
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                                    isSelected
                                      ? 'bg-blue-500 border-blue-500'
                                      : 'bg-slate-800 border-slate-600'
                                  } peer-hover:border-blue-400`}>
                                    {isSelected && (
                                      <Check size={12} className="text-white" />
                                    )}
                                  </div>
                                </div>
                                <span className="text-sm text-slate-200 flex-1">
                                  {ROLE_LABELS[role]}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {form.roles.length === 0 && (
                      <p className="text-xs text-red-400 mt-1">
                        At least one role must be selected
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      placeholder="Enter email"
                      className="glass w-full px-3 h-11 rounded-xl"
                    />
                  </div>
                </div>

                {form.roles.includes(ROLES.TEAM_LEAD) && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Service Category
                    </label>
                    <select
                      value={form.service}
                      onChange={(e) =>
                        setForm({ ...form, service: e.target.value })
                      }
                      className="glass w-full px-3 h-11 rounded-xl"
                    >
                      <option value="">Select service category...</option>
                      <option value="Video Editing">Video Editing</option>
                      <option value="Graphic Design">Graphic Design</option>
                      <option value="Web Development">Web Development</option>
                      <option value="Content Writing">Content Writing</option>
                      <option value="SEO">SEO</option>
                      <option value="Social Media Management">
                        Social Media Management
                      </option>
                    </select>
                  </div>
                )}

                {!form.roles.includes(ROLES.ADMIN) && (
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      {form.roles.includes(ROLES.CLIENT)
                        ? "Client ID/Name"
                        : "Employee ID/Name"}
                    </label>
                    <input
                      type="text"
                      value={form.user_id}
                      onChange={(e) =>
                        setForm({ ...form, user_id: e.target.value })
                      }
                      placeholder={
                        form.roles.includes(ROLES.CLIENT)
                          ? "Enter client name"
                          : "Enter employee name"}
                      className="glass w-full px-3 h-11 rounded-xl"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="active"
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                    className="w-4 h-4 rounded"
                  />
                  <label
                    htmlFor="active"
                    className="text-sm text-slate-500 dark:text-slate-400"
                  >
                    Active (user can login)
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleClose}
                  className="flex-1 btn btn-secondary h-11"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 btn btn-primary h-11"
                >
                  {editing ? "Update User" : "Create User"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

