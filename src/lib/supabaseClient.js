import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// sessionStorage = per-tab, jadi tiap tab bisa login akun berbeda (demo multi-role)
// shortcut: kalau perlu "ingat login setelah tutup browser", ganti balik ke localStorage
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storage: window.sessionStorage, persistSession: true },
})

