import type { NextRequest } from 'next/server'
import { getDb } from '@/lib/db'
import { getGameData, profileIconUrl } from '@/lib/ddragon'
import { getRegionBySlug } from '@/lib/riot/regions'

// Search bar suggestions: players whose Riot ID starts with what was typed.
// Riot's API has no name search, so this only reads players the site already
// knows (looked up directly or seen in a stored match). It never calls Riot.

export interface Suggestion {
  gameName: string
  tagLine: string
  iconUrl: string | null
  hasProfile: boolean
}

const minNameLength = 3
const maxQueryLength = 40
const maxResults = 5

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const region = getRegionBySlug(searchParams.get('region') ?? '')
  const query = (searchParams.get('q') ?? '').trim().slice(0, maxQueryLength)

  // "Name#TA" searches by name and the start of the tag.
  const hashIndex = query.indexOf('#')
  const name = (hashIndex >= 0 ? query.slice(0, hashIndex) : query).trim()
  const tag = hashIndex >= 0 ? query.slice(hashIndex + 1).trim() : ''

  if (!region || name.length < minNameLength) {
    return Response.json({ suggestions: [] satisfies Suggestion[] })
  }

  try {
    const { data, error } = await getDb().rpc('search_players', {
      p_platform: region.platform,
      p_name: name,
      p_tag: tag,
      p_limit: maxResults,
    })
    if (error) throw new Error(error.message)

    const rows = (data ?? []) as { game_name: string; tag_line: string; profile_icon_id: number | null; has_profile: boolean }[]
    const gameData = rows.some((row) => row.profile_icon_id !== null) ? await getGameData() : null

    const suggestions: Suggestion[] = rows.map((row) => ({
      gameName: row.game_name,
      tagLine: row.tag_line,
      iconUrl: gameData && row.profile_icon_id !== null ? profileIconUrl(gameData, row.profile_icon_id) : null,
      hasProfile: row.has_profile,
    }))

    return Response.json(
      { suggestions },
      // Short CDN cache: identical keystrokes from many visitors cost one query.
      { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } },
    )
  } catch (error) {
    console.error('Suggestion search failed', error)
    return Response.json({ suggestions: [] satisfies Suggestion[] }, { status: 503 })
  }
}
