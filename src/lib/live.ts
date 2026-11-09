import 'server-only'
import { cacheLife } from 'next/cache'
import { reserveBudget } from '@/lib/rateLimit'
import { getActiveGame } from '@/lib/riot/client'
import type { Platform } from '@/lib/riot/regions'

export type LiveStatus = 'in_game' | 'not_in_game' | 'unknown'

/**
 * Whether a player is in a game right now, for the red dot on their profile.
 * Cached for about a minute per player, so busy profiles cost at most one Riot
 * request a minute. Returns 'unknown' when the Riot budget is used up or Riot
 * does not answer, and the page simply shows no dot.
 */
export async function getLiveStatus(platform: Platform, puuid: string): Promise<LiveStatus> {
  'use cache'
  cacheLife({ stale: 30, revalidate: 60, expire: 180 })

  try {
    const budget = await reserveBudget('live_auto', 1)
    if (!budget.allowed) return 'unknown'
    return (await getActiveGame(platform, puuid)) ? 'in_game' : 'not_in_game'
  } catch (error) {
    console.warn('Live status check failed', error)
    return 'unknown'
  }
}
