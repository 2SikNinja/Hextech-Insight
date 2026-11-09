import { describe, expect, it } from 'vitest'
import { commonFinalItems } from '@/lib/commonItems'

describe('commonFinalItems', () => {
  it('counts each item once per game and skips trinkets and consumables', () => {
    const games = [
      [6655, 3020, 2003, 2003, 0, 0, 3340],
      [6655, 4645, 3020, 0, 0, 0, 3363],
      [6655, 4645, 0, 0, 0, 0, 3340],
    ]
    expect(commonFinalItems(games)).toEqual([
      { itemId: 6655, games: 3, share: 1 },
      { itemId: 3020, games: 2, share: 2 / 3 },
      { itemId: 4645, games: 2, share: 2 / 3 },
    ])
  })

  it('handles no games', () => {
    expect(commonFinalItems([])).toEqual([])
  })
})
