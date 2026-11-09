'use server'

import { refresh } from 'next/cache'
import { DatabaseError, getDb } from '@/lib/db'
import {
  type GameData,
  championIconUrl,
  championName,
  getGameData,
  runeIconUrl,
  runeName,
  spellIconUrl,
  spellName,
} from '@/lib/ddragon'
import { formatTier } from '@/lib/format'
import { ingestOlderMatches, maxStoredGamesPerPlayer } from '@/lib/matches'
import { BudgetExceededError, describeBudgetError, requireBudget, riotCosts } from '@/lib/rateLimit'
import { getActiveGame, isRiotError } from '@/lib/riot/client'
import { getQueueName } from '@/lib/riot/queues'
import { type Region, getRegionByPlatform } from '@/lib/riot/regions'
import { summonerPath } from '@/lib/riot/riotId'
import type { RiotActiveGame } from '@/lib/riot/schemas'
import { refreshSummoner } from '@/lib/summoners'

// Server actions for the summoner page. Anyone can call these, so each one only
// accepts the puuid of a player we already store, and every Riot call goes
// through the rate limiter.

const puuidPattern = /^[A-Za-z0-9_-]{40,100}$/

function readPuuid(formData: FormData): string | null {
  const puuid = formData.get('puuid')
  return typeof puuid === 'string' && puuidPattern.test(puuid) ? puuid : null
}

async function loadStoredRegion(puuid: string): Promise<Region | null> {
  const { data, error } = await getDb().from('summoners').select('platform').eq('puuid', puuid).maybeSingle()
  if (error) throw new DatabaseError('load a summoner', error)
  return data ? getRegionByPlatform(data.platform as string) : null
}

function friendlyActionError(error: unknown, fallback: string): string {
  if (error instanceof BudgetExceededError) return describeBudgetError(error)
  if (isRiotError(error, 'rate_limited')) return `Riot's API is busy. Try again in ${error.retryAfterSeconds ?? 60} seconds.`
  if (isRiotError(error, 'stale_id')) return "This player was saved with a different Riot API key, so Riot can't match it."
  console.error(error)
  return fallback
}

// ---------- Update ----------

export interface RefreshState {
  status: 'idle' | 'updated' | 'error'
  message: string
}

export async function refreshSummonerAction(_previous: RefreshState, formData: FormData): Promise<RefreshState> {
  const puuid = readPuuid(formData)
  if (!puuid) return { status: 'error', message: 'That player could not be updated.' }

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
    return { status: 'error', message: friendlyActionError(error, 'Update failed. Try again shortly.') }
  }
}

// ---------- Load more games ----------

export interface LoadMoreState {
  status: 'idle' | 'loaded' | 'error'
  message: string
  stored: number
}

export async function loadMoreGamesAction(_previous: LoadMoreState, formData: FormData): Promise<LoadMoreState> {
  const puuid = readPuuid(formData)
  if (!puuid) return { status: 'error', message: 'Could not load more games.', stored: 0 }

  try {
    const region = await loadStoredRegion(puuid)
    if (!region) return { status: 'error', message: 'Search for this player again first.', stored: 0 }

    await requireBudget('load_more', riotCosts.loadMore)
    const result = await ingestOlderMatches(region, puuid)

    if (result.stored >= maxStoredGamesPerPlayer && result.added === 0) {
      return { status: 'error', message: `Showing the most recent ${maxStoredGamesPerPlayer} games.`, stored: result.stored }
    }
    if (result.added === 0 && !result.rateLimited) {
      return { status: 'loaded', message: 'No older games found.', stored: result.stored }
    }
    return {
      status: 'loaded',
      message: result.rateLimited
        ? `Loaded ${result.added} older games. Riot's API is busy, so try again in a minute for more.`
        : `Loaded ${result.added} older ${result.added === 1 ? 'game' : 'games'}.`,
      stored: result.stored,
    }
  } catch (error) {
    return { status: 'error', message: friendlyActionError(error, 'Could not load more games.'), stored: 0 }
  }
}

// ---------- Live game ----------

