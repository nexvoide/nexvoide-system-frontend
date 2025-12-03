import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  User,
  Building2,
  Briefcase,
  Clock,
  Calendar,
  GripVertical,
  Activity,
  Users,
  Wallet,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useAppStore, convert } from "../stores/appStore.js";
import * as db from "../lib/db.js";
import GridLayout from "react-grid-layout";
import {
  useFilteredProjects,
  useFilteredEmployees,
  useFilteredClients,
  useCanViewFinanceDetails,
  useCanViewActivityLogs,
} from "../hooks/useRoleFilter.js";
import { ROLES, normalizeRoles, hasRole } from "../utils/permissions.js";
import Avatar from "../components/Avatar.jsx";

export default function Dashboard() {
  const { currency, rate, loading, activityLogs, loadActivityLogs, user, projects: allProjects, agencies: allAgencies, brands: allBrands, profiles: allProfiles, allUsers } =
    useAppStore();
  const projects = useFilteredProjects(); // Use filtered projects based on role
  const employees = useFilteredEmployees(); // Use filtered employees based on role
  const { profiles, agencies, brands } = useFilteredClients(); // Use filtered clients based on role
  const canViewFinanceDetails = useCanViewFinanceDetails();
  const canViewActivityLogs = useCanViewActivityLogs();

  // Track which users are online (users list comes from store)
  const [onlineUserIds, setOnlineUserIds] = useState(new Set());

  // Update current user's online status (heartbeat) - OPTIMIZED: Only on mount/unmount and visibility changes
  useEffect(() => {
    if (!user) return;

    const userId = user.id || user.username;
    if (!userId) return;

    const updateOnlineStatus = async () => {
      try {
        await db.dbUserOnlineStatus.updateStatus(userId);
      } catch (e) {
        console.warn('Failed to update online status:', e);
      }
    };

    const removeOnlineStatus = async () => {
      try {
        await db.dbUserOnlineStatus.removeStatus(userId);
      } catch (e) {
        console.warn('Failed to remove online status:', e);
      }
    };

    // Update immediately on mount
    updateOnlineStatus();

    // Update when page becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        updateOnlineStatus();
      }
    };

    // Update on focus (user switches back to window)
    const handleFocus = () => {
      updateOnlineStatus();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Clean up on page unload
    const handleBeforeUnload = () => {
      removeOnlineStatus();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup on unmount
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      removeOnlineStatus();
    };
  }, [user]); // Only re-run if user changes

  // Load online status with Supabase Realtime - INSTANT updates when users go online/offline
  useEffect(() => {
    if (!allUsers || allUsers.length === 0) return;
    
    let isMounted = true;
    
    const loadOnlineStatus = async () => {
      try {
        // Only check online status (users are already loaded from store)
        const onlineIds = await db.dbUserOnlineStatus.getOnlineUsers(60); // 60 second threshold

        if (isMounted) {
          setOnlineUserIds(onlineIds);
        }
      } catch (e) {
        console.warn("Failed to load online status:", e);
        if (isMounted) {
          setOnlineUserIds(new Set());
        }
      }
    };

    // Load immediately
    loadOnlineStatus();

    // Setup Supabase Realtime subscription for instant online status updates
    let subscription = null;
    const setupRealtimeSubscription = async () => {
      try {
        const { supabase, isSupabaseConfigured } = await import('../lib/supabase.js');
        if (!isSupabaseConfigured || !supabase) return;

        const channel = supabase
          .channel('online-status-changes')
          .on(
            'postgres_changes',
            {
              event: '*', // INSERT, UPDATE, DELETE
              schema: 'public',
              table: 'user_online_status',
            },
            async (payload) => {
              // When online status changes, reload the list
              if (isMounted) {
                await loadOnlineStatus();
              }
            }
          )
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              console.log('✅ Subscribed to online status changes');
            }
          });

        subscription = channel;
      } catch (e) {
        console.warn('Failed to setup online status realtime subscription:', e);
      }
    };

    setupRealtimeSubscription();

    // Also refresh when page becomes visible (fallback)
    const handleVisibilityChange = () => {
      if (!document.hidden && isMounted) {
        loadOnlineStatus();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (subscription) {
        subscription.unsubscribe().catch(() => {});
      }
    };
  }, [allUsers]); // Re-run only when users from store change

  // Get user-specific layout key
  const layoutKey = useMemo(() => {
    const userId = user?.id || user?.username || "default";
    return `dashboard_layout_${userId}`;
  }, [user]);

  // Get mobile-adjusted layout
  const getMobileLayout = (layout) => {
    if (!isMobile) return layout;
    // On mobile with 4 columns, stack all widgets vertically (full width)
    let currentY = 0;
    return layout.map((item, index) => {
      // All widgets take full width (4 columns) on mobile
      const newW = 4;
      const newH = Math.max(item.h || 2, 2); // Keep height but ensure minimum
      const newY = currentY;
      currentY += newH + 1; // Add spacing between widgets
      
      return {
        ...item,
        w: newW,
        h: newH,
        x: 0, // Always start at left
        y: newY,
        minW: 1,
        maxW: 4
      };
    });
  };

  // Default layout configuration (conditionally include netprofit and activitylogs based on permissions)
  const defaultLayout = useMemo(() => {
    const base = [
      {
        i: "activeprojects",
        x: 0,
        y: 0,
        w: 12,
        h: 6,
        minW: 3,
        minH: 3,
        maxW: 12,
        maxH: 15,
      },
      {
        i: "onlineteam",
        x: 0,
        y: 6,
        w: 4,
        h: 4,
        minW: 3,
        minH: 2,
        maxW: 12,
        maxH: 8,
      },
    ];

    // Add activity logs widget only if user has permission
    if (canViewActivityLogs) {
      base.push({
        i: "activitylogs",
        x: 4,
        y: 6,
        w: 8,
        h: 5,
        minW: 4,
        minH: 3,
        maxW: 12,
        maxH: 12,
      });
    }

    // Add employee earnings widget for non-admin users
    if (user && user.role && !hasRole(normalizeRoles(user.role), ROLES.ADMIN)) {
      base.unshift({
        i: "myearnings",
        x: 0,
        y: 0,
        w: 4,
        h: 2,
        minW: 2,
        minH: 1,
        maxW: 12,
        maxH: 10,
      });
      // Adjust other widgets positions
      if (base.length > 1) {
      base[1] = {
          ...base[1],
          x: base[1].x === 0 ? 4 : base[1].x,
        };
      }
    }

    if (canViewFinanceDetails) {
      // Insert netprofit at the beginning (or after myearnings/clientstats if it exists)
      const roles = user && user.role ? normalizeRoles(user.role) : [];
      const isNotAdmin = user && user.role && !hasRole(roles, ROLES.ADMIN);
      const insertIndex = isNotAdmin ? 1 : 0;
      base.splice(insertIndex, 0, {
        i: "netprofit",
        x: isNotAdmin ? 4 : 0,
        y: 0,
        w: 4,
        h: 2,
        minW: 2,
        minH: 1,
        maxW: 12,
        maxH: 10,
      });
      // Adjust activeprojects position
      const activeProjectsIndex = base.findIndex(item => item.i === "activeprojects");
      if (activeProjectsIndex !== -1) {
        base[activeProjectsIndex] = {
          ...base[activeProjectsIndex],
          x: 8,
          y: 0,
          w: 4,
          h: 6,
      };
      }
      // Adjust onlineteam position
      const onlineTeamIndex = base.findIndex(item => item.i === "onlineteam");
      if (onlineTeamIndex !== -1) {
        base[onlineTeamIndex] = {
          ...base[onlineTeamIndex],
        x: 0,
        y: 2,
        w: 4,
        h: 4,
        minW: 3,
        minH: 2,
        maxW: 12,
        maxH: 8,
      };
      }
      // Adjust activitylogs position if it exists
      if (canViewActivityLogs) {
        const activityLogsIndex = base.findIndex(item => item.i === "activitylogs");
        if (activityLogsIndex !== -1) {
          base[activityLogsIndex] = {
            ...base[activityLogsIndex],
          x: 0,
          y: 6,
          w: 12,
          h: 5,
          minW: 4,
          minH: 3,
          maxW: 12,
          maxH: 12,
        };
        }
      }
    }
    return base;
  }, [canViewFinanceDetails, canViewActivityLogs, user]);

  // Track the current user ID to detect user changes
  const currentUserId = useMemo(() => {
    return user?.id || user?.username || null;
  }, [user?.id, user?.username]);

  // Load layout from localStorage immediately (user-specific)
  // This preserves all saved positions and only filters/adds widgets based on permissions
  const loadLayoutForUser = (userId, hasPermission) => {
    if (!userId) return defaultLayout;

    try {
      const userLayoutKey = `dashboard_layout_${userId}`;
      const saved = localStorage.getItem(userLayoutKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed) && parsed.length > 0) {
          // Preserve all saved positions - only filter based on permissions
          let filtered = parsed.filter((item) => {
            // Remove activitylogs widget if user doesn't have permission
            if (item.i === "activitylogs" && !hasPermission) {
              return false;
            }
            return true;
          });

          // Add activitylogs widget if user has permission and it doesn't exist
          if (hasPermission) {
            const hasActivityLogs = filtered.some(
              (item) => item.i === "activitylogs"
            );
            if (!hasActivityLogs) {
              // Find available position at the bottom
              const maxY = Math.max(
                ...filtered.map((item) => (item.y || 0) + (item.h || 1)),
                0
              );
              filtered.push({
                i: "activitylogs",
                x: 0,
                y: maxY,
                w: 12,
                h: 5,
                minW: 4,
                minH: 3,
                maxW: 12,
                maxH: 12,
              });
            }
          }

          console.log("📋 Loaded saved layout for user:", userId, "with", filtered.length, "widgets");
          return filtered;
        }
      }
      console.log("📋 No saved layout found for user:", userId, "- using default");
      return defaultLayout;
    } catch (e) {
      console.warn("Failed to load dashboard layout:", e);
      return defaultLayout;
    }
  };

  // Initialize layout from localStorage immediately (load from user if available)
  // This function is defined outside useState to avoid closure issues
  const getInitialLayout = () => {
    // Try to get user from localStorage first (in case user is not loaded yet)
    try {
      const savedUser = localStorage.getItem("nexvoide_user");
      if (savedUser) {
        const userData = JSON.parse(savedUser);
        const userId = userData?.id || userData?.username;
        if (userId) {
          // Load layout using the helper function with permission check
          // Note: canViewActivityLogs might not be available yet, so we'll use defaultLayout
          // which already has the correct widgets based on permissions
          const userLayoutKey = `dashboard_layout_${userId}`;
          const saved = localStorage.getItem(userLayoutKey);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (parsed && parsed.length > 0) {
                // Filter out activitylogs widget if user doesn't have permission
                // We'll check permissions later in useEffect
                console.log(
                  "📋 Initialized with saved layout for user:",
                  userId
                );
                return parsed;
              }
            } catch (e) {
              console.warn("Failed to parse saved layout:", e);
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to load user from localStorage:", e);
    }

    // Fallback: use default layout
    console.log("📋 Using default layout on initialization");
    return defaultLayout;
  };

  const [layout, setLayout] = useState(getInitialLayout);

  // Track previous user ID to detect actual user changes
  const prevUserIdRef = useRef(currentUserId);

  // Update layout only when user actually changes (not when component remounts)
  useEffect(() => {
    // Only update if user actually changed (not just component remount)
    if (prevUserIdRef.current !== currentUserId) {
      prevUserIdRef.current = currentUserId;
      if (currentUserId) {
        const loadedLayout = loadLayoutForUser(
          currentUserId,
          canViewActivityLogs
        );
        setLayout(loadedLayout);
        setHasInitializedLayout(false); // Reset initialization flag for new user
      } else {
        setLayout(defaultLayout);
        setHasInitializedLayout(false);
      }
    }
    // Don't reload on remount - the initializer already loaded it
  }, [currentUserId, canViewActivityLogs]);

  // Ensure required widgets are in layout (only add missing ones, preserve positions)
  const [hasInitializedLayout, setHasInitializedLayout] = useState(false);
  useEffect(() => {
    if (hasInitializedLayout || !user || layout.length === 0) return;
    
      let updated = false;
      const newLayout = [...layout];
    const roles = user && user.role ? normalizeRoles(user.role) : [];
    const isAdmin = hasRole(roles, ROLES.ADMIN);
    const isClient = hasRole(roles, ROLES.CLIENT);

    // Helper to find the best position for a new widget (avoid overlapping)
    const findAvailablePosition = (preferredX = 0, preferredY = 0, w = 4, h = 2) => {
      let x = preferredX;
      let y = preferredY;
      let found = false;
      let attempts = 0;
      const maxAttempts = 50;
      
      while (!found && attempts < maxAttempts) {
        // Check if position is available (no overlap)
        const overlaps = newLayout.some(item => {
          const itemRight = item.x + item.w;
          const itemBottom = item.y + item.h;
          const newRight = x + w;
          const newBottom = y + h;
          
          return !(
            x >= itemRight || 
            newRight <= item.x || 
            y >= itemBottom || 
            newBottom <= item.y
          );
        });
        
        if (!overlaps) {
          found = true;
        } else {
          // Try next position
          x += w;
          if (x + w > 12) {
            x = 0;
            y += h;
          }
          attempts++;
        }
      }
      
      return { x, y };
    };

    // Add myearnings widget for non-admin, non-client users (only if missing)
    if (user && user.role && !isAdmin && !isClient) {
      const hasMyEarnings = newLayout.some((item) => item.i === "myearnings");
      if (!hasMyEarnings) {
        const pos = findAvailablePosition(0, 0, 4, 2);
        newLayout.push({
          i: "myearnings",
          x: pos.x,
          y: pos.y,
          w: 4,
          h: 2,
          minW: 2,
          minH: 1,
          maxW: 12,
          maxH: 10,
        });
        updated = true;
        console.log("✅ Added myearnings widget to layout at", pos);
      }
    } else {
      // Remove myearnings for admin or client
      const filtered = newLayout.filter((item) => item.i !== "myearnings");
      if (filtered.length !== newLayout.length) {
        newLayout.length = 0;
        newLayout.push(...filtered);
        updated = true;
        console.log("✅ Removed myearnings widget from layout");
      }
    }
    
    // Add clientstats widget for CLIENT role (only if missing)
    if (user && user.role && isClient && !isAdmin) {
      const hasClientStats = newLayout.some((item) => item.i === "clientstats");
      if (!hasClientStats) {
        const pos = findAvailablePosition(0, 0, 4, 2);
        newLayout.push({
          i: "clientstats",
          x: pos.x,
          y: pos.y,
          w: 4,
          h: 2,
          minW: 2,
          minH: 1,
          maxW: 12,
          maxH: 10,
        });
        updated = true;
        console.log("✅ Added clientstats widget to layout at", pos);
      }
    } else {
      // Remove clientstats if user is not a client
      const filtered = newLayout.filter((item) => item.i !== "clientstats");
      if (filtered.length !== newLayout.length) {
        newLayout.length = 0;
        newLayout.push(...filtered);
        updated = true;
        console.log("✅ Removed clientstats widget from layout");
      }
    }

    // Only add activity logs widget if user has permission (only if missing)
      if (canViewActivityLogs) {
      const hasActivityLogs = newLayout.some((item) => item.i === "activitylogs");
        if (!hasActivityLogs) {
          const maxY = Math.max(
            ...newLayout.map((item) => (item.y || 0) + (item.h || 1)),
            0
          );
          newLayout.push({
            i: "activitylogs",
            x: 0,
            y: maxY,
            w: 12,
            h: 5,
            minW: 4,
            minH: 3,
            maxW: 12,
            maxH: 12,
          });
          updated = true;
          console.log("✅ Added activitylogs widget to layout");
        }
      } else {
        // Remove activity logs widget if user doesn't have permission
        const filtered = newLayout.filter((item) => item.i !== "activitylogs");
        if (filtered.length !== newLayout.length) {
          newLayout.length = 0;
          newLayout.push(...filtered);
          updated = true;
        console.log("✅ Removed activitylogs widget from layout (no permission)");
        }
      }

    // Add onlineteam widget (only if missing)
      const hasOnlineTeam = newLayout.some((item) => item.i === "onlineteam");
      if (!hasOnlineTeam) {
      const pos = findAvailablePosition(0, 0, 4, 4);
          newLayout.push({
            i: "onlineteam",
        x: pos.x,
        y: pos.y,
            w: 4,
            h: 4,
            minW: 3,
            minH: 2,
            maxW: 12,
            maxH: 8,
          });
        updated = true;
      console.log("✅ Added onlineteam widget to layout at", pos);
      }

      if (updated) {
        setLayout(newLayout);
      }
    setHasInitializedLayout(true);
  }, [layout, hasInitializedLayout, canViewActivityLogs, user]);

  // Debounced save function to avoid too many localStorage writes
  const saveLayoutTimeoutRef = useRef(null);
  
  // Save layout to localStorage when it changes (user-specific, debounced)
  useEffect(() => {
    if (!user) return; // Don't save if no user is logged in
    
    // Clear existing timeout
    if (saveLayoutTimeoutRef.current) {
      clearTimeout(saveLayoutTimeoutRef.current);
    }
    
    // Debounce save to avoid too many writes
    saveLayoutTimeoutRef.current = setTimeout(() => {
    try {
      // Save layout with user-specific key
      const userId = user?.id || user?.username || "default";
      const userLayoutKey = `dashboard_layout_${userId}`;
      localStorage.setItem(userLayoutKey, JSON.stringify(layout));
        console.log("💾 Saved dashboard layout for user:", userId, "with", layout.length, "widgets");
    } catch (e) {
      console.warn("Failed to save dashboard layout:", e);
    }
    }, 500); // Save 500ms after last change
    
    return () => {
      if (saveLayoutTimeoutRef.current) {
        clearTimeout(saveLayoutTimeoutRef.current);
      }
    };
  }, [layout, user]);

  const handleLayoutChange = (newLayout) => {
    // Update layout immediately for responsive UI
    setLayout(newLayout);
    // Save will happen automatically via useEffect (debounced)
  };

  // Calculate responsive width and columns
  const [width, setWidth] = useState(1200);
  const [cols, setCols] = useState(12);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const updateLayout = () => {
      const container = document.querySelector(".layout")?.parentElement;
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      if (container) {
        setWidth(mobile ? window.innerWidth - 40 : container.offsetWidth || window.innerWidth - 100);
      } else {
        setWidth(mobile ? window.innerWidth - 40 : window.innerWidth - 100);
      }
      
      // Use fewer columns on mobile for better stacking
      setCols(mobile ? 4 : 12);
    };
    updateLayout();
    window.addEventListener("resize", updateLayout);
    return () => window.removeEventListener("resize", updateLayout);
  }, []);

  // Helper to ensure assigned is always an array
  const ensureAssigned = (assigned) => {
    if (Array.isArray(assigned)) return assigned;
    if (typeof assigned === "string") {
      try {
        const parsed = JSON.parse(assigned);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const totals = useMemo(() => {
    let totalRevenue = 0;
    let inProgressRevenue = 0;
    let completedRevenue = 0;
    let cancelledValue = 0;
    let revisionValue = 0;
    let teamCostActive = 0;
    let teamCostAll = 0;
    let profitTotal = 0; // completed-only profit

    for (const p of projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      const projectValue = convert(p.amount || 0, p.currency, currency, rate);
      const assignedArray = ensureAssigned(p.assigned);
      let employee = 0;
      for (const a of assignedArray) {
        if (a.costType === "percentage")
          employee += (projectValue * (Number(a.costValue) || 0)) / 100;
        else employee += convert(a.costValue || 0, "PKR", currency, rate);
      }
      const profit = projectValue - employee;
      totalRevenue += projectValue;
      if (p.status === "Completed") profitTotal += profit;
      if (p.status === "In Progress") inProgressRevenue += projectValue;
      if (p.status === "Completed") completedRevenue += projectValue;
      // Handle both "Cancel" and "Cancelled" status
      if (p.status === "Cancelled" || p.status === "Cancel")
        cancelledValue += projectValue;
      // Handle both "Revision" and "Revising" status
      if (p.status === "Revision" || p.status === "Revising")
        revisionValue += projectValue;
      if (
        p.status === "In Progress" ||
        p.status === "Revision" ||
        p.status === "Revising"
      )
        teamCostActive += employee;
      teamCostAll += employee;
    }
    return {
      totalRevenue,
      inProgressRevenue,
      completedRevenue,
      cancelledValue,
      revisionValue,
      teamCostActive,
      teamCostAll,
      profitTotal,
    };
  }, [projects, currency, rate]);

  // Calculate employee earnings (for non-admin users)
  const employeeEarnings = useMemo(() => {
    if (!user || !user.role) return 0;
    
    // Check if user has ADMIN role (using normalizeRoles for multi-role support)
    const roles = normalizeRoles(user.role);
    if (hasRole(roles, ROLES.ADMIN)) return 0;
    
    const userId = user.userId || user.user_id || user.name || '';
    if (!userId) return 0;
    
    let totalEarnings = 0;
    
    for (const p of projects) {
      // Skip archived projects (they're in archived_projects table, not active projects)
      if (p.archived === true) continue;
      
      const assignedArray = ensureAssigned(p.assigned);
      
      // Find if this user is assigned to this project
      const userAssignment = assignedArray.find(a => {
        const assignedName = a.name || '';
        return assignedName === userId || 
               assignedName.toLowerCase() === userId.toLowerCase();
      });
      
      if (userAssignment) {
        const projectValue = convert(p.amount || 0, p.currency, currency, rate);
        let earnings = 0;
        
        if (userAssignment.costType === "percentage") {
          earnings = (projectValue * (Number(userAssignment.costValue) || 0)) / 100;
        } else {
          earnings = convert(userAssignment.costValue || 0, "PKR", currency, rate);
        }
        
        totalEarnings += earnings;
      }
    }
    
    return totalEarnings;
  }, [projects, user, currency, rate]);

  // Only keep Net Profit KPI (if user has permission to view finance details)
  const kpis = canViewFinanceDetails
    ? [
        {
          key: "netprofit",
          label: "Net Profit",
          value: totals.profitTotal,
          icon: TrendingUp,
          color: "text-green-400",
        },
      ]
    : [];

  // Calculate client project statistics (for CLIENT role)
  // Use allProjects instead of filtered projects to ensure we count all client projects
  const clientStats = useMemo(() => {
    if (!user || !user.role) return null;
    
    const roles = normalizeRoles(user.role);
    if (!hasRole(roles, ROLES.CLIENT)) return null;
    
    if (!user.userId && !user.user_id && !user.name) return { projectCount: 0, totalQuantity: 0, totalRevisions: 0 };
    
    const userId = user.userId || user.user_id || user.name || '';
    let projectCount = 0;
    let totalQuantity = 0;
    let totalRevisions = 0;
    
    // Use allProjects to count all client projects, not just filtered ones
    const projectsToCount = allProjects || projects;
    
    // Get all agencies, brands, and profiles for name matching (not filtered)
    const agenciesToMatch = allAgencies || [];
    const brandsToMatch = allBrands || [];
    const profilesToMatch = allProfiles || [];
    
    for (const p of projectsToCount) {
      // Handle both camelCase and snake_case field names
      const clientName = p.clientName || p.client_name || '';
      const agencyId = p.agencyId || p.agency_id;
      const brandId = p.brandId || p.brand_id;
      const profileId = p.profileId || p.profile_id;
      
      // Get agency/brand/profile names for matching
      const agency = agenciesToMatch.find(a => String(a.id || '') === String(agencyId || ''));
      const brand = brandsToMatch.find(b => String(b.id || '') === String(brandId || ''));
      const profile = profilesToMatch.find(pr => String(pr.id || '') === String(profileId || ''));
      
      const agencyName = agency?.name || '';
      const brandName = brand?.name || '';
      const profileName = profile?.name || '';
      
      // Match by client name, agency/brand/profile name, or ID
      const matchesClient = 
        clientName.toLowerCase() === userId.toLowerCase() ||
        agencyName.toLowerCase() === userId.toLowerCase() ||
        brandName.toLowerCase() === userId.toLowerCase() ||
        profileName.toLowerCase() === userId.toLowerCase() ||
        String(brandId || '') === String(userId) ||
        String(agencyId || '') === String(userId) ||
        String(profileId || '') === String(userId);
      
      if (matchesClient) {
        projectCount++;
        
        // Check if it's a revision
        const isRevision = p.isRevision || p.is_revision || p.status === "Revision" || p.status === "Revising";
        
        // Handle both camelCase and snake_case for quantity fields
        const quantity = Number(p.quantity || 0);
        const revisionQuantity = Number(p.revisionQuantity || p.revision_quantity || 0);
        
        if (isRevision) {
          totalRevisions += revisionQuantity > 0 ? revisionQuantity : quantity;
        } else {
          totalQuantity += quantity;
        }
      }
    }
    
    return { projectCount, totalQuantity, totalRevisions };
  }, [allProjects, projects, user, allAgencies, allBrands, allProfiles]);

  // Employee Earnings KPI (for non-admin, non-client users)
  const employeeKpi = useMemo(() => {
    if (!user || !user.role) return [];
    
    const roles = normalizeRoles(user.role);
    // Don't show for ADMIN or CLIENT roles
    if (hasRole(roles, ROLES.ADMIN) || hasRole(roles, ROLES.CLIENT)) return [];
    
    return [
      {
        key: "myearnings",
        label: "My Earnings",
        value: employeeEarnings,
        icon: Wallet,
        color: "text-blue-400",
      },
    ];
  }, [user, employeeEarnings]);

  // Client Stats KPI (for CLIENT role)
  const clientKpi = useMemo(() => {
    if (!clientStats) return [];
    
    return [
      {
        key: "clientstats",
        label: "My Projects",
        value: clientStats.projectCount,
        icon: Briefcase,
        color: "text-blue-400",
        subtitle: `${clientStats.totalQuantity} assets, ${clientStats.totalRevisions} revisions`,
      },
    ];
  }, [clientStats]);

  const monthly = Array.from({ length: 6 }).map((_, i) => ({
    name: `M${i + 1}`,
    profit: Math.max(0, (totals.profitTotal / 6) * (0.6 + Math.random() * 0.8)),
  }));

  const statusBreakdown = [
    { name: "Completed", value: totals.completedRevenue, color: "#22c55e" },
    { name: "In Progress", value: totals.inProgressRevenue, color: "#3b82f6" },
    { name: "Revision", value: totals.revisionValue, color: "#eab308" },
    { name: "Cancelled", value: totals.cancelledValue, color: "#ef4444" },
  ];

  const profileStats = useMemo(() => {
    const stats = new Map();
    for (const profile of profiles) {
      const profileProjects = projects.filter(
        (p) =>
          p.profileId === profile.id ||
          (p.platform === profile.platform && p.clientName === profile.name)
      );
      let countTotal = 0,
        countCompleted = 0,
        countRevision = 0,
        countCancelled = 0;
      let valueTotal = 0,
        valueCompleted = 0,
        employeeCostTotal = 0,
        profitTotal = 0;
      for (const p of profileProjects) {
        countTotal++;
        const order = convert(p.amount || 0, p.currency, currency, rate);
        const assignedArray = ensureAssigned(p.assigned);
        let emp = 0;
        for (const a of assignedArray) {
          if (a.costType === "percentage")
            emp += (order * (Number(a.costValue) || 0)) / 100;
          else emp += convert(a.costValue || 0, "PKR", currency, rate);
        }
        const profit = order - emp;
        valueTotal += order;
        employeeCostTotal += emp;
        profitTotal += profit;
        if (p.status === "Completed") {
          countCompleted++;
          valueCompleted += order;
        }
        // Handle both "Revision" and "Revising" status
        if (p.status === "Revision" || p.status === "Revising") {
          countRevision++;
        }
        // Handle both "Cancel" and "Cancelled" status
        if (p.status === "Cancelled" || p.status === "Cancel") {
          countCancelled++;
        }
      }
      stats.set(profile.id, {
        profile,
        countTotal,
        countCompleted,
        countRevision,
        countCancelled,
        valueTotal,
        valueCompleted,
        employeeCostTotal,
        profitTotal,
      });
    }
    return Array.from(stats.values());
  }, [profiles, projects, currency, rate]);

  const agencyStats = useMemo(() => {
    const stats = new Map();
    for (const agency of agencies) {
      const agencyProjects = projects.filter(
        (p) =>
          p.platform === "Agency" &&
          (p.agencyId === agency.id ||
            (!p.agencyId && p.clientName === agency.name))
      );
      let countTotal = 0,
        countCompleted = 0,
        countRevision = 0,
        countCancelled = 0;
      let valueTotal = 0,
        valueCompleted = 0,
        employeeCostTotal = 0,
        profitTotal = 0;
      for (const p of agencyProjects) {
        countTotal++;
        const order = convert(p.amount || 0, p.currency, currency, rate);
        const assignedArray = ensureAssigned(p.assigned);
        let emp = 0;
        for (const a of assignedArray) {
          if (a.costType === "percentage")
            emp += (order * (Number(a.costValue) || 0)) / 100;
          else emp += convert(a.costValue || 0, "PKR", currency, rate);
        }
        const profit = order - emp;
        valueTotal += order;
        employeeCostTotal += emp;
        profitTotal += profit;
        if (p.status === "Completed") {
          countCompleted++;
          valueCompleted += order;
        }
        // Handle both "Revision" and "Revising" status
        if (p.status === "Revision" || p.status === "Revising") {
          countRevision++;
        }
        // Handle both "Cancel" and "Cancelled" status
        if (p.status === "Cancelled" || p.status === "Cancel") {
          countCancelled++;
        }
      }
      stats.set(agency.id, {
        agency,
        countTotal,
        countCompleted,
        countRevision,
        countCancelled,
        valueTotal,
        valueCompleted,
        employeeCostTotal,
        profitTotal,
      });
    }
    return Array.from(stats.values());
  }, [agencies, projects, currency, rate]);

  const brandStats = useMemo(() => {
    const stats = new Map();
    for (const brand of brands) {
      const brandProjects = projects.filter(
        (p) =>
          p.platform === "Direct" &&
          (p.brandId === brand.id ||
            (!p.brandId && p.clientName === brand.name))
      );
      let countTotal = 0,
        countCompleted = 0,
        countRevision = 0,
        countCancelled = 0;
      let valueTotal = 0,
        valueCompleted = 0,
        employeeCostTotal = 0,
        profitTotal = 0;
      for (const p of brandProjects) {
        countTotal++;
        const order = convert(p.amount || 0, p.currency, currency, rate);
        const assignedArray = ensureAssigned(p.assigned);
        let emp = 0;
        for (const a of assignedArray) {
          if (a.costType === "percentage")
            emp += (order * (Number(a.costValue) || 0)) / 100;
          else emp += convert(a.costValue || 0, "PKR", currency, rate);
        }
        const profit = order - emp;
        valueTotal += order;
        employeeCostTotal += emp;
        profitTotal += profit;
        if (p.status === "Completed") {
          countCompleted++;
          valueCompleted += order;
        }
        // Handle both "Revision" and "Revising" status
        if (p.status === "Revision" || p.status === "Revising") {
          countRevision++;
        }
        // Handle both "Cancel" and "Cancelled" status
        if (p.status === "Cancelled" || p.status === "Cancel") {
          countCancelled++;
        }
      }
      stats.set(brand.id, {
        brand,
        countTotal,
        countCompleted,
        countRevision,
        countCancelled,
        valueTotal,
        valueCompleted,
        employeeCostTotal,
        profitTotal,
      });
    }
    return Array.from(stats.values());
  }, [brands, projects, currency, rate]);

  const fmt = (n) =>
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);

  // Scroll visibility state for Active Projects widget (show scrollbar only while scrolling)
  const [isActiveProjectsScrolling, setIsActiveProjectsScrolling] = useState(false);
  const activeProjectsScrollTimeout = useRef(null);

  const handleActiveProjectsScroll = () => {
    if (!isActiveProjectsScrolling) {
      setIsActiveProjectsScrolling(true);
    }
    if (activeProjectsScrollTimeout.current) {
      clearTimeout(activeProjectsScrollTimeout.current);
    }
    activeProjectsScrollTimeout.current = setTimeout(() => {
      setIsActiveProjectsScrolling(false);
    }, 600);
  };

  useEffect(() => {
    return () => {
      if (activeProjectsScrollTimeout.current) {
        clearTimeout(activeProjectsScrollTimeout.current);
      }
    };
  }, []);

  // Active projects widget data (In Progress and Revision projects)
  const activeProjectsWidget = useMemo(() => {
    const active = projects
      .filter(
        (p) =>
          p.status === "In Progress" ||
          p.status === "Revision" ||
          p.status === "Revising"
      )
      .map((p) => {
        const assignedArray = ensureAssigned(p.assigned);
        const employeeNames = assignedArray
          .map((a) => a.name || "Unassigned")
          .filter(Boolean);
        const deadline = p.deadline || p.endDate || null;

        // Calculate time remaining
        // Parse deadline - handle Supabase TIMESTAMP (may not have timezone)
        let timeRemaining = null;
        if (deadline) {
          let deadlineStr = String(deadline).trim();
          
          // If it's a timestamp without timezone (from Supabase TIMESTAMP column)
          // Treat it as UTC by appending 'Z'
          if (deadlineStr.includes('T') && !deadlineStr.endsWith('Z') && !deadlineStr.match(/[+-]\d{2}:\d{2}$/)) {
            deadlineStr = deadlineStr + 'Z';
          }
          
          const deadlineDate = new Date(deadlineStr);
          // Check if date is valid
          if (isNaN(deadlineDate.getTime())) {
            timeRemaining = null;
          } else {
            const now = new Date();
            const diffTime = deadlineDate.getTime() - now.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
              timeRemaining = {
                text: `${Math.abs(diffDays)} days overdue`,
                isOverdue: true,
              };
            } else if (diffDays === 0) {
              timeRemaining = { text: "Due today", isOverdue: false };
            } else if (diffDays === 1) {
              timeRemaining = { text: "Due tomorrow", isOverdue: false };
            } else {
              timeRemaining = { text: `${diffDays} days left`, isOverdue: false };
            }
          }
        }

        return {
          id: p.id,
          projectName: p.projectName || "Unnamed Project",
          employeeNames:
            employeeNames.length > 0 ? employeeNames : ["Unassigned"],
          deadline: deadline,
          timeRemaining: timeRemaining,
          status: p.status,
        };
      })
      .sort((a, b) => {
        // Sort by deadline: overdue first, then by closest deadline
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        // Parse deadlines for sorting - handle Supabase TIMESTAMP (may not have timezone)
        let deadlineA = String(a.deadline).trim();
        let deadlineB = String(b.deadline).trim();
        if (deadlineA.includes('T') && !deadlineA.endsWith('Z') && !deadlineA.match(/[+-]\d{2}:\d{2}$/)) {
          deadlineA = deadlineA + 'Z';
        }
        if (deadlineB.includes('T') && !deadlineB.endsWith('Z') && !deadlineB.match(/[+-]\d{2}:\d{2}$/)) {
          deadlineB = deadlineB + 'Z';
        }
        const dateA = new Date(deadlineA);
        const dateB = new Date(deadlineB);
        const now = new Date();
        const overdueA = dateA < now;
        const overdueB = dateB < now;
        if (overdueA && !overdueB) return -1;
        if (!overdueA && overdueB) return 1;
        return dateA - dateB;
      })
      .slice(0, 5); // Show top 5 most urgent

    return active;
  }, [projects]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "No deadline";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Load activity logs on mount (only if user has permission)
  useEffect(() => {
    if (canViewActivityLogs) {
      loadActivityLogs(20);
    }
  }, [loadActivityLogs, canViewActivityLogs]);

  // Recent activity logs for widget (last 10)
  const recentActivityLogs = useMemo(() => {
    const logs = Array.isArray(activityLogs) ? activityLogs : [];
    return logs.slice(0, 10).map((log) => {
      const createdAt = log.createdAt || log.created_at;
      const now = new Date();
      const date = createdAt ? new Date(createdAt) : now;
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      let timeAgo = "";
      if (diffMins < 1) timeAgo = "Just now";
      else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
      else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
      else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
      else
        timeAgo = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });

      return {
        ...log,
        timeAgo,
      };
    });
  }, [activityLogs]);

  // Action colors for activity logs
  const getActionColor = (action) => {
    switch (action) {
      case "created":
        return "text-green-500";
      case "updated":
        return "text-blue-500";
      case "deleted":
        return "text-red-500";
      case "status_changed":
        return "text-purple-500";
      default:
        return "text-slate-500";
    }
  };

  // Create avatar cache for fast lookups
  const avatarCache = useMemo(() => {
    const cache = new Map();

    // Cache all user avatars directly
    (allUsers || []).forEach((user) => {
      const userId = user.id || user.username;
      const avatar =
        user.avatar ||
        user.profile_picture ||
        user.profilePicture ||
        user.avatar_url ||
        user.avatarUrl;
      if (avatar && userId) {
        cache.set(userId, avatar);
        cache.set(user.name?.toLowerCase(), avatar);
        cache.set(user.email?.toLowerCase(), avatar);
        cache.set(user.username?.toLowerCase(), avatar);
      }
    });

    // Cache employee avatars
    (employees || []).forEach((emp) => {
      const empName = (emp.name || emp.employee_name || "")
        .trim()
        .toLowerCase();
      const empEmail = (emp.email || emp.employee_email || "")
        .trim()
        .toLowerCase();
      const empId = emp.id;
      const avatar =
        emp.avatar || emp.employee_avatar || emp.avatar_url || emp.avatarUrl;

      if (avatar) {
        if (empName) cache.set(empName, avatar);
        if (empEmail) cache.set(empEmail, avatar);
        if (empId) cache.set(String(empId), avatar);
      }
    });

    // Cache agency logos
    (agencies || []).forEach((agency) => {
      const agencyName = (agency.name || agency.agency_name || "")
        .trim()
        .toLowerCase();
      const agencyEmail = (agency.email || agency.agency_email || "")
        .trim()
        .toLowerCase();
      const logo =
        agency.logo || agency.agency_logo || agency.avatar || agency.avatar_url;

      if (logo) {
        if (agencyName) cache.set(agencyName, logo);
        if (agencyEmail) cache.set(agencyEmail, logo);
      }
    });

    // Cache brand logos
    (brands || []).forEach((brand) => {
      const brandName = (brand.name || brand.brand_name || "")
        .trim()
        .toLowerCase();
      const brandEmail = (brand.email || brand.brand_email || "")
        .trim()
        .toLowerCase();
      const logo =
        brand.logo || brand.brand_logo || brand.avatar || brand.avatar_url;

      if (logo) {
        if (brandName) cache.set(brandName, logo);
        if (brandEmail) cache.set(brandEmail, logo);
      }
    });

    return cache;
  }, [allUsers, employees, agencies, brands]);

  // Online users only - show only users who are currently online with pre-resolved avatars
  const onlineTeamData = useMemo(() => {
    // Show ONLY online users with their profile pictures
    // Everyone can see online users
    const onlineUsers = (allUsers || [])
      .filter((u) => u.active !== false) // Only show active users
      .filter((u) => {
        const userId = u.id || u.username;
        return onlineUserIds.has(userId); // Only show online users
      })
      .map((user) => {
        // Fast avatar lookup using cache
        const userId = user.id || user.username;
        const userName = (user.name || "").trim().toLowerCase();
        const userEmail = (user.email || "").trim().toLowerCase();
        const username = (user.username || "").trim().toLowerCase();

        // Try direct user avatar first
        let avatar =
          user.avatar ||
          user.profile_picture ||
          user.profilePicture ||
          user.avatar_url ||
          user.avatarUrl;

        // Fast cache lookup if no direct avatar
        if (!avatar) {
          avatar =
            avatarCache.get(userId) ||
            avatarCache.get(userName) ||
            avatarCache.get(userEmail) ||
            avatarCache.get(username);
        }

        return {
          ...user,
          resolvedAvatar: avatar, // Pre-resolved avatar for fast rendering
        };
      })
      .slice(0, 30); // Limit to 30 for display

    console.log("📊 Online Team Data:", {
      totalUsers: allUsers.length,
      onlineCount: onlineUsers.length,
      onlineUserIds: Array.from(onlineUserIds),
      users: onlineUsers.map((u) => ({
        id: u.id || u.username,
        name: u.name,
        role: u.role,
        hasAvatar: !!u.resolvedAvatar,
        avatar: u.resolvedAvatar,
      })),
    });

    return {
      users: onlineUsers,
      total: onlineUsers.length,
      onlineCount: onlineUsers.length,
    };
  }, [allUsers, onlineUserIds, avatarCache]);

  return (
    <>
      <div style={{ marginBottom: "1rem" }}>
        <GridLayout
          className='layout'
          layout={isMobile ? getMobileLayout(layout) : layout}
          onLayoutChange={handleLayoutChange}
          cols={cols}
          rowHeight={isMobile ? 80 : 60}
          width={width}
          isDraggable={!isMobile}
          isResizable={!isMobile}
          draggableHandle='.drag-handle'
          margin={isMobile ? [8, 8] : [12, 12]}
          compactType={isMobile ? 'vertical' : null}
          resizeHandles={["se", "sw", "ne", "nw", "e", "w", "n", "s"]}>
          {/* My Earnings Card - Only show for non-admin, non-client users */}
          {employeeKpi.length > 0 && (
            <div key='myearnings' className='card h-full'>
              <div className='flex items-center gap-2 mb-1'>
                <GripVertical
                  className='drag-handle cursor-move text-slate-400 hover:text-slate-600'
                  size={16}
                />
                {employeeKpi[0]?.icon
                  ? (() => {
                      const IconComponent = employeeKpi[0].icon;
                      return (
                        <IconComponent size={18} className='text-blue-400' />
                      );
                    })()
                  : null}
                <div className='text-xs text-slate-500'>
                  {employeeKpi[0]?.label || "My Earnings"}
                </div>
              </div>
              <div
                className={`text-xl md:text-2xl font-bold ${
                  employeeKpi[0]?.color || "text-blue-400"
                }`}>
                {fmt(employeeKpi[0]?.value || 0)}
              </div>
            </div>
          )}

          {/* Client Stats Card - Only show for CLIENT role */}
          {clientKpi.length > 0 && (
            <div key='clientstats' className='card h-full'>
              <div className='flex items-center gap-2 mb-1'>
                <GripVertical
                  className='drag-handle cursor-move text-slate-400 hover:text-slate-600'
                  size={16}
                />
                {clientKpi[0]?.icon
                  ? (() => {
                      const IconComponent = clientKpi[0].icon;
                      return (
                        <IconComponent size={18} className='text-blue-400' />
                      );
                    })()
                  : null}
                <div className='text-xs text-slate-500'>
                  {clientKpi[0]?.label || "My Projects"}
                </div>
              </div>
              <div
                className={`text-xl md:text-2xl font-bold ${
                  clientKpi[0]?.color || "text-blue-400"
                }`}>
                {clientKpi[0]?.value || 0}
              </div>
              {clientKpi[0]?.subtitle && (
                <div className='text-xs text-slate-400 mt-1'>
                  {clientKpi[0].subtitle}
                </div>
              )}
            </div>
          )}

          {/* Net Profit Card - Only show if user has permission */}
          {canViewFinanceDetails && kpis.length > 0 && (
            <div key='netprofit' className='card h-full'>
              <div className='flex items-center gap-2 mb-1'>
                <GripVertical
                  className='drag-handle cursor-move text-slate-400 hover:text-slate-600'
                  size={16}
                />
                {kpis[0]?.icon
                  ? (() => {
                      const IconComponent = kpis[0].icon;
                      return (
                        <IconComponent size={18} className='text-green-400' />
                      );
                    })()
                  : null}
                <div className='text-xs text-slate-500'>
                  {kpis[0]?.label || "Net Profit"}
                </div>
              </div>
              <div
                className={`text-xl md:text-2xl font-bold ${
                  kpis[0]?.color || "text-green-400"
                }`}>
                {fmt(kpis[0]?.value || 0)}
              </div>
            </div>
          )}

          {/* Online Team & Clients Widget - Show all logged-in users (no restrictions) */}
          <div key='onlineteam' className='card flex flex-col h-full'>
            <div className='flex items-center gap-2 mb-3 flex-shrink-0'>
              <GripVertical
                className='drag-handle cursor-move text-slate-400 hover:text-slate-600'
                size={16}
              />
              <Users className='text-green-500' size={18} />
              <div className='text-sm font-semibold'>Online Users</div>
              <div className='ml-auto flex items-center gap-1'>
                <div className='w-2 h-2 rounded-full bg-green-500 animate-pulse'></div>
                <span className='text-xs text-slate-500'>
                  {onlineTeamData.total || 0}
                </span>
              </div>
            </div>
            <div className='flex-1 overflow-hidden min-h-0'>
              {loading ? (
                <div className='flex items-center justify-center py-8'>
                  <div className='text-slate-500 text-xs'>Loading...</div>
                </div>
              ) : (
                <div className='space-y-3 h-full overflow-y-auto pr-1'>
                  {/* Show all online users */}
                  {onlineTeamData.users.length > 0 ? (
                    <div className='flex flex-wrap items-center gap-3'>
                      {onlineTeamData.users.map((user, i) => {
                        const name = user.name || user.username || "Unknown";
                        const role = (user.role || "").toLowerCase();
                        const avatar = user.resolvedAvatar;

                        return (
                          <motion.div
                            key={user.id || user.username || i}
                            className='flex flex-col items-center gap-1.5 flex-shrink-0 group cursor-pointer'
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.03 }}
                            title={`${name} (${role || "user"})`}>
                            <Avatar
                              src={avatar}
                              name={name}
                              size='md'
                              role={role}
                              showOnline={true}
                            />
                            <div className='text-[10px] text-slate-600 dark:text-slate-400 text-center max-w-[60px] truncate'>
                              {name}
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className='text-center py-8 text-slate-400 text-xs'>
                      No users online
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Active Projects Widget */}
          <div key='activeprojects' className='card flex flex-col h-full'>
            <div className='flex items-center gap-2 mb-4 flex-shrink-0'>
              <GripVertical
                className='drag-handle cursor-move text-slate-400 hover:text-slate-600'
                size={16}
              />
              <Calendar className='text-blue-500' size={18} />
              <div className='text-sm font-semibold'>Active Projects</div>
            </div>
            <div className='flex-1 overflow-hidden min-h-0'>
              {loading ? (
                <div className='flex items-center justify-center py-12'>
                  <div className='text-slate-500 text-sm'>
                    Loading projects...
                  </div>
                </div>
              ) : (
                <div
                  className={`space-y-3 h-full overflow-y-auto pr-1 widget-scroll ${
                    isActiveProjectsScrolling ? "widget-scroll-visible" : ""
                  }`}
                  onScroll={handleActiveProjectsScroll}
                >
                  {activeProjectsWidget.length > 0 ? (
                    activeProjectsWidget.map((project, i) => (
                      <motion.div
                        key={project.id}
                        className='p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-colors flex-shrink-0'
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.05 }}>
                        <div className='font-semibold text-sm mb-2 text-slate-900 dark:text-slate-100 truncate'>
                          {project.projectName}
                        </div>
                        <div className='flex items-center gap-2 mb-2'>
                          <User
                            size={14}
                            className='text-slate-400 flex-shrink-0'
                          />
                          <div className='text-xs text-slate-600 dark:text-slate-400 truncate'>
                            {project.employeeNames.join(", ")}
                          </div>
                        </div>
                        {project.timeRemaining && (
                          <div
                            className={`flex items-center gap-2 text-xs ${
                              project.timeRemaining.isOverdue
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-500 dark:text-slate-400"
                            }`}>
                            <Clock size={14} className='flex-shrink-0' />
                            <span className='font-medium'>
                              {project.timeRemaining.text}
                            </span>
                            {project.deadline && (
                              <span className='text-slate-400 dark:text-slate-500 ml-1'>
                                ({formatDate(project.deadline)})
                              </span>
                            )}
                          </div>
                        )}
                        {!project.timeRemaining && (
                          <div className='flex items-center gap-2 text-xs text-slate-400'>
                            <Clock size={14} />
                            <span>No deadline set</span>
                          </div>
                        )}
                      </motion.div>
                    ))
                  ) : (
                    <div className='text-center py-8 text-slate-400 text-sm'>
                      No active projects
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Activity Logs Widget - Only show for Admin, Manager, and Team Lead */}
          {canViewActivityLogs && (
            <div key='activitylogs' className='card flex flex-col h-full'>
              <div className='flex items-center gap-2 mb-4 flex-shrink-0'>
                <GripVertical
                  className='drag-handle cursor-move text-slate-400 hover:text-slate-600'
                  size={16}
                />
                <Activity className='text-purple-500' size={18} />
                <div className='text-sm font-semibold'>Recent Activity</div>
              </div>
              <div className='flex-1 overflow-hidden min-h-0'>
                {loading ? (
                  <div className='flex items-center justify-center py-12'>
                    <div className='text-slate-500 text-sm'>
                      Loading activities...
                    </div>
                  </div>
                ) : (
                  <div className='space-y-2 h-full overflow-y-auto pr-1 recent-activity-scroll'>
                    {recentActivityLogs.length > 0 ? (
                      recentActivityLogs.map((log, i) => {
                        const entityType =
                          log.entityType || log.entity_type || "unknown";
                        const action = log.action || "updated";
                        const description = log.description || "No description";
                        const timeAgo = log.timeAgo || "Unknown";

                        return (
                          <motion.div
                            key={log.id || i}
                            className='p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600 transition-colors flex-shrink-0'
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.5 + i * 0.03 }}>
                            <div className='flex items-start gap-2'>
                              <div
                                className={`text-xs font-medium ${getActionColor(
                                  action
                                )} flex-shrink-0 mt-0.5`}>
                                {action.toUpperCase()}
                              </div>
                              <div className='flex-1 min-w-0'>
                                <div className='text-xs text-slate-900 dark:text-slate-100 truncate mb-1'>
                                  {description}
                                </div>
                                <div className='flex items-center gap-2 text-xs text-slate-400'>
                                  <span className='uppercase text-[10px]'>
                                    {entityType}
                                  </span>
                                  <span>•</span>
                                  <Clock size={10} />
                                  <span>{timeAgo}</span>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    ) : (
                      <div className='text-center py-8 text-slate-400 text-sm'>
                        No recent activity
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </GridLayout>
      </div>

      {profileStats.length > 0 && (
        <div className='mt-6'>
          <div className='text-base md:text-lg font-bold mb-4'>Profile Performance</div>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4'>
            {profileStats.map((stat, i) => (
              <motion.div
                key={stat.profile.id}
                className='card group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative'
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}>
                {/* Gradient background accent */}
                <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500 via-pink-500 to-red-500'></div>

                <div className='p-4'>
                  <div className='flex items-start gap-4 mb-4'>
                    <div className='relative'>
                      {stat.profile.logo ? (
                        <div className='w-16 h-16 rounded-2xl overflow-hidden border-2 border-orange-200 dark:border-orange-800 shadow-xl ring-4 ring-orange-500/20 dark:ring-orange-400/10'>
                          <img
                            src={stat.profile.logo}
                            alt={stat.profile.name}
                            className='w-full h-full object-cover'
                          />
                        </div>
                      ) : (
                        <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 via-pink-500 to-red-500 flex items-center justify-center text-white font-bold text-xl shadow-xl ring-4 ring-orange-500/20 dark:ring-orange-400/10'>
                          {stat.profile.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className='absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center'>
                        <User size={12} className='text-orange-500' />
                      </div>
                    </div>
                    <div className='flex-1 min-w-0 pt-1'>
                      <div className='font-bold text-lg mb-1 truncate'>
                        {stat.profile.name}
                      </div>
                      <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 text-xs font-medium'>
                        <User size={11} />
                        {stat.profile.platform}
                      </div>
                      {stat.profile.service && (
                        <div className='mt-2 text-xs text-slate-500 truncate'>
                          {stat.profile.service}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3 mb-4'>
                    <div className='p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                      <div className='text-xs text-slate-500 dark:text-slate-400 mb-1'>
                        Total Orders
                      </div>
                      <div className='font-bold text-lg'>{stat.countTotal}</div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30'>
                      <div className='text-xs text-green-700 dark:text-green-300 mb-1'>
                        Completed
                      </div>
                      <div className='font-bold text-lg text-green-600 dark:text-green-400'>
                        {stat.countCompleted}
                      </div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30'>
                      <div className='text-xs text-amber-700 dark:text-amber-300 mb-1'>
                        Revision
                      </div>
                      <div className='font-bold text-lg text-amber-600 dark:text-amber-400'>
                        {stat.countRevision}
                      </div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30'>
                      <div className='text-xs text-red-700 dark:text-red-300 mb-1'>
                        Cancelled
                      </div>
                      <div className='font-bold text-lg text-red-600 dark:text-red-400'>
                        {stat.countCancelled}
                      </div>
                    </div>
                  </div>

                  <div className='pt-4 border-t border-slate-200 dark:border-slate-700'>
                    <div className={`grid gap-3 ${canViewFinanceDetails ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {canViewFinanceDetails && (
                        <>
                      <div className='p-2.5 rounded-lg bg-gradient-to-br from-orange-50 to-pink-50 dark:from-orange-950/20 dark:to-pink-950/20 border border-orange-200/50 dark:border-orange-800/30'>
                        <div className='text-xs font-medium text-orange-700 dark:text-orange-300 mb-1 uppercase tracking-wide'>
                          Order Value
                        </div>
                        <div className='font-bold text-sm text-slate-900 dark:text-slate-100 truncate'>
                          {fmt(stat.valueTotal)}
                        </div>
                      </div>
                      <div className='p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30'>
                        <div className='text-xs font-medium text-green-700 dark:text-green-300 mb-1 uppercase tracking-wide'>
                          Completed Value
                        </div>
                        <div className='font-bold text-sm text-green-600 dark:text-green-400 truncate'>
                          {fmt(stat.valueCompleted)}
                        </div>
                      </div>
                        </>
                      )}
                      {/* Only Admin can see Team Payment in performance sections, not Manager */}
                      {user && hasRole(normalizeRoles(user.role), ROLES.ADMIN) && (
                      <div className='p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide'>
                          Team Payment
                        </div>
                        <div className='font-bold text-sm text-slate-900 dark:text-slate-100 truncate'>
                          {fmt(stat.employeeCostTotal)}
                        </div>
                      </div>
                      )}
                      {canViewFinanceDetails && (
                      <div className='p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30'>
                        <div className='text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wide'>
                          Profit
                        </div>
                        <div className='font-bold text-sm text-blue-600 dark:text-blue-400 truncate'>
                          {fmt(stat.profitTotal)}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {agencyStats.length > 0 && (
        <div className='mt-6'>
          <div className='text-base md:text-lg font-bold mb-4'>Agency Performance</div>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4'>
            {agencyStats.map((stat, i) => (
              <motion.div
                key={stat.agency.id}
                className='card group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative'
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}>
                {/* Gradient background accent */}
                <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-500 via-teal-500 to-emerald-500'></div>

                <div className='p-4'>
                  <div className='flex items-start gap-4 mb-4'>
                    <div className='relative'>
                      {stat.agency.logo ? (
                        <div className='w-16 h-16 rounded-2xl overflow-hidden border-2 border-green-200 dark:border-green-800 shadow-xl ring-4 ring-green-500/20 dark:ring-green-400/10'>
                          <img
                            src={stat.agency.logo}
                            alt={stat.agency.name}
                            className='w-full h-full object-cover'
                          />
                        </div>
                      ) : (
                        <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500 via-teal-500 to-emerald-500 flex items-center justify-center text-white font-bold text-xl shadow-xl ring-4 ring-green-500/20 dark:ring-green-400/10'>
                          {stat.agency.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className='absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center'>
                        <Building2 size={12} className='text-green-500' />
                      </div>
                    </div>
                    <div className='flex-1 min-w-0 pt-1'>
                      <div className='font-bold text-lg mb-1 truncate'>
                        {stat.agency.name}
                      </div>
                      <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium'>
                        <Building2 size={11} />
                        Agency
                      </div>
                      {stat.agency.service && (
                        <div className='mt-2 text-xs text-slate-500 truncate'>
                          {stat.agency.service}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3 mb-4'>
                    <div className='p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                      <div className='text-xs text-slate-500 dark:text-slate-400 mb-1'>
                        Total Orders
                      </div>
                      <div className='font-bold text-lg'>{stat.countTotal}</div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30'>
                      <div className='text-xs text-green-700 dark:text-green-300 mb-1'>
                        Completed
                      </div>
                      <div className='font-bold text-lg text-green-600 dark:text-green-400'>
                        {stat.countCompleted}
                      </div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30'>
                      <div className='text-xs text-amber-700 dark:text-amber-300 mb-1'>
                        Revision
                      </div>
                      <div className='font-bold text-lg text-amber-600 dark:text-amber-400'>
                        {stat.countRevision}
                      </div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30'>
                      <div className='text-xs text-red-700 dark:text-red-300 mb-1'>
                        Cancelled
                      </div>
                      <div className='font-bold text-lg text-red-600 dark:text-red-400'>
                        {stat.countCancelled}
                      </div>
                    </div>
                  </div>

                  <div className='pt-4 border-t border-slate-200 dark:border-slate-700'>
                    <div className={`grid gap-3 ${canViewFinanceDetails ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {canViewFinanceDetails && (
                        <>
                      <div className='p-2.5 rounded-lg bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/20 dark:to-teal-950/20 border border-green-200/50 dark:border-green-800/30'>
                        <div className='text-xs font-medium text-green-700 dark:text-green-300 mb-1 uppercase tracking-wide'>
                          Order Value
                        </div>
                        <div className='font-bold text-sm text-slate-900 dark:text-slate-100 truncate'>
                          {fmt(stat.valueTotal)}
                        </div>
                      </div>
                      <div className='p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30'>
                        <div className='text-xs font-medium text-green-700 dark:text-green-300 mb-1 uppercase tracking-wide'>
                          Completed Value
                        </div>
                        <div className='font-bold text-sm text-green-600 dark:text-green-400 truncate'>
                          {fmt(stat.valueCompleted)}
                        </div>
                      </div>
                        </>
                      )}
                      {/* Only Admin can see Team Payment in performance sections, not Manager */}
                      {user && hasRole(normalizeRoles(user.role), ROLES.ADMIN) && (
                      <div className='p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide'>
                          Team Payment
                        </div>
                        <div className='font-bold text-sm text-slate-900 dark:text-slate-100 truncate'>
                          {fmt(stat.employeeCostTotal)}
                        </div>
                      </div>
                      )}
                      {canViewFinanceDetails && (
                      <div className='p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30'>
                        <div className='text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wide'>
                          Profit
                        </div>
                        <div className='font-bold text-sm text-blue-600 dark:text-blue-400 truncate'>
                          {fmt(stat.profitTotal)}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {brandStats.length > 0 && (
        <div className='mt-6'>
          <div className='text-base md:text-lg font-bold mb-4'>Brand Performance</div>
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4'>
            {brandStats.map((stat, i) => (
              <motion.div
                key={stat.brand.id}
                className='card group hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 border border-slate-200/50 dark:border-slate-700/50 overflow-hidden relative'
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}>
                {/* Gradient background accent */}
                <div className='absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-500 to-violet-500'></div>

                <div className='p-4'>
                  <div className='flex items-start gap-4 mb-4'>
                    <div className='relative'>
                      {stat.brand.logo ? (
                        <div className='w-16 h-16 rounded-2xl overflow-hidden border-2 border-purple-200 dark:border-purple-800 shadow-xl ring-4 ring-purple-500/20 dark:ring-purple-400/10'>
                          <img
                            src={stat.brand.logo}
                            alt={stat.brand.name}
                            className='w-full h-full object-cover'
                          />
                        </div>
                      ) : (
                        <div className='w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 via-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-xl shadow-xl ring-4 ring-purple-500/20 dark:ring-purple-400/10'>
                          {stat.brand.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className='absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center'>
                        <Briefcase size={12} className='text-purple-500' />
                      </div>
                    </div>
                    <div className='flex-1 min-w-0 pt-1'>
                      <div className='font-bold text-lg mb-1 truncate'>
                        {stat.brand.name}
                      </div>
                      <div className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium'>
                        <Briefcase size={11} />
                        Brand
                      </div>
                      {stat.brand.service && (
                        <div className='mt-2 text-xs text-slate-500 truncate'>
                          {stat.brand.service}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className='grid grid-cols-2 gap-3 mb-4'>
                    <div className='p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                      <div className='text-xs text-slate-500 dark:text-slate-400 mb-1'>
                        Total Orders
                      </div>
                      <div className='font-bold text-lg'>{stat.countTotal}</div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30'>
                      <div className='text-xs text-green-700 dark:text-green-300 mb-1'>
                        Completed
                      </div>
                      <div className='font-bold text-lg text-green-600 dark:text-green-400'>
                        {stat.countCompleted}
                      </div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30'>
                      <div className='text-xs text-amber-700 dark:text-amber-300 mb-1'>
                        Revision
                      </div>
                      <div className='font-bold text-lg text-amber-600 dark:text-amber-400'>
                        {stat.countRevision}
                      </div>
                    </div>
                    <div className='p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/30'>
                      <div className='text-xs text-red-700 dark:text-red-300 mb-1'>
                        Cancelled
                      </div>
                      <div className='font-bold text-lg text-red-600 dark:text-red-400'>
                        {stat.countCancelled}
                      </div>
                    </div>
                  </div>

                  <div className='pt-4 border-t border-slate-200 dark:border-slate-700'>
                    <div className={`grid gap-3 ${canViewFinanceDetails ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {canViewFinanceDetails && (
                        <>
                      <div className='p-2.5 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200/50 dark:border-purple-800/30'>
                        <div className='text-xs font-medium text-purple-700 dark:text-purple-300 mb-1 uppercase tracking-wide'>
                          Order Value
                        </div>
                        <div className='font-bold text-sm text-slate-900 dark:text-slate-100 truncate'>
                          {fmt(stat.valueTotal)}
                        </div>
                      </div>
                      <div className='p-2.5 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/30'>
                        <div className='text-xs font-medium text-green-700 dark:text-green-300 mb-1 uppercase tracking-wide'>
                          Completed Value
                        </div>
                        <div className='font-bold text-sm text-green-600 dark:text-green-400 truncate'>
                          {fmt(stat.valueCompleted)}
                        </div>
                      </div>
                        </>
                      )}
                      {/* Only Admin can see Team Payment in performance sections, not Manager */}
                      {user && hasRole(normalizeRoles(user.role), ROLES.ADMIN) && (
                      <div className='p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700'>
                        <div className='text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide'>
                          Team Payment
                        </div>
                        <div className='font-bold text-sm text-slate-900 dark:text-slate-100 truncate'>
                          {fmt(stat.employeeCostTotal)}
                        </div>
                      </div>
                      )}
                      {canViewFinanceDetails && (
                      <div className='p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/30'>
                        <div className='text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 uppercase tracking-wide'>
                          Profit
                        </div>
                        <div className='font-bold text-sm text-blue-600 dark:text-blue-400 truncate'>
                          {fmt(stat.profitTotal)}
                        </div>
                      </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Charts moved to Finance page */}
    </>
  );
}
