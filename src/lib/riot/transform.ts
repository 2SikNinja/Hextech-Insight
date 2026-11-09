import type { RiotMatch, RiotParticipant, RiotTimeline } from './schemas'

// Converts a Riot match into the rows we store in Supabase. Pure functions with
// no I/O, so they are covered by unit tests.

export interface MatchRow {
  match_id: string
  platform: string
  queue_id: number
  game_mode: string
  game_version: string
  game_start: string
  duration_secs: number
  raw_data: RiotMatch
}

export interface ParticipantRow {
  match_id: string
  puuid: string
  participant_id: number
  queue_id: number
  game_start: string
  duration_secs: number
  riot_id_name: string | null
  riot_id_tag: string | null
  team_id: number
  team_position: string
  champion_id: number
  champion_name: string
  champion_level: number
  win: boolean
  remake: boolean
  kills: number
  deaths: number
  assists: number
  cs: number
  gold_earned: number
  damage_to_champs: number
  damage_taken: number
  vision_score: number
  kill_participation: number | null
  summoner_spell_1: number
  summoner_spell_2: number
  items: number[]
  primary_rune: number | null
  secondary_style: number | null
  double_kills: number
  triple_kills: number
  quadra_kills: number
  penta_kills: number
}

/**
 * Riot reports gameDuration in seconds for matches that include
 * gameEndTimestamp (patch 11.20 and later) and in milliseconds before that.
 */
export function getDurationSeconds(match: RiotMatch): number {
  const { gameDuration, gameEndTimestamp } = match.info
  return Math.max(0, Math.round(gameEndTimestamp ? gameDuration : gameDuration / 1000))
}

export function getGameStart(match: RiotMatch): Date {
  return new Date(match.info.gameStartTimestamp ?? match.info.gameCreation)
}

/**
 * Arena groups players into 2-person subteams. Riot also sends
 * playerSubteamId: 0 in normal games, so only a positive value counts.
 */
export function getTeamKey(participant: RiotParticipant): number {
  const subteamId = participant.playerSubteamId ?? 0
  return subteamId > 0 ? subteamId : participant.teamId
}

export function getParticipantItems(participant: RiotParticipant): number[] {
  return [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
    participant.item6,
  ]
}

export function getKillParticipation(match: RiotMatch, participant: RiotParticipant): number | null {
  const teamKey = getTeamKey(participant)
  const teamKills = match.info.participants
    .filter((teammate) => getTeamKey(teammate) === teamKey)
    .reduce((total, teammate) => total + teammate.kills, 0)

  if (teamKills === 0) return null
  return Math.min(1, (participant.kills + participant.assists) / teamKills)
}

export function getRiotIdParts(participant: RiotParticipant): { gameName: string | null; tagLine: string | null } {
  return {
    gameName: participant.riotIdGameName || participant.summonerName || null,
    tagLine: participant.riotIdTagline || null,
  }
}

export function toMatchRow(match: RiotMatch): MatchRow {
  return {
    match_id: match.metadata.matchId,
    platform: match.info.platformId.toLowerCase(),
    queue_id: match.info.queueId,
    game_mode: match.info.gameMode,
    game_version: match.info.gameVersion,
    game_start: getGameStart(match).toISOString(),
    duration_secs: getDurationSeconds(match),
    raw_data: match,
  }
}

export function toParticipantRows(match: RiotMatch): ParticipantRow[] {
  const durationSecs = getDurationSeconds(match)
  const gameStart = getGameStart(match).toISOString()

  return match.info.participants.map((participant) => {
    const { gameName, tagLine } = getRiotIdParts(participant)
    const [primaryStyle, secondaryStyle] = participant.perks?.styles ?? []

    return {
      match_id: match.metadata.matchId,
      puuid: participant.puuid,
      participant_id: participant.participantId,
      queue_id: match.info.queueId,
      game_start: gameStart,
      duration_secs: durationSecs,
      riot_id_name: gameName,
      riot_id_tag: tagLine,
      team_id: getTeamKey(participant),
      team_position: participant.teamPosition,
      champion_id: participant.championId,
      champion_name: participant.championName,
      champion_level: participant.champLevel,
      win: participant.win,
      remake: participant.gameEndedInEarlySurrender,
      kills: participant.kills,
      deaths: participant.deaths,
      assists: participant.assists,
      cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
      gold_earned: participant.goldEarned,
      damage_to_champs: participant.totalDamageDealtToChampions,
      damage_taken: participant.totalDamageTaken,
      vision_score: participant.visionScore,
      kill_participation: getKillParticipation(match, participant),
      summoner_spell_1: participant.summoner1Id,
      summoner_spell_2: participant.summoner2Id,
      items: getParticipantItems(participant),
      primary_rune: primaryStyle?.selections[0]?.perk ?? null,
      secondary_style: secondaryStyle?.style ?? null,
      double_kills: participant.doubleKills,
      triple_kills: participant.tripleKills,
      quadra_kills: participant.quadraKills,
      penta_kills: participant.pentaKills,
    }
  })
}

