import React from "react";
import { ROLE_LABELS, getRoleBadgeProps } from "../utils/permissions.js";

export default function RoleBadge({ role, className = "" }) {
  if (!role) return null;

  const badgeProps = getRoleBadgeProps(role);
  const label = ROLE_LABELS[role] || role;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badgeProps.bg} ${badgeProps.text} ${badgeProps.border} ${className}`}
    >
      {label}
    </span>
  );
}




