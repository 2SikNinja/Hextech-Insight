import 'server-only'
import { DatabaseError, getDb } from '@/lib/db'
import { getMatch, getMatchIds, getMatchTimeline, isRiotError } from '@/lib/riot/client'
import { type Region, getRegionFromMatchId } from '@/lib/riot/regions'
import { type RiotMatch, matchSchema } from '@/lib/riot/schemas'
import { type ParticipantRow, toMatchRow, toParticipantRows, toTimelineRows } from '@/lib/riot/transform'

// Cache-first match storage. A finished match never changes, so each one is
// fetched from Riot exactly once and then served from Supabase forever.

export const matchesPerIngest = 20
const ingestConcurrency = 3

export interface IngestResult {
  added: number
  rateLimited: boolean
}

/** Saves a match and its participants. Safe to call twice for the same match. */
async function storeMatch(match: RiotMatch): Promise<void> {
  const db = getDb()

  const { error: matchError } = await db
    .from('matches')
    .upsert(toMatchRow(match), { onConflict: 'match_id', ignoreDuplicates: true })
  if (matchError) throw new DatabaseError('save a match', matchError)

  const participantRows = toParticipantRows(match)
  const { error: participantError } = await db
    .from('match_participants')
    .upsert(participantRows, { onConflict: 'match_id,puuid', ignoreDuplicates: true })
  if (participantError) throw new DatabaseError('save match participants', participantError)

  // Every player in the match becomes searchable in the search bar suggestions.
  const platform = toMatchRow(match).platform
  await addToPlayerDirectory(
    participantRows.map((row) => ({
      puuid: row.puuid,
      platform,
      game_name: row.riot_id_name,
      tag_line: row.riot_id_tag,
      last_seen: row.game_start,
    })),
  )
}

export interface DirectoryEntry {
  puuid: string
  platform: string
  game_name: string | null
  tag_line: string | null
  last_seen: string
  profile_icon_id?: number
  has_profile?: boolean
}

/** Adds players to the search suggestions. Never fails the caller. */
export async function addToPlayerDirectory(entries: DirectoryEntry[]): Promise<void> {
  if (entries.length === 0) return
  const { error } = await getDb().rpc('upsert_player_directory', { p_rows: entries })
  if (error) console.warn('Could not update the player directory', error.message)
}

/**
 * Pulls a page of the player's match IDs and downloads only the ones we have not
 * stored yet. Stops early, keeping what it saved, if Riot rate limits us.
 */
async function ingestMatchPage(
  region: Region,
  puuid: string,
  page: { start: number; count: number },
): Promise<IngestResult> {
  let matchIds: string[]
  try {
    matchIds = await getMatchIds(region.matchRoute, puuid, page)
  } catch (error) {
    if (isRiotError(error, 'rate_limited')) return { added: 0, rateLimited: true }
    throw error
  }
  if (matchIds.length === 0) return { added: 0, rateLimited: false }

  const { data: existingRows, error } = await getDb()
    .from('matches')
    .select('match_id')
    .in('match_id', matchIds)
  if (error) throw new DatabaseError('check stored matches', error)

  const storedIds = new Set((existingRows ?? []).map((row) => row.match_id as string))
  const missingIds = matchIds.filter((matchId) => !storedIds.has(matchId))

  let added = 0
  let rateLimited = false
  const queue = [...missingIds]

  async function worker() {
    while (queue.length > 0 && !rateLimited) {
      const matchId = queue.shift()
      if (!matchId) return
      try {
        await storeMatch(await getMatch(region.matchRoute, matchId))
        added += 1
      } catch (error) {
        if (isRiotError(error, 'rate_limited')) {
          rateLimited = true
        } else if (isRiotError(error, 'not_found') || isRiotError(error, 'invalid_response')) {
          // Skip matches Riot cannot serve (some special modes) instead of failing the page.
          console.warn(`Skipping match ${matchId}:`, (error as Error).message)
        } else {
          throw error
        }
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(ingestConcurrency, queue.length) }, worker))
  return { added, rateLimited }
}

/** Downloads the player's most recent games that are not stored yet. */
export function ingestRecentMatches(region: Region, puuid: string): Promise<IngestResult> {
  return ingestMatchPage(region, puuid, { start: 0, count: matchesPerIngest })
}

/** Counts how many of the player's games are stored. */
export async function countStoredGames(puuid: string): Promise<number> {
  const { count, error } = await getDb()
    .from('match_participants')
    .select('match_id', { count: 'exact', head: true })
    .eq('puuid', puuid)
  if (error) throw new DatabaseError('count stored games', error)
  return count ?? 0
}

export const maxStoredGamesPerPlayer = 200

/**
 * Downloads the next page of older games. Riot lists matches newest first, so
 * the page starts after the games we already have.
 */
export async function ingestOlderMatches(region: Region, puuid: string): Promise<IngestResult & { stored: number }> {
  const stored = await countStoredGames(puuid)
  if (stored >= maxStoredGamesPerPlayer) return { added: 0, rateLimited: false, stored }
  const result = await ingestMatchPage(region, puuid, { start: stored, count: matchesPerIngest })
  return { ...result, stored: stored + result.added }
}

// ---------- Early-game timelines ----------

// Timelines are only useful for laning stats on Summoner's Rift.
const laningQueueIds = new Set([400, 420, 430, 440, 480, 490, 700])
const timelineConcurrency = 2