// ---------- Timeline: early-game snapshots ----------

export interface TimelineRow {
  match_id: string
  puuid: string
  gold_10: number | null
  cs_10: number | null
  xp_10: number | null
  gold_15: number | null
  cs_15: number | null
  xp_15: number | null
}

/** The first frame at or after the given minute, or null if the game ended earlier. */
function frameAtMinute(timeline: RiotTimeline, minute: number) {
  const target = minute * 60_000
  return timeline.info.frames.find((frame) => frame.timestamp >= target) ?? null
}

/** Gold, CS and XP for every player at 10 and 15 minutes. */
export function toTimelineRows(timeline: RiotTimeline): TimelineRow[] {
  const at10 = frameAtMinute(timeline, 10)
  const at15 = frameAtMinute(timeline, 15)

  return timeline.info.participants.map(({ participantId, puuid }) => {
    const frame10 = at10?.participantFrames[String(participantId)]
    const frame15 = at15?.participantFrames[String(participantId)]
    return {
      match_id: timeline.metadata.matchId,
      puuid,
      gold_10: frame10?.totalGold ?? null,
      cs_10: frame10 ? frame10.minionsKilled + frame10.jungleMinionsKilled : null,
      xp_10: frame10?.xp ?? null,
      gold_15: frame15?.totalGold ?? null,
      cs_15: frame15 ? frame15.minionsKilled + frame15.jungleMinionsKilled : null,
      xp_15: frame15?.xp ?? null,
    }
  })
}

// ---------- Timeline: full match details (build paths, skills, objectives) ----------

export interface ItemEvent {
  t: number // milliseconds into the game
  pid: number // participantId
  kind: 'buy' | 'sell'
  itemId: number
}

export interface KillEvent {
  t: number
  killer: number // 0 when executed by a tower or minion
  victim: number
  assists: number[]
}

export type ObjectiveKind = 'dragon' | 'elder' | 'baron' | 'herald' | 'grubs' | 'atakhan' | 'tower' | 'inhibitor'

export interface ObjectiveEvent {
  t: number
  kind: ObjectiveKind
  teamId: number // team that took the objective
  detail: string | null // dragon type, or lane for buildings
}

export interface TimelineDetails {
  frameMs: number[] // timestamp of each frame
  stats: Record<string, { gold: number[]; xp: number[]; cs: number[] }> // per participantId, one value per frame
  items: ItemEvent[]
  skills: Record<string, number[]> // per participantId: skill slot (1-4) for each level-up, in order
  kills: KillEvent[]
  objectives: ObjectiveEvent[]
}

function numberField(event: Record<string, unknown>, key: string): number | null {
  const value = event[key]
  return typeof value === 'number' ? value : null
}

function stringField(event: Record<string, unknown>, key: string): string | null {
  const value = event[key]
  return typeof value === 'string' ? value : null
}

const monsterKinds: Record<string, ObjectiveKind> = {
  BARON_NASHOR: 'baron',
  RIFTHERALD: 'herald',
  HORDE: 'grubs',
  ATAKHAN: 'atakhan',
}

function otherTeam(teamId: number): number {
  return teamId === 100 ? 200 : 100
}

/**
 * Compacts a Match-V5 timeline into what the match page needs. Item undos are
 * applied here, so the stored list is the build as it actually ended up.
 */
