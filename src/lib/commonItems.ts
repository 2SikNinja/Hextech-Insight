// The items a player most often finishes games with on a champion, for
// champion pages. Trinkets, wards and consumables are left out.

const ignoredItemIds = new Set([
  2003, 2010, 2031, 2033, 2055, 2138, 2139, 2140, // potions, biscuits, control ward, elixirs
  3340, 3363, 3364, 3330, 3513, // trinkets and Baron/Herald eyes
])

export interface CommonItem {
  itemId: number
  games: number
  share: number // of the games given
}

export function commonFinalItems(itemsPerGame: number[][], limit = 6): CommonItem[] {
  const counts = new Map<number, number>()
  for (const items of itemsPerGame) {
    for (const itemId of new Set(items)) {
      if (itemId && !ignoredItemIds.has(itemId)) counts.set(itemId, (counts.get(itemId) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1] || first[0] - second[0])
    .slice(0, limit)
    .map(([itemId, games]) => ({ itemId, games, share: itemsPerGame.length ? games / itemsPerGame.length : 0 }))
}
