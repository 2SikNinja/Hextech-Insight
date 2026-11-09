import 'server-only'
import type { z } from 'zod'
import { getEnv } from '@/lib/env'
import {
  type Platform,
  type RegionalRoute,
  platformHost,
  regionalHost,
} from './regions'
import {
  accountSchema,
  activeGameSchema,
  leagueEntriesSchema,
  masteriesSchema,
  matchIdsSchema,
  matchSchema,
  summonerSchema,
  timelineSchema,
} from './schemas'

// Thin, typed wrapper around the Riot API. Runs on the server only, so the API
// key is sent as a header from our server and never reaches the browser.

export type RiotErrorKind =
  | 'not_found'
  | 'stale_id'
  | 'rate_limited'
  | 'unauthorized'
  | 'unavailable'
  | 'invalid_response'

export class RiotApiError extends Error {
  readonly kind: RiotErrorKind
  readonly status: number
  readonly retryAfterSeconds: number | null

  constructor(kind: RiotErrorKind, status: number, message: string, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'RiotApiError'
    this.kind = kind
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export function isRiotError(error: unknown, kind?: RiotErrorKind): error is RiotApiError {
  return error instanceof RiotApiError && (kind === undefined || error.kind === kind)
}

const requestTimeoutMs = 10_000
// Wait and retry a 429 only when Riot asks for a short pause. Longer waits are
// surfaced to the user rather than holding a serverless function open.
const maxInlineRetryWaitSeconds = 3

async function riotGet<Schema extends z.ZodType>(
  url: string,
  schema: Schema,
  attempt = 1,
): Promise<z.infer<Schema>> {
  const { RIOT_API_KEY } = getEnv()

  let response: Response
  try {
    response = await fetch(url, {
      headers: { 'X-Riot-Token': RIOT_API_KEY },
      signal: AbortSignal.timeout(requestTimeoutMs),
      cache: 'no-store',
    })
  } catch (error) {
    if (attempt === 1) return riotGet(url, schema, attempt + 1)
    throw new RiotApiError('unavailable', 0, `Could not reach the Riot API: ${String(error)}`)
  }

  if (response.status === 429) {
    const retryAfterSeconds = Number(response.headers.get('Retry-After') ?? '1') || 1
    if (attempt === 1 && retryAfterSeconds <= maxInlineRetryWaitSeconds) {
      await sleep(retryAfterSeconds * 1000)
      return riotGet(url, schema, attempt + 1)
    }
    throw new RiotApiError('rate_limited', 429, 'Riot API rate limit reached', retryAfterSeconds)
  }

  if (response.status === 404) {
    throw new RiotApiError('not_found', 404, 'Not found on the Riot API')
  }

  // Riot encrypts player IDs per API key. An ID saved while the site used a
  // different key (for example a development key locally) cannot be decrypted.
  if (response.status === 400) {
    const body = await response.text().catch(() => '')
    if (/decrypt/i.test(body)) {
      throw new RiotApiError('stale_id', 400, 'Saved player ID belongs to a different Riot API key')
    }
    throw new RiotApiError('unavailable', 400, `Riot API rejected the request (400)`)
  }

  if (response.status === 401 || response.status === 403) {
    throw new RiotApiError(
      'unauthorized',
      response.status,
      'The Riot API key was rejected. Development keys expire every 24 hours.',
    )
  }

  if (response.status >= 500) {
    if (attempt === 1) {
      await sleep(500)
      return riotGet(url, schema, attempt + 1)
    }
    throw new RiotApiError('unavailable', response.status, 'The Riot API is having problems')
  }

  if (!response.ok) {
    throw new RiotApiError('unavailable', response.status, `Riot API request failed (${response.status})`)
  }

  const parsed = schema.safeParse(await response.json())
  if (!parsed.success) {
    console.error('Unexpected Riot API response', url.replace(/\?.*$/, ''), parsed.error.issues.slice(0, 5))
    throw new RiotApiError('invalid_response', response.status, 'The Riot API returned data in an unexpected format')
  }
  return parsed.data
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const encode = encodeURIComponent

// ---------- Account-V1 ----------

export function getAccountByRiotId(route: RegionalRoute, gameName: string, tagLine: string) {
  return riotGet(
    `${regionalHost(route)}/riot/account/v1/accounts/by-riot-id/${encode(gameName)}/${encode(tagLine)}`,
    accountSchema,
  )
}

export function getAccountByPuuid(route: RegionalRoute, puuid: string) {
  return riotGet(`${regionalHost(route)}/riot/account/v1/accounts/by-puuid/${encode(puuid)}`, accountSchema)
}

// ---------- Summoner-V4 and League-V4 ----------

export function getSummonerByPuuid(platform: Platform, puuid: string) {
  return riotGet(`${platformHost(platform)}/lol/summoner/v4/summoners/by-puuid/${encode(puuid)}`, summonerSchema)
}

export function getLeagueEntriesByPuuid(platform: Platform, puuid: string) {
  return riotGet(`${platformHost(platform)}/lol/league/v4/entries/by-puuid/${encode(puuid)}`, leagueEntriesSchema)
}

// ---------- Match-V5 ----------

export function getMatchIds(route: RegionalRoute, puuid: string, options: { count: number; start?: number }) {
  const searchParams = new URLSearchParams({
    start: String(options.start ?? 0),
    count: String(options.count),
  })
  return riotGet(
    `${regionalHost(route)}/lol/match/v5/matches/by-puuid/${encode(puuid)}/ids?${searchParams}`,
    matchIdsSchema,
  )
}

export function getMatch(route: RegionalRoute, matchId: string) {
  return riotGet(`${regionalHost(route)}/lol/match/v5/matches/${encode(matchId)}`, matchSchema)
}

export function getMatchTimeline(route: RegionalRoute, matchId: string) {
  return riotGet(`${regionalHost(route)}/lol/match/v5/matches/${encode(matchId)}/timeline`, timelineSchema)
}

// ---------- Champion-Mastery-V4 ----------

export function getTopMasteries(platform: Platform, puuid: string, count = 5) {
  return riotGet(
    `${platformHost(platform)}/lol/champion-mastery/v4/champion-masteries/by-puuid/${encode(puuid)}/top?count=${count}`,
    masteriesSchema,
  )
}

// ---------- Spectator-V5 ----------

/** The player's current game, or null when they are not in one. */
export async function getActiveGame(platform: Platform, puuid: string) {
  try {
    return await riotGet(
      `${platformHost(platform)}/lol/spectator/v5/active-games/by-summoner/${encode(puuid)}`,
      activeGameSchema,
    )
  } catch (error) {
    if (isRiotError(error, 'not_found')) return null
    throw error
  }
}
