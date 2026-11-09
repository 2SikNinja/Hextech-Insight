import type { ItemEvent } from '@/lib/riot/transform'

// Groups a player's purchases and sales into shopping trips, the way players
// think about a build: "bought Doran's Ring and a potion at 0:00, then came back
// at 6:12 for a Lost Chapter".

export interface BuildEntry {
  itemId: number
  kind: 'buy' | 'sell'
  count: number
}

export interface BuildTrip {
  t: number // milliseconds into the game of the trip's first event
  entries: BuildEntry[]
}

// Purchases this close together count as one trip to the shop.
const tripGapMs = 45_000

export function groupBuildPath(events: ItemEvent[], participantId: number): BuildTrip[] {
  const mine = events.filter((event) => event.pid === participantId).sort((first, second) => first.t - second.t)
  const trips: BuildTrip[] = []
  let lastT = -Infinity

  for (const event of mine) {
    if (event.t - lastT > tripGapMs || trips.length === 0) trips.push({ t: event.t, entries: [] })
    lastT = event.t
    const trip = trips[trips.length - 1]
    const existing = trip.entries.find((entry) => entry.itemId === event.itemId && entry.kind === event.kind)
    if (existing) existing.count += 1
    else trip.entries.push({ itemId: event.itemId, kind: event.kind, count: 1 })
  }
  return trips
}

export const skillKeys = ['Q', 'W', 'E', 'R'] as const

/** Skill order as letters, for example ['Q', 'E', 'W', 'Q', ...]. */
export function skillOrder(slots: number[] | undefined): string[] {
  return (slots ?? []).map((slot) => skillKeys[slot - 1] ?? '?')
}

export function formatGameTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}
