import { createClient } from "@supabase/supabase-js";

// Only the PUBLIC project URL + PUBLISHABLE key live here.
// This is safe in the browser because Row Level Security (RLS) is ON
// for every table and storage bucket — the key alone grants nothing
// without a valid logged-in session.
// NEVER put the sb_secret_… key in this file.
const SUPABASE_URL = "https://erdepzculjgkksvvhzrq.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_MXrDCLre48owHaYBaQzfrw_fwyRe4lw";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
