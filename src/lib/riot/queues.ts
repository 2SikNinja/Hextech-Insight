// Queue IDs from Riot's queues.json, limited to the ones players actually see.
// https://static.developer.riotgames.com/docs/lol/queues.json

const queueNames: Record<number, string> = {
  0: 'Custom',
  400: 'Normal Draft',
  420: 'Ranked Solo/Duo',
  430: 'Normal Blind',
  440: 'Ranked Flex',
  450: 'ARAM',
  480: 'Swiftplay',
  490: 'Quickplay',
  700: 'Clash',
  720: 'ARAM Clash',
  830: 'Co-op vs AI',
  840: 'Co-op vs AI',
  850: 'Co-op vs AI',
  870: 'Co-op vs AI',
  880: 'Co-op vs AI',
  890: 'Co-op vs AI',
  900: 'ARURF',
  1020: 'One for All',
  1300: 'Nexus Blitz',
  1400: 'Ultimate Spellbook',
  1700: 'Arena',
  1710: 'Arena',
  1810: 'Swarm',
  1820: 'Swarm',
  1830: 'Swarm',
  1840: 'Swarm',
  1900: 'URF',
  2300: 'Brawl',
  2400: 'ARAM: Mayhem',
}

export function getQueueName(queueId: number, gameMode?: string): string {
  return queueNames[queueId] ?? (gameMode ? titleCase(gameMode) : 'Unknown Queue')
}

// Filters shown as tabs on the summoner page. "all" means no filter.
export const queueFilters = [
  { slug: 'all', label: 'All', queueIds: [] },
  { slug: 'solo', label: 'Ranked Solo', queueIds: [420] },
  { slug: 'flex', label: 'Ranked Flex', queueIds: [440] },
  { slug: 'normal', label: 'Normal', queueIds: [400, 430, 480, 490] },
  { slug: 'aram', label: 'ARAM', queueIds: [450, 2400] },
] as const

export type QueueFilterSlug = (typeof queueFilters)[number]['slug']

export function getQueueFilter(slug: string | undefined | null) {
  return queueFilters.find((filter) => filter.slug === slug) ?? queueFilters[0]
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}
