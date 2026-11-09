import { describe, expect, it } from 'vitest'
import { timelineSchema } from '@/lib/riot/schemas'
import { toTimelineRows } from '@/lib/riot/transform'

function frame(minute: number, offsetMs = 15) {
  const participantFrames: Record<string, unknown> = {}
  for (let id = 1; id <= 2; id++) {
    participantFrames[String(id)] = {
      participantId: id,
      totalGold: 500 + minute * 300 * id,
      xp: minute * 400,
      minionsKilled: minute * 7,
      jungleMinionsKilled: id === 2 ? minute : 0,
      level: 1,
    }
  }
  return { timestamp: minute * 60_000 + offsetMs, participantFrames, events: [] }
}

function buildTimeline(lastMinute: number) {
  return timelineSchema.parse({
    metadata: { matchId: 'NA1_1' },
    info: {
      frameInterval: 60_000,
      frames: Array.from({ length: lastMinute + 1 }, (_, minute) => frame(minute, minute === 0 ? 0 : 15)),
      participants: [
        { participantId: 1, puuid: 'puuid-a' },
        { participantId: 2, puuid: 'puuid-b' },
      ],
    },
  })
}

describe('toTimelineRows', () => {
  it('reads gold, CS and XP at 10 and 15 minutes', () => {
    const [first, second] = toTimelineRows(buildTimeline(30))
    expect(first).toEqual({
      match_id: 'NA1_1',
      puuid: 'puuid-a',
      gold_10: 3500,
      cs_10: 70,
      xp_10: 4000,
      gold_15: 5000,
      cs_15: 105,
      xp_15: 6000,
    })
    // Jungle camps count toward CS.
    expect(second.cs_10).toBe(80)
  })

  it('leaves 15-minute values empty when the game ended before 15 minutes', () => {
    const [first] = toTimelineRows(buildTimeline(12))
    expect(first.gold_10).toBe(3500)
    expect(first.gold_15).toBeNull()
    expect(first.cs_15).toBeNull()
  })
})
