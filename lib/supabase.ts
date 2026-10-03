import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Hiányzó Supabase környezeti változók — ellenőrizd a .env.local fájlt.'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
