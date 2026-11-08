import 'server-only'
import { cacheLife } from 'next/cache'

// Data Dragon: Riot's CDN for League of Legends static data and images.
// Images are loaded by the browser straight from Riot, and the metadata we need
// (names and image file names) is fetched once and cached for hours, so new
// champions and items show up automatically when a patch goes live.

const cdnBase = 'https://ddragon.leagueoflegends.com'
const locale = 'en_US'
const fallbackVersion = '15.8.1'

interface NamedImage {
  name: string
  image: string // file name, e.g. "MonkeyKing.png"
}

export interface GameData {
  version: string
  champions: Record<string, NamedImage & { id: string }> // keyed by numeric champion id
  items: Record<string, { name: string }> // keyed by item id
  spells: Record<string, NamedImage> // keyed by numeric spell id
  runes: Record<string, NamedImage> // keyed by rune or style id; image is a path
}

interface ChampionJson {
  data: Record<string, { id: string; key: string; name: string; image: { full: string } }>
}
interface ItemJson {
  data: Record<string, { name: string }>
}
interface SpellJson {
  data: Record<string, { key: string; name: string; image: { full: string } }>
}
type RuneJson = Array<{
  id: number
  name: string
  icon: string
  slots: Array<{ runes: Array<{ id: number; name: string; icon: string }> }>
}>

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error(`Data Dragon request failed (${response.status}): ${url}`)
  return (await response.json()) as T
}

async function getLatestVersion(): Promise<string> {
  try {
    const versions = await fetchJson<string[]>(`${cdnBase}/api/versions.json`)
    return versions[0] ?? fallbackVersion
  } catch (error) {
    console.warn('Could not load Data Dragon versions, using fallback', error)
    return fallbackVersion
  }
}

/**
 * Loads trimmed champion, item, spell and rune data for the current patch.
 * Cached across requests, so it costs one round of CDN requests every few hours.
 */
export async function getGameData(): Promise<GameData> {
  'use cache'
  cacheLife('hours')

  const version = await getLatestVersion()
  const dataUrl = (file: string) => `${cdnBase}/cdn/${version}/data/${locale}/${file}`

  const [championJson, itemJson, spellJson, runeJson] = await Promise.all([
    fetchJson<ChampionJson>(dataUrl('champion.json')),
    fetchJson<ItemJson>(dataUrl('item.json')),
    fetchJson<SpellJson>(dataUrl('summoner.json')),
    fetchJson<RuneJson>(dataUrl('runesReforged.json')),
  ])

  const champions: GameData['champions'] = {}
  for (const champion of Object.values(championJson.data)) {
    champions[champion.key] = { id: champion.id, name: champion.name, image: champion.image.full }
  }

  const items: GameData['items'] = {}
  for (const [itemId, item] of Object.entries(itemJson.data)) {
    items[itemId] = { name: item.name }
  }

  const spells: GameData['spells'] = {}
  for (const spell of Object.values(spellJson.data)) {
    spells[spell.key] = { name: spell.name, image: spell.image.full }
  }

  const runes: GameData['runes'] = {}
  for (const style of runeJson) {
    runes[style.id] = { name: style.name, image: style.icon }
    for (const slot of style.slots) {
      for (const rune of slot.runes) {
        runes[rune.id] = { name: rune.name, image: rune.icon }
      }
    }
  }

  return { version, champions, items, spells, runes }
}

// ---------- URL builders (pure, safe to call anywhere on the server) ----------

export function championIconUrl(data: GameData, championId: number, championName?: string): string {
  const champion = data.champions[championId]
  // Riot's championName in match data matches the image file name for almost
  // every champion, so it is a good fallback for champions newer than our data.
  const fileName = champion?.image ?? (championName ? `${championName}.png` : null)
  return fileName ? `${cdnBase}/cdn/${data.version}/img/champion/${fileName}` : placeholderIconUrl
}

export function championName(data: GameData, championId: number, fallbackName?: string): string {
  return data.champions[championId]?.name ?? fallbackName ?? 'Unknown'
}

export function championSplashUrl(data: GameData, championId: number, skinNumber = 0): string | null {
  const champion = data.champions[championId]
  return champion ? `${cdnBase}/cdn/img/champion/splash/${champion.id}_${skinNumber}.jpg` : null
}

export function itemIconUrl(data: GameData, itemId: number): string | null {
  if (!itemId) return null
  return `${cdnBase}/cdn/${data.version}/img/item/${itemId}.png`
}

export function itemName(data: GameData, itemId: number): string {
  return data.items[itemId]?.name ?? `Item ${itemId}`
}

export function spellIconUrl(data: GameData, spellId: number): string | null {
  const spell = data.spells[spellId]
  return spell ? `${cdnBase}/cdn/${data.version}/img/spell/${spell.image}` : null
}

export function spellName(data: GameData, spellId: number): string {
  return data.spells[spellId]?.name ?? 'Summoner spell'
}

export function runeIconUrl(data: GameData, runeId: number | null): string | null {
  if (!runeId) return null
  const rune = data.runes[runeId]
  return rune ? `${cdnBase}/cdn/img/${rune.image}` : null
}

export function runeName(data: GameData, runeId: number | null): string {
  return (runeId && data.runes[runeId]?.name) || 'Rune'
}

export function profileIconUrl(data: GameData, iconId: number): string {
  return `${cdnBase}/cdn/${data.version}/img/profileicon/${iconId}.png`
}

// 1x1 transparent GIF used when an image cannot be resolved.
export const placeholderIconUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