export function toTimelineDetails(timeline: RiotTimeline): TimelineDetails {
  const frames = timeline.info.frames
  const stats: TimelineDetails['stats'] = {}
  for (const { participantId } of timeline.info.participants) {
    const key = String(participantId)
    stats[key] = { gold: [], xp: [], cs: [] }
    for (const frame of frames) {
      const snapshot = frame.participantFrames[key]
      stats[key].gold.push(snapshot?.totalGold ?? 0)
      stats[key].xp.push(snapshot?.xp ?? 0)
      stats[key].cs.push(snapshot ? snapshot.minionsKilled + snapshot.jungleMinionsKilled : 0)
    }
  }

  const items: ItemEvent[] = []
  const skills: TimelineDetails['skills'] = {}
  const kills: KillEvent[] = []
  const objectives: ObjectiveEvent[] = []

  const removeLast = (pid: number, kind: ItemEvent['kind'], itemId: number) => {
    for (let index = items.length - 1; index >= 0; index--) {
      if (items[index].pid === pid && items[index].kind === kind && items[index].itemId === itemId) {
        items.splice(index, 1)
        return
      }
    }
  }

  for (const frame of frames) {
    for (const raw of frame.events) {
      const event = raw as Record<string, unknown>
      const t = raw.timestamp
      const pid = numberField(event, 'participantId')

      switch (raw.type) {
        case 'ITEM_PURCHASED': {
          const itemId = numberField(event, 'itemId')
          if (pid && itemId) items.push({ t, pid, kind: 'buy', itemId })
          break
        }
        case 'ITEM_SOLD': {
          const itemId = numberField(event, 'itemId')
          if (pid && itemId) items.push({ t, pid, kind: 'sell', itemId })
          break
        }
        case 'ITEM_UNDO': {
          // Undoing a purchase: beforeId is the item, afterId is 0.
          // Undoing a sale: beforeId is 0, afterId is the item.
          const beforeId = numberField(event, 'beforeId') ?? 0
          const afterId = numberField(event, 'afterId') ?? 0
          if (!pid) break
          if (beforeId > 0) removeLast(pid, 'buy', beforeId)
          else if (afterId > 0) removeLast(pid, 'sell', afterId)
          break
        }
        case 'SKILL_LEVEL_UP': {
          const slot = numberField(event, 'skillSlot')
          // EVOLVE level-ups (Kha'Zix, Kai'Sa...) are upgrades, not skill points.
          if (pid && slot && stringField(event, 'levelUpType') !== 'EVOLVE') {
            ;(skills[String(pid)] ??= []).push(slot)
          }
          break
        }
        case 'CHAMPION_KILL': {
          const victim = numberField(event, 'victimId')
          if (victim) {
            const assists = event.assistingParticipantIds
            kills.push({
              t,
              killer: numberField(event, 'killerId') ?? 0,
              victim,
              assists: Array.isArray(assists) ? assists.filter((value): value is number => typeof value === 'number') : [],
            })
          }
          break
        }
        case 'ELITE_MONSTER_KILL': {
          const teamId = numberField(event, 'killerTeamId')
          const monster = stringField(event, 'monsterType')
          if (!teamId || !monster) break
          const subType = stringField(event, 'monsterSubType')
          if (monster === 'DRAGON') {
            const isElder = subType === 'ELDER_DRAGON'
            objectives.push({ t, kind: isElder ? 'elder' : 'dragon', teamId, detail: isElder ? null : subType })
          } else if (monsterKinds[monster]) {
            objectives.push({ t, kind: monsterKinds[monster], teamId, detail: null })
          }
          break
        }
        case 'BUILDING_KILL': {
          // teamId is the team that LOST the building.
          const lostTeam = numberField(event, 'teamId')
          const building = stringField(event, 'buildingType')
          if (!lostTeam || !building) break
          const kind = building === 'INHIBITOR_BUILDING' ? 'inhibitor' : building === 'TOWER_BUILDING' ? 'tower' : null
          if (kind) objectives.push({ t, kind, teamId: otherTeam(lostTeam), detail: stringField(event, 'laneType') })
          break
        }
      }
    }
  }

  return { frameMs: frames.map((frame) => frame.timestamp), stats, items, skills, kills, objectives }
}
