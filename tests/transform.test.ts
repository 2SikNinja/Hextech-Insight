import { describe, expect, it } from 'vitest'
import { matchSchema } from '@/lib/riot/schemas'
import {
  getDurationSeconds,
  getKillParticipation,
  getTeamKey,
  toMatchRow,
  toParticipantRows,
} from '@/lib/riot/transform'
import { buildMatchPayload } from './fixtures/match'

function parsedMatch(mutate?: (payload: ReturnType<typeof buildMatchPayload>) => void) {
  const payload = buildMatchPayload()
  mutate?.(payload)
  return matchSchema.parse(payload)
}

describe('matchSchema', () => {
  it('accepts a real-shaped payload and strips unknown fields', () => {
    const match = parsedMatch()
    expect(match.info.participants).toHaveLength(10)
    expect(match.info.participants[0]).not.toHaveProperty('unrealKills')
  })

  it('rejects a payload missing required fields', () => {
    const payload = buildMatchPayload() as { info: Record<string, unknown> }
    delete payload.info.queueId
    expect(matchSchema.safeParse(payload).success).toBe(false)
  })
})

describe('getDurationSeconds', () => {
  it('reads seconds when gameEndTimestamp is present', () => {
    expect(getDurationSeconds(parsedMatch())).toBe(1800)
  })

  it('converts milliseconds for pre-11.20 matches', () => {
    const match = parsedMatch((payload) => {
      delete (payload.info as Partial<typeof payload.info>).gameEndTimestamp
      payload.info.gameDuration = 1_800_000
    })
    expect(getDurationSeconds(match)).toBe(1800)
  })
})

describe('getTeamKey', () => {
  it('ignores playerSubteamId 0 in normal games', () => {
    const match = parsedMatch()
    expect(getTeamKey(match.info.participants[0])).toBe(100)
    expect(getTeamKey(match.info.participants[9])).toBe(200)
  })

  it('uses the Arena subteam when present', () => {
    const match = parsedMatch((payload) => {
      Object.assign(payload.info.participants[0], { playerSubteamId: 3 })
    })
    expect(getTeamKey(match.info.participants[0])).toBe(3)
  })
})

describe('getKillParticipation', () => {
  it('divides kills plus assists by team kills', () => {
    const match = parsedMatch()
    // Team 100 kills: 10 + 2 * 4 = 18. Player 0 has 10 kills and 5 assists.
    expect(getKillParticipation(match, match.info.participants[0])).toBeCloseTo(15 / 18)
  })

  it('returns null when the team has no kills', () => {
    const match = parsedMatch((payload) => {
      payload.info.participants.forEach((player) => Object.assign(player, { kills: 0 }))
    })
    expect(getKillParticipation(match, match.info.participants[0])).toBeNull()
  })
})

describe('row builders', () => {
  it('builds a match row', () => {
    const row = toMatchRow(parsedMatch())
    expect(row).toMatchObject({
      match_id: 'NA1_5012345678',
      platform: 'na1',
      queue_id: 420,
      duration_secs: 1800,
      game_start: new Date(1_762_000_060_000).toISOString(),
    })
  })

  it('builds one participant row per player with flattened stats', () => {
    const rows = toParticipantRows(parsedMatch())
    expect(rows).toHaveLength(10)

    const [first] = rows
    expect(first).toMatchObject({
      puuid: 'puuid-0',
      riot_id_name: 'Player0',
      riot_id_tag: 'NA1',
      team_id: 100,
      cs: 160,
      items: [3031, 3006, 0, 0, 0, 0, 3340],
      primary_rune: 8005,
      secondary_style: 8300,
      double_kills: 2,
      penta_kills: 1,
      win: true,
    })
    expect(rows.every((row) => row.items.length === 7)).toBe(true)
  })
})