/** Matches among the player's recent games that still need a timeline. */
export async function findPendingTimelines(puuid: string, limit: number): Promise<{ match_id: string; queue_id: number }[]> {
  const db = getDb()
  const { data: recent, error } = await db
    .from('match_participants')
    .select('match_id')
    .eq('puuid', puuid)
    .order('game_start', { ascending: false })
    .limit(60)
  if (error) throw new DatabaseError('load recent matches', error)
  if (!recent || recent.length === 0) return []

  const { data: pending, error: pendingError } = await db
    .from('matches')
    .select('match_id, queue_id')
    .in('match_id', recent.map((row) => row.match_id))
    .eq('timeline_status', 'pending')
    .order('game_start', { ascending: false })
    .limit(limit)
  if (pendingError) throw new DatabaseError('find pending timelines', pendingError)
  return pending ?? []
}

async function setTimelineStatus(matchIds: string[], status: 'done' | 'unavailable') {
  if (matchIds.length === 0) return
  const { error } = await getDb().from('matches').update({ timeline_status: status }).in('match_id', matchIds)
  if (error) throw new DatabaseError('update timeline status', error)
}

/**
 * Downloads early-game snapshots for matches that do not have them yet. Runs in
 * the background after a page is sent, so it never slows a page down.
 */
export async function ingestTimelines(
  region: Region,
  pending: { match_id: string; queue_id: number }[],
): Promise<number> {
  const skipped = pending.filter((match) => !laningQueueIds.has(match.queue_id)).map((match) => match.match_id)
  await setTimelineStatus(skipped, 'unavailable')

  const queue = pending.filter((match) => laningQueueIds.has(match.queue_id)).map((match) => match.match_id)
  let stored = 0
  let rateLimited = false

  async function worker() {
    while (queue.length > 0 && !rateLimited) {
      const matchId = queue.shift()
      if (!matchId) return
      try {
        const timeline = await getMatchTimeline(region.matchRoute, matchId)
        const { error } = await getDb()
          .from('participant_timeline')
          .upsert(toTimelineRows(timeline), { onConflict: 'match_id,puuid', ignoreDuplicates: true })
        if (error) throw new DatabaseError('save timeline stats', error)
        await setTimelineStatus([matchId], 'done')
        stored += 1
      } catch (error) {
        if (isRiotError(error, 'rate_limited')) rateLimited = true
        else if (isRiotError(error, 'not_found') || isRiotError(error, 'invalid_response')) {
          await setTimelineStatus([matchId], 'unavailable')
        } else throw error
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(timelineConcurrency, queue.length) }, worker))
  return stored
}

// ---------- Reading match history ----------

export type HistoryRow = ParticipantRow

export interface RosterEntry {
  puuid: string
  participant_id: number
  team_id: number
  champion_id: number
  champion_name: string
  riot_id_name: string | null
  riot_id_tag: string | null
}

export interface HistoryEntry {
  player: HistoryRow
  roster: RosterEntry[]
}

const historyColumns =
  'match_id, puuid, participant_id, queue_id, game_start, duration_secs, riot_id_name, riot_id_tag, team_id, team_position, champion_id, champion_name, champion_level, win, remake, kills, deaths, assists, cs, gold_earned, damage_to_champs, damage_taken, vision_score, kill_participation, summoner_spell_1, summoner_spell_2, items, primary_rune, secondary_style, double_kills, triple_kills, quadra_kills, penta_kills'

export async function getMatchHistory(
  puuid: string,
  options: { queueIds: readonly number[]; limit?: number },
): Promise<HistoryEntry[]> {
  const db = getDb()

  let query = db
    .from('match_participants')
    .select(historyColumns)
    .eq('puuid', puuid)
    .order('game_start', { ascending: false })
    .limit(options.limit ?? matchesPerIngest)
  if (options.queueIds.length > 0) query = query.in('queue_id', [...options.queueIds])

  const { data: playerRows, error } = await query
  if (error) throw new DatabaseError('load match history', error)
  if (!playerRows || playerRows.length === 0) return []

  const matchIds = playerRows.map((row) => row.match_id)
  const { data: rosterRows, error: rosterError } = await db
    .from('match_participants')
    .select('match_id, puuid, participant_id, team_id, champion_id, champion_name, riot_id_name, riot_id_tag')
    .in('match_id', matchIds)
    .order('participant_id', { ascending: true })
  if (rosterError) throw new DatabaseError('load match rosters', rosterError)

  const rosterByMatch = new Map<string, RosterEntry[]>()
  for (const row of rosterRows ?? []) {
    const roster = rosterByMatch.get(row.match_id) ?? []
    roster.push(row as RosterEntry)
    rosterByMatch.set(row.match_id, roster)
  }

  return (playerRows as HistoryRow[]).map((player) => ({
    player,
    roster: rosterByMatch.get(player.match_id) ?? [],
  }))
}

// ---------- Single match ----------

/**
 * Returns a full match from our cache, fetching and storing it from Riot the
 * first time someone opens it (for example from a shared link).
 */
export async function getMatchDetail(matchId: string): Promise<RiotMatch | null> {
  const { data, error } = await getDb()
    .from('matches')
    .select('raw_data')
    .eq('match_id', matchId)
    .maybeSingle()
  if (error) throw new DatabaseError('load a match', error)

  if (data) return matchSchema.parse(data.raw_data)

  const region = getRegionFromMatchId(matchId)
  if (!region) return null

  try {
    const match = await getMatch(region.matchRoute, matchId)
    await storeMatch(match)
    return match
  } catch (fetchError) {
    if (isRiotError(fetchError, 'not_found')) return null
    throw fetchError
  }
}
