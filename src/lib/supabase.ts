import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Using any type for now until database schema is created
// After running the schema.sql, you can generate proper types using:
// npx supabase gen types typescript --project-id zhthcdwcmcdwcxwjvpfz > src/types/database.ts
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