export interface LivePlayer {
  key: string
  name: string
  href: string | null
  isFocus: boolean
  isBot: boolean
  championName: string
  championIcon: string
  spells: { icon: string | null; name: string }[]
  keystone: { icon: string | null; name: string }
  rankLabel: string | null
}

export interface LiveTeam {
  teamId: number
  players: LivePlayer[]
  bans: { icon: string; name: string }[]
}

export type LiveGameState =
  | { status: 'idle' }
  | { status: 'not_in_game'; checkedAt: string }
  | { status: 'error'; message: string }
  | { status: 'in_game'; queueName: string; startedAt: number; teams: LiveTeam[]; checkedAt: string }

async function loadStoredRanks(puuids: string[]): Promise<Map<string, string>> {
  if (puuids.length === 0) return new Map()
  const { data, error } = await getDb()
    .from('summoners')
    .select('puuid, solo_tier, solo_division')
    .in('puuid', puuids)
  if (error) throw new DatabaseError('load stored ranks', error)
  return new Map(
    (data ?? []).map((row) => [row.puuid as string, formatTier(row.solo_tier as string | null, row.solo_division as string | null)]),
  )
}

function toLiveTeams(game: RiotActiveGame, gameData: GameData, region: Region, focusPuuid: string, ranks: Map<string, string>): LiveTeam[] {
  const teamIds = [...new Set(game.participants.map((player) => player.teamId))].sort()

  return teamIds.map((teamId) => ({
    teamId,
    bans: game.bannedChampions
      .filter((ban) => ban.teamId === teamId && ban.championId > 0)
      .map((ban) => ({ icon: championIconUrl(gameData, ban.championId), name: championName(gameData, ban.championId) })),
    players: game.participants
      .filter((player) => player.teamId === teamId)
      .map((player, index) => {
        const [gameName, tagLine] = (player.riotId ?? '').split('#')
        const keystoneId = player.perks?.perkIds[0] ?? null
        return {
          key: player.puuid ?? `${teamId}-${index}`,
          name: gameName || (player.bot ? 'Bot' : 'Hidden player'),
          href: gameName && tagLine ? summonerPath(region.slug, { gameName, tagLine }) : null,
          isFocus: player.puuid === focusPuuid,
          isBot: player.bot,
          championName: championName(gameData, player.championId),
          championIcon: championIconUrl(gameData, player.championId),
          spells: [player.spell1Id, player.spell2Id].map((spellId) => ({
            icon: spellIconUrl(gameData, spellId),
            name: spellName(gameData, spellId),
          })),
          keystone: { icon: runeIconUrl(gameData, keystoneId), name: runeName(gameData, keystoneId) },
          rankLabel: player.puuid ? (ranks.get(player.puuid) ?? null) : null,
        }
      }),
  }))
}

export async function checkLiveGameAction(_previous: LiveGameState, formData: FormData): Promise<LiveGameState> {
  const puuid = readPuuid(formData)
  if (!puuid) return { status: 'error', message: 'Could not check for a live game.' }

  try {
    const region = await loadStoredRegion(puuid)
    if (!region) return { status: 'error', message: 'Search for this player again first.' }

    await requireBudget('live', riotCosts.live)
    const game = await getActiveGame(region.platform, puuid)
    const checkedAt = new Date().toISOString()
    if (!game) return { status: 'not_in_game', checkedAt }

    const puuids = game.participants.map((player) => player.puuid).filter((value): value is string => Boolean(value))
    const [gameData, ranks] = await Promise.all([getGameData(), loadStoredRanks(puuids)])

    return {
      status: 'in_game',
      queueName: getQueueName(game.gameQueueConfigId ?? -1, game.gameMode),
      // gameStartTime is 0 while the game is still loading.
      startedAt: game.gameStartTime > 0 ? game.gameStartTime : Date.now(),
      teams: toLiveTeams(game, gameData, region, puuid, ranks),
      checkedAt,
    }
  } catch (error) {
    return { status: 'error', message: friendlyActionError(error, 'Could not check for a live game.') }
  }
}
