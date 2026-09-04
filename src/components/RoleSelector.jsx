import React, { useState } from "react";
import { motion } from "framer-motion";
import { User, Shield, Users, Briefcase, Crown, X } from "lucide-react";
import { ROLES, ROLE_LABELS, getRoleBadgeProps } from "../utils/permissions.js";
import { useAppStore } from "../stores/appStore.js";

export default function RoleSelector({ onRoleSelect }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userService, setUserService] = useState(""); // For Team Lead category
  const [userId, setUserId] = useState(""); // For Employee/Client ID

  const roles = [
    { 
      id: ROLES.ADMIN, 
      label: ROLE_LABELS[ROLES.ADMIN], 
      icon: Crown, 
      description: "Full access to all features and data",
      color: "blue"
    },
    { 
      id: ROLES.MANAGER, 
      label: ROLE_LABELS[ROLES.MANAGER], 
      icon: Shield, 
      description: "Manage projects and team, no finance access",
      color: "violet"
    },
    { 
      id: ROLES.TEAM_LEAD, 
      label: ROLE_LABELS[ROLES.TEAM_LEAD], 
      icon: Users, 
      description: "View and manage projects in your service category",
      color: "green",
      requiresService: true
    },
    { 
      id: ROLES.EMPLOYEE, 
      label: ROLE_LABELS[ROLES.EMPLOYEE], 
      icon: User, 
      description: "View only your assigned projects",
      color: "gray",
      requiresId: true
    },
    { 
      id: ROLES.CLIENT, 
      label: ROLE_LABELS[ROLES.CLIENT], 
      icon: Briefcase, 
      description: "Track your projects and status",
      color: "gold",
      requiresId: true
    },
  ];

  const handleRoleSelect = (role) => {
    setSelectedRole(role.id);
  };

  const handleContinue = () => {
    if (!selectedRole) return;
    
    const roleData = {
      role: selectedRole,
      name: userName || "User",
      email: userEmail || "",
      service: userService || "", // For Team Lead
      userId: userId || "", // For Employee/Client
    };

    onRoleSelect(roleData);
  };

  const selectedRoleData = roles.find(r => r.id === selectedRole);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Select Your Role
            </h2>
            <button
              onClick={() => onRoleSelect({ role: ROLES.ADMIN, name: "Admin" })} // Default to admin if closed
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            {roles.map((role) => {
              const Icon = role.icon;
              const badgeProps = getRoleBadgeProps(role.id);
              const isSelected = selectedRole === role.id;

              return (
                <motion.button
                  key={role.id}
                  onClick={() => handleRoleSelect(role)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    isSelected
                      ? `${badgeProps.border} ${badgeProps.bg} border-2`
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${badgeProps.bg}`}>
                      <Icon size={20} className={badgeProps.text} />
                    </div>
                    <div className="flex-1">
                      <div className={`font-semibold mb-1 ${isSelected ? badgeProps.text : 'text-slate-900 dark:text-slate-100'}`}>
                        {role.label}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {role.description}
                      </div>
                    </div>
                    {isSelected && (
                      <div className={`w-5 h-5 rounded-full ${badgeProps.bg} flex items-center justify-center`}>
                        <div className={`w-2 h-2 rounded-full ${badgeProps.text.replace('text-', 'bg-')}`} />
                      </div>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>

          {selectedRoleData && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div>
                <label className="text-xs text-slate-500 mb-1 block">Name</label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name"
                  className="glass w-full px-3 h-11 rounded-xl"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1 block">Email (Optional)</label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="glass w-full px-3 h-11 rounded-xl"
                />
              </div>

              {selectedRoleData.requiresService && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Service Category</label>
                  <select
                    value={userService}
                    onChange={(e) => setUserService(e.target.value)}
                    className="glass w-full px-3 h-11 rounded-xl"
                  >
                    <option value="">Select service category...</option>
                    <option value="Video Editing">Video Editing</option>
                    <option value="Graphic Design">Graphic Design</option>
                    <option value="Web Development">Web Development</option>
                    <option value="Content Writing">Content Writing</option>
                    <option value="SEO">SEO</option>
                    <option value="Social Media Management">Social Media Management</option>
                  </select>
                </div>
              )}

              {selectedRoleData.requiresId && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    {selectedRole === ROLES.EMPLOYEE ? "Employee ID/Name" : "Client ID/Name"}
                  </label>
                  <input
                    type="text"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder={selectedRole === ROLES.EMPLOYEE ? "Enter employee name" : "Enter client name"}
                    className="glass w-full px-3 h-11 rounded-xl"
                  />
                </div>
              )}

              <button
                onClick={handleContinue}
                disabled={!userName || (selectedRoleData.requiresService && !userService) || (selectedRoleData.requiresId && !userId)}
                className="w-full btn btn-primary h-11 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue as {selectedRoleData.label}
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

