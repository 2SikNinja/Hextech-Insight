import 'server-only'
import { z } from 'zod'

// Server-side configuration, validated once on first use. Nothing here uses the
// NEXT_PUBLIC_ prefix, so none of it can end up in the browser bundle.

const envSchema = z.object({
  RIOT_API_KEY: z.string().startsWith('RGAPI-', 'RIOT_API_KEY should start with RGAPI-'),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(20),
  SITE_URL: z.url().default('http://localhost:3000'),
})

export type ServerEnv = z.infer<typeof envSchema>

export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

let cachedEnv: ServerEnv | null = null

export function getEnv(): ServerEnv {
  if (cachedEnv) return cachedEnv

  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new ConfigError(`Server is missing configuration (${problems}). See .env.example.`)
  }

  cachedEnv = result.data
  return cachedEnv
}

/** Site URL for metadata. Never throws, so it is safe in layouts. */
export function getSiteUrl(): string {
  const configured = process.env.SITE_URL
  if (configured) return configured
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  return 'http://localhost:3000'
}
