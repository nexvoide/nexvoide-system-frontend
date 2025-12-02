import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Replace these with your Supabase project credentials
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Debug logging (remove in production if needed)
if (import.meta.env.DEV) {
  console.log("🔍 Supabase Configuration Check:");
  console.log("  - VITE_SUPABASE_URL:", supabaseUrl ? "✅ Set" : "❌ Missing");
  console.log("  - VITE_SUPABASE_ANON_KEY:", supabaseAnonKey ? "✅ Set" : "❌ Missing");
  if (supabaseUrl) {
    console.log("  - URL starts with https://:", supabaseUrl.startsWith("https://") ? "✅" : "❌");
    console.log("  - URL ends with .supabase.co:", supabaseUrl.includes(".supabase.co") ? "✅" : "❌");
  }
  if (supabaseAnonKey) {
    console.log("  - Key starts with eyJ:", supabaseAnonKey.startsWith("eyJ") ? "✅" : "❌");
  }
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
