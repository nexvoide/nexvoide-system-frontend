import React, { useMemo, useState, useEffect } from "react";
import {
  Moon, Sun, Bell, Search, LogOut, Menu, X,
  LayoutDashboard, Briefcase, Users, Globe, Wallet, Settings, Activity, MessageSquare, Archive
} from "lucide-react";
import { useAppStore } from "../stores/appStore.js";
import Dashboard from "../sections/Dashboard.jsx";
import Projects from "../sections/Projects.jsx";
import HR from "../sections/HR.jsx";
import Finance from "../sections/Finance.jsx";
import Setup from "../sections/Setup.jsx";
import SettingsSection from "../sections/Settings.jsx";
import ActivityLogs from "../sections/ActivityLogs.jsx";
import ConnectivityStatus from "../components/ConnectivityStatus.jsx";
import Notifications from "../components/Notifications.jsx";
import Login from "../components/Login.jsx";
import WelcomeAnimation from "../components/WelcomeAnimation.jsx";
import RoleBadge from "../components/RoleBadge.jsx";
import PWAInstallPrompt from "../components/PWAInstallPrompt.jsx";
import { getFilteredNavItems, ROLE_LABELS, normalizeRoles } from "../utils/permissions.js";
import UserManagement from "../sections/UserManagement.jsx";
import MonthlyArchives from "../sections/MonthlyArchives.jsx";

function Shell() {
  const { currency, rate, setCurrency, setRate, initialize, loading, user, userRole, setUser, loadUser, clearUser } = useAppStore();
  const [tab, setTab] = useState("dashboard");
  const [dark, setDark] = useState(true);
  const [showLogin, setShowLogin] = useState(true); // Default to showing login
  const [showWelcome, setShowWelcome] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize app ONCE on mount - FIXED: Empty dependency array prevents re-runs
  useEffect(() => {
    // Start Supabase init in background (non-blocking)
    import('../lib/supabase.js').then(({ initializeSupabase }) => {
      initializeSupabase().catch(() => {}); // Don't block on errors
    });
    // Initialize app immediately (uses cache first, then Supabase)
    // This will only run once on mount, not on every render
    initialize();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array = only run on mount, preventing repeated fetches

  // Load user on mount (after Supabase init)
  useEffect(() => {
    try {
      const savedUser = loadUser();
      if (!savedUser || !savedUser.role || !savedUser.username) {
        setShowLogin(true);
      } else {
        setShowLogin(false);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      setShowLogin(true);
    }
  }, []); // Empty dependency array - only run on mount

  // Watch for user changes and update showLogin accordingly
  useEffect(() => {
    if (!user || !userRole || !user.username) {
      setShowLogin(true);
    } else {
      setShowLogin(false);
    }
  }, [user, userRole]);

  useEffect(() => {
    // initialize from localStorage
    const saved = localStorage.getItem("theme");
    if (saved === "light") setDark(false);
    if (saved === "dark") setDark(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  // Get filtered navigation items based on role
  const navItems = useMemo(() => {
    if (!userRole) return [];
    return getFilteredNavItems(userRole);
  }, [userRole]);

  // Filter users nav item - only show for admin
  const filteredNavItems = useMemo(() => {
    return navItems.filter(item => {
      if (item.id === 'users' && userRole !== 'admin') {
        return false;
      }
      return true;
    });
  }, [navItems, userRole]);

  // Icon mapping
  const iconMap = {
    LayoutDashboard: LayoutDashboard,
    Briefcase: Briefcase,
    Users: Users,
    Wallet: Wallet,
    Settings: Settings,
    Activity: Activity,
    MessageSquare: MessageSquare,
    Archive: Archive,
  };

  const handleLogin = (userData) => {
    // User is already set in store by login function
    setShowLogin(false);
    // Show welcome animation
    setShowWelcome(true);
    // Reset to dashboard after login
    setTab("dashboard");
  };

  const handleWelcomeComplete = () => {
    setShowWelcome(false);
  };

  const handleLogout = () => {
    clearUser();
    setShowLogin(true);
    setTab("dashboard");
  };

  // Show welcome animation if just logged in
  if (showWelcome && user && user.name) {
    return <WelcomeAnimation userName={user.name} onComplete={handleWelcomeComplete} />;
  }

  // Show login if no user is set or if explicitly requested
  if (showLogin || !user || !userRole || !user.username) {
    try {
      return <Login onLogin={handleLogin} />;
    } catch (error) {
      console.error('Error rendering Login:', error);
      return (
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#0a0a0a]">
          <div className="text-center p-8">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Error Loading Login
            </h1>
            <p className="text-slate-500 mb-4">{error.message}</p>
            <button
              onClick={() => {
                localStorage.removeItem('nexvoide_user');
                window.location.reload();
              }}
              className="btn btn-primary"
            >
              Reset and Reload
            </button>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen w-full flex bg-white dark:bg-[#0a0a0a]">

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed md:sticky inset-y-0 left-0 top-0 z-50 md:z-auto flex flex-col gap-2 w-64 md:w-60 p-3 glass h-screen border-r dark:border-slate-800 transform transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div className="flex items-center justify-between px-2 py-1 mb-2">
          <img
            src="/logo.svg"
            alt="Nexvoide"
            width={160}
            height={160}
            className="object-contain"
            onError={(e) => {
              if (e.currentTarget.src.endsWith('/logo.svg')) {
                e.currentTarget.src = '/logo.png';
              }
            }}
          />
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={20} className="text-slate-700 dark:text-slate-300" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-3 py-2 mb-2 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Logged in as</div>
          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate mb-1">
            {user.name}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {user.role && normalizeRoles(user.role).map((role, index) => (
              <RoleBadge key={index} role={role} />
            ))}
          </div>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 flex flex-col gap-2">
          {filteredNavItems.map((item) => {
            const Icon = iconMap[item.icon] || Settings;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition font-medium 
                  ${tab === item.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Logout Button */}
        <div className="mt-auto pt-2 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl transition font-medium hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
          >
            <LogOut size={18} /> Switch Role
          </button>
        </div>
        
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-3 md:px-4 py-3 min-h-screen">
        {/* Top Bar with Connectivity Status */}
        <div className="flex items-center justify-between md:justify-end gap-3 mb-4">
          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Open menu"
          >
            <Menu size={20} className="text-slate-700 dark:text-slate-300" />
          </button>
          
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            <Notifications />
            <ConnectivityStatus />
            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {dark ? <Sun size={18} className="text-slate-700 dark:text-slate-300" /> : <Moon size={18} className="text-slate-700 dark:text-slate-300" />}
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto w-full px-2 md:px-0">
          {tab === "dashboard" && <Dashboard />}
          {tab === "projects" && <Projects />}
          {tab === "hr" && <HR />}
          {tab === "finance" && <Finance />}
          {tab === "setup" && <Setup />}
          {tab === "activity" && <ActivityLogs />}
          {tab === "chat" && (
            <div className="h-[60vh] flex items-center justify-center rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40">
              <div className="text-center px-6">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
                  Chat system is currently paused
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Realtime chat & voice rooms are in beta and will be enabled in a future release.
                </p>
              </div>
            </div>
          )}
          {tab === "settings" && <SettingsSection />}
          {tab === "users" && <UserManagement />}
          {tab === "archives" && <MonthlyArchives />}
        </div>
      </main>

      {/* PWA Install Prompt */}
      <PWAInstallPrompt />
    </div>
  );
}

export default function App() {
  return <Shell />;
}
