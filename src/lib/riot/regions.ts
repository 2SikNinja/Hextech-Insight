// Riot splits its API into "platforms" (na1, euw1, ...) for summoner and league
// data and "regional routes" (americas, europe, ...) for accounts and matches.
// This file maps the short slugs used in our URLs to both.

export type RegionalRoute = 'americas' | 'asia' | 'europe' | 'sea'

export type Platform =
  | 'na1'
  | 'br1'
  | 'la1'
  | 'la2'
  | 'euw1'
  | 'eun1'
  | 'tr1'
  | 'ru'
  | 'me1'
  | 'kr'
  | 'jp1'
  | 'oc1'
  | 'sg2'
  | 'tw2'
  | 'vn2'

export interface Region {
  slug: string // used in URLs: /summoner/na/...
  platform: Platform
  label: string
  shortLabel: string
  matchRoute: RegionalRoute // Match-V5
  accountRoute: Exclude<RegionalRoute, 'sea'> // Account-V1 has no SEA route
}

export const regions: readonly Region[] = [
  { slug: 'na', platform: 'na1', label: 'North America', shortLabel: 'NA', matchRoute: 'americas', accountRoute: 'americas' },
  { slug: 'euw', platform: 'euw1', label: 'Europe West', shortLabel: 'EUW', matchRoute: 'europe', accountRoute: 'europe' },
  { slug: 'eune', platform: 'eun1', label: 'Europe Nordic & East', shortLabel: 'EUNE', matchRoute: 'europe', accountRoute: 'europe' },
  { slug: 'kr', platform: 'kr', label: 'Korea', shortLabel: 'KR', matchRoute: 'asia', accountRoute: 'asia' },
  { slug: 'jp', platform: 'jp1', label: 'Japan', shortLabel: 'JP', matchRoute: 'asia', accountRoute: 'asia' },
  { slug: 'br', platform: 'br1', label: 'Brazil', shortLabel: 'BR', matchRoute: 'americas', accountRoute: 'americas' },
  { slug: 'lan', platform: 'la1', label: 'Latin America North', shortLabel: 'LAN', matchRoute: 'americas', accountRoute: 'americas' },
  { slug: 'las', platform: 'la2', label: 'Latin America South', shortLabel: 'LAS', matchRoute: 'americas', accountRoute: 'americas' },
  { slug: 'oce', platform: 'oc1', label: 'Oceania', shortLabel: 'OCE', matchRoute: 'sea', accountRoute: 'asia' },
  { slug: 'tr', platform: 'tr1', label: 'Türkiye', shortLabel: 'TR', matchRoute: 'europe', accountRoute: 'europe' },
  { slug: 'ru', platform: 'ru', label: 'Russia', shortLabel: 'RU', matchRoute: 'europe', accountRoute: 'europe' },
  { slug: 'me', platform: 'me1', label: 'Middle East', shortLabel: 'ME', matchRoute: 'europe', accountRoute: 'europe' },
  { slug: 'sg', platform: 'sg2', label: 'Southeast Asia', shortLabel: 'SEA', matchRoute: 'sea', accountRoute: 'asia' },
  { slug: 'tw', platform: 'tw2', label: 'Taiwan', shortLabel: 'TW', matchRoute: 'sea', accountRoute: 'asia' },
  { slug: 'vn', platform: 'vn2', label: 'Vietnam', shortLabel: 'VN', matchRoute: 'sea', accountRoute: 'asia' },
]

export const defaultRegionSlug = 'na'

const regionsBySlug = new Map(regions.map((region) => [region.slug, region]))
const regionsByPlatform = new Map(regions.map((region) => [region.platform, region]))

export function getRegionBySlug(slug: string): Region | null {
  return regionsBySlug.get(slug.toLowerCase()) ?? null
}

export function getRegionByPlatform(platform: string): Region | null {
  return regionsByPlatform.get(platform.toLowerCase() as Platform) ?? null
}

/**
 * Match IDs start with the platform they were played on: "NA1_5012345678".
 */
export function getRegionFromMatchId(matchId: string): Region | null {
  const [prefix] = matchId.split('_')
  return prefix ? getRegionByPlatform(prefix) : null
}

export function isValidMatchId(matchId: string): boolean {
  return /^[A-Z0-9]{2,5}_\d{5,15}$/.test(matchId) && getRegionFromMatchId(matchId) !== null
}

export function platformHost(platform: Platform): string {
  return `https://${platform}.api.riotgames.com`
}

export function regionalHost(route: RegionalRoute): string {
  return `https://${route}.api.riotgames.com`
}
