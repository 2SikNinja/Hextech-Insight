'use server'

import { refresh } from 'next/cache'
import { isRiotError } from '@/lib/riot/client'
import { refreshSummoner } from '@/lib/summoners'

export interface RefreshState {
  status: 'idle' | 'updated' | 'error'
  message: string
}

const puuidPattern = /^[A-Za-z0-9_-]{40,100}$/

/**
 * "Update" button on the summoner page. Anyone can call this, so it only takes
 * a puuid of a player we already store, and refreshSummoner enforces a
 * per-player cooldown to protect the Riot rate limit.
 */
export async function refreshSummonerAction(_previous: RefreshState, formData: FormData): Promise<RefreshState> {
  const puuid = formData.get('puuid')
  if (typeof puuid !== 'string' || !puuidPattern.test(puuid)) {
    return { status: 'error', message: 'That player could not be updated.' }
  }

  try {
    const outcome = await refreshSummoner(puuid)

    if (outcome.status === 'cooldown') {
      return { status: 'error', message: `Updated recently. You can update again in ${outcome.secondsLeft}s.` }
    }
    if (outcome.status === 'missing') {
      return { status: 'error', message: 'That player is no longer stored. Search for them again.' }
    }

    refresh()
    const { added, rateLimited } = outcome.ingest
    if (rateLimited) {
      return {
        status: 'updated',
        message: `Added ${added} new ${added === 1 ? 'game' : 'games'}. Riot's API is busy, so update again in a minute for the rest.`,
      }
    }
    return {
      status: 'updated',
      message: added === 0 ? 'Up to date. No new games.' : `Added ${added} new ${added === 1 ? 'game' : 'games'}.`,
    }
  } catch (error) {
    if (isRiotError(error, 'rate_limited')) {
      return { status: 'error', message: `Riot's API is busy. Try again in ${error.retryAfterSeconds ?? 60}s.` }
    }
    console.error('Refresh failed', error)
    return { status: 'error', message: 'Update failed. Try again shortly.' }
  }
}
