import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/env'

// Server-only Supabase client using the secret key. The browser never talks to
// the database directly; it only sees pages rendered from this data.

let client: SupabaseClient | null = null

export function getDb(): SupabaseClient {
  if (client) return client

  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = getEnv()
  client = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

export class DatabaseError extends Error {
  constructor(action: string, cause: { message: string }) {
    super(`Database error while trying to ${action}: ${cause.message}`)
    this.name = 'DatabaseError'
  }
}
