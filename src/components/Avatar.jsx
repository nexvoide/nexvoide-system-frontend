import React, { useState } from "react";

/**
 * Avatar component - displays user avatar with fallback to initials
 * @param {string} src - Avatar image URL
 * @param {string} name - User's name (used for initials fallback)
 * @param {string} size - Size variant: 'sm', 'md', 'lg', 'xl' (default: 'md')
 * @param {string} role - User role for gradient color
 * @param {boolean} showOnline - Show online indicator
 * @param {string} className - Additional CSS classes
 */
export default function Avatar({
  src,
  name = "User",
  size = "md",
  role = "employee",
  showOnline = false,
  className = "",
}) {
  const [imageError, setImageError] = useState(false);

  // Extract initials from name (first letter of first name)
  const getInitials = (name) => {
    if (!name) return "?";
    const firstName = name.trim().split(/\s+/)[0];
    return firstName.charAt(0).toUpperCase();
  };

  const initials = getInitials(name);

  // Size mappings
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-12 h-12 text-sm",
    lg: "w-16 h-16 text-base",
    xl: "w-20 h-20 text-lg",
  };

  const onlineIndicatorSizes = {
    sm: "w-2.5 h-2.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
    xl: "w-6 h-6",
  };

  // Role-based gradient colors
  const roleColors = {
    admin: "from-blue-500 to-blue-600",
    manager: "from-violet-500 to-violet-600",
    teamlead: "from-green-500 to-green-600",
    employee: "from-gray-500 to-gray-600",
    client: "from-yellow-500 to-yellow-600",
  };

  const gradientColor = roleColors[role?.toLowerCase()] || roleColors.employee;
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const onlineSize = onlineIndicatorSizes[size] || onlineIndicatorSizes.md;

  const shouldShowImage = src && !imageError;

  return (
    <div className={`relative inline-block ${className}`}>
      {shouldShowImage ? (
        <div
          className={`${sizeClass} rounded-2xl overflow-hidden border-2 ${
            showOnline
              ? "border-green-200 dark:border-green-800"
              : "border-slate-200 dark:border-slate-700"
          } shadow-xl ${
            showOnline
              ? "ring-2 ring-green-500/20 dark:ring-green-400/10"
              : "ring-2 ring-slate-500/20 dark:ring-slate-400/10"
          } relative bg-slate-100 dark:bg-slate-800`}>
          <img
            src={src}
            alt={name}
            className='w-full h-full object-cover'
            loading='eager'
            decoding='async'
            onError={() => setImageError(true)}
          />
        </div>
      ) : (
        <div
          className={`${sizeClass} rounded-2xl bg-gradient-to-br ${gradientColor} flex items-center justify-center text-white font-bold border-2 ${
            showOnline
              ? "border-green-200 dark:border-green-800"
              : "border-slate-200 dark:border-slate-700"
          } shadow-xl ${
            showOnline
              ? "ring-2 ring-green-500/20 dark:ring-green-400/10"
              : "ring-2 ring-slate-500/20 dark:ring-slate-400/10"
          }`}>
          {initials}
        </div>
      )}

      {/* Online indicator */}
      {showOnline && (
        <div
          className={`absolute -bottom-1 -right-1 ${onlineSize} rounded-full bg-green-500 animate-pulse border-2 border-white dark:border-slate-800 shadow-lg`}
          title='Online'
        />
      )}
    </div>
  );
}

