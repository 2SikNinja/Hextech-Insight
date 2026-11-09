import { describe, expect, it } from 'vitest'
import { timelineSchema } from '@/lib/riot/schemas'
import { toTimelineDetails } from '@/lib/riot/transform'

function frames(events: Record<string, unknown>[][]) {
  return events.map((frameEvents, minute) => ({
    timestamp: minute * 60_000,
    participantFrames: {
      '1': { participantId: 1, totalGold: 500 + minute * 400, xp: minute * 300, minionsKilled: minute * 8, jungleMinionsKilled: 0 },
      '6': { participantId: 6, totalGold: 500 + minute * 350, xp: minute * 280, minionsKilled: minute * 7, jungleMinionsKilled: 1 },
    },
    events: frameEvents,
  }))
}

function build(events: Record<string, unknown>[][]) {
  return toTimelineDetails(
    timelineSchema.parse({
      metadata: { matchId: 'NA1_1' },
      info: {
        frameInterval: 60_000,
        frames: frames(events),
        participants: [
          { participantId: 1, puuid: 'a' },
          { participantId: 6, puuid: 'b' },
        ],
      },
    }),
  )
}

describe('toTimelineDetails', () => {
  it('keeps per-frame gold, XP and CS for each player', () => {
    const details = build([[], [], []])
    expect(details.frameMs).toEqual([0, 60_000, 120_000])
    expect(details.stats['1'].gold).toEqual([500, 900, 1300])
    expect(details.stats['6'].cs).toEqual([1, 8, 15])
  })

  it('records purchases and sales, and applies undos', () => {
    const details = build([
      [
        { type: 'ITEM_PURCHASED', timestamp: 1000, participantId: 1, itemId: 1055 },
        { type: 'ITEM_PURCHASED', timestamp: 1200, participantId: 1, itemId: 2003 },
        { type: 'ITEM_UNDO', timestamp: 1300, participantId: 1, beforeId: 2003, afterId: 0, goldGain: 50 },
        { type: 'ITEM_PURCHASED', timestamp: 1400, participantId: 1, itemId: 3340 },
      ],
      [
        { type: 'ITEM_SOLD', timestamp: 70_000, participantId: 1, itemId: 1055 },
        { type: 'ITEM_SOLD', timestamp: 70_500, participantId: 1, itemId: 3340 },
        { type: 'ITEM_UNDO', timestamp: 71_000, participantId: 1, beforeId: 0, afterId: 3340, goldGain: -0 },
        { type: 'ITEM_DESTROYED', timestamp: 72_000, participantId: 1, itemId: 2010 },
      ],
    ])
    expect(details.items.map(({ kind, itemId }) => `${kind} ${itemId}`)).toEqual(['buy 1055', 'buy 3340', 'sell 1055'])
  })

  it('records skill order and skips evolves', () => {
    const details = build([
      [
        { type: 'SKILL_LEVEL_UP', timestamp: 100, participantId: 6, skillSlot: 1, levelUpType: 'NORMAL' },
        { type: 'SKILL_LEVEL_UP', timestamp: 200, participantId: 6, skillSlot: 3, levelUpType: 'NORMAL' },
        { type: 'SKILL_LEVEL_UP', timestamp: 300, participantId: 6, skillSlot: 4, levelUpType: 'EVOLVE' },
      ],
    ])
    expect(details.skills['6']).toEqual([1, 3])
  })

  it('records kills and objectives for the team that took them', () => {
    const details = build([
      [],
      [
        { type: 'CHAMPION_KILL', timestamp: 65_000, killerId: 1, victimId: 6, assistingParticipantIds: [2, 3] },
        { type: 'CHAMPION_KILL', timestamp: 66_000, killerId: 0, victimId: 1 },
        { type: 'ELITE_MONSTER_KILL', timestamp: 70_000, killerTeamId: 200, monsterType: 'DRAGON', monsterSubType: 'FIRE_DRAGON' },
        { type: 'ELITE_MONSTER_KILL', timestamp: 71_000, killerTeamId: 100, monsterType: 'DRAGON', monsterSubType: 'ELDER_DRAGON' },
        { type: 'ELITE_MONSTER_KILL', timestamp: 72_000, killerTeamId: 100, monsterType: 'HORDE' },
        { type: 'BUILDING_KILL', timestamp: 80_000, teamId: 200, buildingType: 'TOWER_BUILDING', laneType: 'MID_LANE' },
        { type: 'WARD_PLACED', timestamp: 81_000, creatorId: 1 },
      ],
    ])
    expect(details.kills).toEqual([
      { t: 65_000, killer: 1, victim: 6, assists: [2, 3] },
      { t: 66_000, killer: 0, victim: 1, assists: [] },
    ])
    expect(details.objectives).toEqual([
      { t: 70_000, kind: 'dragon', teamId: 200, detail: 'FIRE_DRAGON' },
      { t: 71_000, kind: 'elder', teamId: 100, detail: null },
      { t: 72_000, kind: 'grubs', teamId: 100, detail: null },
      // Riot reports the team that lost the building; blue (100) took it.
      { t: 80_000, kind: 'tower', teamId: 100, detail: 'MID_LANE' },
    ])
  })
})
