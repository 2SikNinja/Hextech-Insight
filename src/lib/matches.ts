import 'server-only'
import { DatabaseError, getDb } from '@/lib/db'
import { getMatch, getMatchIds, isRiotError } from '@/lib/riot/client'
import { type Region, getRegionFromMatchId } from '@/lib/riot/regions'
import { type RiotMatch, matchSchema } from '@/lib/riot/schemas'
import { type ParticipantRow, toMatchRow, toParticipantRows } from '@/lib/riot/transform'

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

  const { error: participantError } = await db
    .from('match_participants')
    .upsert(toParticipantRows(match), { onConflict: 'match_id,puuid', ignoreDuplicates: true })
  if (participantError) throw new DatabaseError('save match participants', participantError)
}

/**
 * Pulls the player's most recent match IDs and downloads only the ones we have
 * not stored yet. Stops early, keeping what it saved, if Riot rate limits us.
 */
export async function ingestRecentMatches(region: Region, puuid: string): Promise<IngestResult> {
  let matchIds: string[]
  try {
    matchIds = await getMatchIds(region.matchRoute, puuid, { count: matchesPerIngest })
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
