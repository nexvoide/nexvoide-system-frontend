import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Replace these with your Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Configuration check (only in development)
if (import.meta.env.DEV) {
  console.log("🔍 Supabase Configuration Check:");
  console.log("  - VITE_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
  console.log("  - VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing");
}

// Check if Supabase is configured
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    "⚠️ Supabase credentials not found. Using localStorage fallback. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file to use Supabase."
  );
  console.warn("💡 Troubleshooting: Make sure you've restarted the dev server after updating .env file!");
}

// Main Supabase client instance
export const supabase = isSupabaseConfigured
  ? createSupabaseClient(supabaseUrl, supabaseAnonKey)
  : null;

// Supabase connection status
let isSupabaseConnected = false;
let connectionPromise = null;

/**
 * Initialize and verify Supabase connection
 * @returns {Promise<boolean>} True if connected successfully
 */
export async function initializeSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    console.warn('⚠️ Supabase not configured - using localStorage fallback');
    return false;
  }

  // If already connected, return immediately
  if (isSupabaseConnected) {
    return true;
  }

  // If connection is in progress, wait for it
  if (connectionPromise) {
    return connectionPromise;
  }

  // Start connection test
  connectionPromise = (async () => {
    try {
      // Test connection by querying a simple table (settings is lightweight)
      const { data, error } = await supabase
        .from('settings')
        .select('key')
        .limit(1);

      if (error) {
        // If settings table doesn't exist, try users table
        const { error: userError } = await supabase
          .from('users')
          .select('id')
          .limit(1);

        if (userError) {
          console.error('❌ Supabase connection failed:', userError.message);
          return false;
        }
      }

      isSupabaseConnected = true;
      return true;
    } catch (error) {
      console.error('❌ Supabase connection error:', error);
      return false;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
}

/**
 * Check if Supabase is connected
 * @returns {boolean}
 */
export function isSupabaseReady() {
  return isSupabaseConnected && isSupabaseConfigured;
}

// Auto-initialize Supabase when module loads (for early connection)
if (isSupabaseConfigured && supabase) {
  // Initialize in background (don't block module loading)
  initializeSupabase().catch(err => {
    console.warn('⚠️ Background Supabase initialization failed:', err);
  });
}

// Client factory function (for compatibility with supa/chat patterns)
export function createClient() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file."
    );
  }
  return createSupabaseClient(supabaseUrl, supabaseAnonKey);
}

// Database table names
export const TABLES = {
  projects: "projects",
  employees: "employees",
  time_entries: "time_entries",
  invoices: "invoices",
  invoice_items: "invoice_items",
  profiles: "profiles",
  agencies: "agencies",
  brands: "brands",
  settings: "settings",
  activity_logs: "activity_logs",
  users: "users",
  messages: "messages", // Chat messages table
  channels: "channels", // Chat channels table
  sections: "sections", // Chat sections table
};
