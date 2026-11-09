import 'server-only'
import { DatabaseError } from '@/lib/db'
import { ConfigError } from '@/lib/env'
import { BudgetExceededError, describeBudgetError } from '@/lib/rateLimit'
import { RiotApiError } from '@/lib/riot/client'

export interface FriendlyError {
  title: string
  message: string
}

/** Turns a server error into wording a visitor can act on. */
export function describeError(error: unknown, context: { notFound: string }): FriendlyError {
  if (error instanceof RiotApiError) {
    switch (error.kind) {
      case 'not_found':
        return { title: 'Player not found', message: context.notFound }
      case 'rate_limited':
        return {
          title: "Riot's API is busy",
          message: `Too many lookups at once. Try again in ${error.retryAfterSeconds ?? 60} seconds.`,
        }
      case 'unauthorized':
        return {
          title: 'Lookups are paused',
          message: "The site's Riot API key has expired or was rejected. Players already stored still load.",
        }
      default:
        return { title: "Riot's API is unavailable", message: 'Riot did not respond. Try again in a minute.' }
    }
  }

  if (error instanceof BudgetExceededError) {
    return { title: 'Slow down a little', message: describeBudgetError(error) }
  }

  if (error instanceof ConfigError) {
    console.error(error)
    // Variable names help locally but should not be shown to visitors of the live site.
    const message =
      process.env.NODE_ENV === 'production' ? 'The site is being set up. Check back soon.' : error.message
    return { title: 'Site not configured', message }
  }

  if (error instanceof DatabaseError) {
    console.error(error)
    return { title: 'Something went wrong', message: 'The database did not respond. Try again in a minute.' }
  }

  console.error(error)
  return { title: 'Something went wrong', message: 'An unexpected error occurred. Try again in a minute.' }
}
