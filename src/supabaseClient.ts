import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Brak VITE_SUPABASE_URL i/lub VITE_SUPABASE_PUBLISHABLE_KEY (alias: VITE_SUPABASE_ANON_KEY) w środowisku.',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
