import { describe, expect, it } from 'vitest'
import { formatGameTime, groupBuildPath, skillOrder } from '@/lib/buildPath'
import type { ItemEvent } from '@/lib/riot/transform'

const events: ItemEvent[] = [
  { t: 1_000, pid: 3, kind: 'buy', itemId: 1056 },
  { t: 1_500, pid: 3, kind: 'buy', itemId: 2003 },
  { t: 1_900, pid: 3, kind: 'buy', itemId: 2003 },
  { t: 2_000, pid: 8, kind: 'buy', itemId: 1055 },
  { t: 372_000, pid: 3, kind: 'buy', itemId: 3802 },
  { t: 380_000, pid: 3, kind: 'sell', itemId: 1056 },
  { t: 900_000, pid: 3, kind: 'buy', itemId: 6655 },
]

describe('groupBuildPath', () => {
  it('splits a player’s items into shopping trips and merges duplicates', () => {
    expect(groupBuildPath(events, 3)).toEqual([
      { t: 1_000, entries: [{ itemId: 1056, kind: 'buy', count: 1 }, { itemId: 2003, kind: 'buy', count: 2 }] },
      { t: 372_000, entries: [{ itemId: 3802, kind: 'buy', count: 1 }, { itemId: 1056, kind: 'sell', count: 1 }] },
      { t: 900_000, entries: [{ itemId: 6655, kind: 'buy', count: 1 }] },
    ])
  })

  it('returns nothing for a player with no purchases', () => {
    expect(groupBuildPath(events, 5)).toEqual([])
  })
})

describe('skill order and time', () => {
  it('maps skill slots to keys', () => {
    expect(skillOrder([1, 3, 2, 1, 1, 4])).toEqual(['Q', 'E', 'W', 'Q', 'Q', 'R'])
    expect(skillOrder(undefined)).toEqual([])
  })

  it('formats game time', () => {
    expect(formatGameTime(372_500)).toBe('6:12')
    expect(formatGameTime(0)).toBe('0:00')
  })
})
