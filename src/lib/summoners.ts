import 'server-only'
import { DatabaseError, getDb } from '@/lib/db'
import { type IngestResult, ingestRecentMatches } from '@/lib/matches'
import {
  getAccountByPuuid,
  getAccountByRiotId,
  getLeagueEntriesByPuuid,
  getSummonerByPuuid,
} from '@/lib/riot/client'
import { type Region, getRegionByPlatform } from '@/lib/riot/regions'
import type { RiotId } from '@/lib/riot/riotId'
import type { RiotLeagueEntry } from '@/lib/riot/schemas'

// Cache-first summoner lookups. The first search for a player costs a handful of
// Riot calls; after that the page loads from Supabase until someone presses
// "Update", which is rate limited per player by refreshCooldownSeconds.

export const refreshCooldownSeconds = 120

export interface SummonerRecord {
  puuid: string
  platform: string
  game_name: string
  tag_line: string
  profile_icon_id: number
  summoner_level: number
  solo_tier: string | null
  solo_division: string | null
  solo_lp: number | null
  solo_wins: number | null
  solo_losses: number | null
  flex_tier: string | null
  flex_division: string | null
  flex_lp: number | null
  flex_wins: number | null
  flex_losses: number | null
  refreshed_at: string
  created_at: string
}

const summonerColumns =
  'puuid, platform, game_name, tag_line, profile_icon_id, summoner_level, solo_tier, solo_division, solo_lp, solo_wins, solo_losses, flex_tier, flex_division, flex_lp, flex_wins, flex_losses, refreshed_at, created_at'

function rankColumns(prefix: 'solo' | 'flex', entry: RiotLeagueEntry | undefined) {
  return {
    [`${prefix}_tier`]: entry?.tier ?? null,
    [`${prefix}_division`]: entry?.rank ?? null,
    [`${prefix}_lp`]: entry?.leaguePoints ?? null,
    [`${prefix}_wins`]: entry?.wins ?? null,
    [`${prefix}_losses`]: entry?.losses ?? null,
  }
}

/** Fetches profile and rank from Riot and saves them. Returns the saved row. */
async function pullSummoner(region: Region, puuid: string, riotId: RiotId): Promise<SummonerRecord> {
  const [summoner, leagueEntries] = await Promise.all([
    getSummonerByPuuid(region.platform, puuid),
    getLeagueEntriesByPuuid(region.platform, puuid),
  ])

  const soloEntry = leagueEntries.find((entry) => entry.queueType === 'RANKED_SOLO_5x5')
  const flexEntry = leagueEntries.find((entry) => entry.queueType === 'RANKED_FLEX_SR')

  const { data, error } = await getDb()
    .from('summoners')
    .upsert(
      {
        puuid,
        platform: region.platform,
        game_name: riotId.gameName,
        tag_line: riotId.tagLine,
        profile_icon_id: summoner.profileIconId,
        summoner_level: summoner.summonerLevel,
        ...rankColumns('solo', soloEntry),
        ...rankColumns('flex', flexEntry),
        refreshed_at: new Date().toISOString(),
      },
      { onConflict: 'puuid' },
    )
    .select(summonerColumns)
    .single()

  if (error) throw new DatabaseError('save a summoner', error)
  return data as SummonerRecord
}

export async function findStoredSummoner(region: Region, riotId: RiotId): Promise<SummonerRecord | null> {
  const riotIdKey = `${riotId.gameName}#${riotId.tagLine}`.toLowerCase()
  const { data, error } = await getDb()
    .from('summoners')
    .select(summonerColumns)
    .eq('platform', region.platform)
    .eq('riot_id_key', riotIdKey)
    // A Riot ID can pass to a new account after a rename; prefer the freshest row.
    .order('refreshed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new DatabaseError('look up a summoner', error)
  return (data as SummonerRecord | null) ?? null
}

export interface LookupResult {
  summoner: SummonerRecord
  ingest: IngestResult | null // null when served from the cache
}

/**
 * Returns a stored summoner, or looks them up on Riot the first time and
 * downloads their recent matches. Throws RiotApiError('not_found') for unknown
 * players.
 */
export async function lookupSummoner(region: Region, riotId: RiotId): Promise<LookupResult> {
  const stored = await findStoredSummoner(region, riotId)
  if (stored) return { summoner: stored, ingest: null }

  const account = await getAccountByRiotId(region.accountRoute, riotId.gameName, riotId.tagLine)
  const canonicalRiotId = {
    gameName: account.gameName ?? riotId.gameName,
    tagLine: account.tagLine ?? riotId.tagLine,
  }

  const summoner = await pullSummoner(region, account.puuid, canonicalRiotId)
  const ingest = await ingestRecentMatches(region, account.puuid)
  return { summoner, ingest }
}

export type RefreshOutcome =
  | { status: 'updated'; summoner: SummonerRecord; ingest: IngestResult }
  | { status: 'cooldown'; secondsLeft: number }
  | { status: 'missing' }

/** Re-pulls profile, rank and new matches, at most once per cooldown window. */
export async function refreshSummoner(puuid: string): Promise<RefreshOutcome> {
  const { data, error } = await getDb()
    .from('summoners')
    .select(summonerColumns)
    .eq('puuid', puuid)
    .maybeSingle()
  if (error) throw new DatabaseError('load a summoner', error)

  const stored = data as SummonerRecord | null
  const region = stored ? getRegionByPlatform(stored.platform) : null
  if (!stored || !region) return { status: 'missing' }

  const secondsSinceRefresh = (Date.now() - new Date(stored.refreshed_at).getTime()) / 1000
  if (secondsSinceRefresh < refreshCooldownSeconds) {
    return { status: 'cooldown', secondsLeft: Math.ceil(refreshCooldownSeconds - secondsSinceRefresh) }
  }

  // Riot IDs can change, so refresh the name too.
  const account = await getAccountByPuuid(region.accountRoute, puuid)
  const summoner = await pullSummoner(region, puuid, {
    gameName: account.gameName ?? stored.game_name,
    tagLine: account.tagLine ?? stored.tag_line,
  })
  const ingest = await ingestRecentMatches(region, puuid)
  return { status: 'updated', summoner, ingest }
}
