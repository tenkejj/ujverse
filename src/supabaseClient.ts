import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ucoymhbhzdizpkenscdg.supabase.co'
const supabaseAnonKey = 'sb_publishable_GLZEJdHtU6IvPHxNryUaig__CURZK6L'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)