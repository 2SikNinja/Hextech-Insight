import type { RiotMatch, RiotParticipant } from './schemas'

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
