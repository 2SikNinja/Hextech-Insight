import { z } from 'zod'

// Zod schemas for the Riot API responses we use. Unknown fields are stripped,
// and anything we rely on is validated, so if Riot renames or removes a field
// (like the summoner "id" removal) we get a clear error at the boundary instead
// of undefined values leaking into the UI.

export const accountSchema = z.object({
  puuid: z.string().min(1),
  gameName: z.string().nullish(),
  tagLine: z.string().nullish(),
})
export type RiotAccount = z.infer<typeof accountSchema>

export const summonerSchema = z.object({
  puuid: z.string().min(1),
  profileIconId: z.number().int(),
  revisionDate: z.number(),
  summonerLevel: z.number().int(),
})
export type RiotSummoner = z.infer<typeof summonerSchema>

export const leagueEntrySchema = z.object({
  queueType: z.string(),
  tier: z.string(),
  rank: z.string(),
  leaguePoints: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
})
export const leagueEntriesSchema = z.array(leagueEntrySchema)
export type RiotLeagueEntry = z.infer<typeof leagueEntrySchema>

export const matchIdsSchema = z.array(z.string())

const perkStyleSchema = z.object({
  style: z.number().int(),
  selections: z.array(z.object({ perk: z.number().int() })).default([]),
})

export const participantSchema = z.object({
  puuid: z.string(),
  participantId: z.number().int(),
  riotIdGameName: z.string().nullish(),
  riotIdTagline: z.string().nullish(),
  summonerName: z.string().nullish(),
  teamId: z.number().int(),
  teamPosition: z.string().default(''),
  championId: z.number().int(),
  championName: z.string(),
  champLevel: z.number().int(),
  win: z.boolean(),
  gameEndedInEarlySurrender: z.boolean().default(false),
  kills: z.number().int(),
  deaths: z.number().int(),
  assists: z.number().int(),
  totalMinionsKilled: z.number().int(),
  neutralMinionsKilled: z.number().int().default(0),
  goldEarned: z.number().int(),
  totalDamageDealtToChampions: z.number().int(),
  totalDamageTaken: z.number().int(),
  visionScore: z.number().int().default(0),
  summoner1Id: z.number().int(),
  summoner2Id: z.number().int(),
  item0: z.number().int(),
  item1: z.number().int(),
  item2: z.number().int(),
  item3: z.number().int(),
  item4: z.number().int(),
  item5: z.number().int(),
  item6: z.number().int(),
  perks: z.object({ styles: z.array(perkStyleSchema).default([]) }).optional(),
  doubleKills: z.number().int().default(0),
  tripleKills: z.number().int().default(0),
  quadraKills: z.number().int().default(0),
  pentaKills: z.number().int().default(0),
  playerSubteamId: z.number().int().optional(),
  placement: z.number().int().optional(),
})
export type RiotParticipant = z.infer<typeof participantSchema>

const objectiveSchema = z.object({ kills: z.number().int() })

export const teamSchema = z.object({
  teamId: z.number().int(),
  win: z.boolean(),
  bans: z.array(z.object({ championId: z.number().int() })).default([]),
  objectives: z
    .object({
      baron: objectiveSchema.optional(),
      dragon: objectiveSchema.optional(),
      tower: objectiveSchema.optional(),
      inhibitor: objectiveSchema.optional(),
      riftHerald: objectiveSchema.optional(),
      horde: objectiveSchema.optional(),
      champion: objectiveSchema.optional(),
    })
    .optional(),
})
export type RiotTeam = z.infer<typeof teamSchema>

export const matchSchema = z.object({
  metadata: z.object({
    matchId: z.string(),
  }),
  info: z.object({
    gameCreation: z.number(),
    gameStartTimestamp: z.number().optional(),
    gameEndTimestamp: z.number().optional(),
    gameDuration: z.number(),
    gameMode: z.string(),
    gameVersion: z.string(),
    platformId: z.string(),
    queueId: z.number().int(),
    participants: z.array(participantSchema).min(1),
    teams: z.array(teamSchema).default([]),
  }),
})
export type RiotMatch = z.infer<typeof matchSchema>
