import { createClient } from '@supabase/supabase-js'

// Ez a kliens CSAK szerver-oldali kódban (API route-okban) használható!
// A service_role kulcs megkerüli a Row Level Security szabályokat,
// ezért SOHA nem szabad a böngészőben futó kódba kerülnie.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    'Hiányzó Supabase admin környezeti változók — ellenőrizd a SUPABASE_SERVICE_ROLE_KEY-t.'
  )
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
})
