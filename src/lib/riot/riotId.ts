// Riot IDs look like "GameName#TAG". In URLs we write them as "GameName-TAG".
// Tag lines are only letters and numbers, so the last "-" always separates the
// two parts, even when the game name itself contains a dash.

export interface RiotId {
  gameName: string
  tagLine: string
}

const maxGameNameLength = 16
const tagLinePattern = /^[\p{L}\p{N}]{2,5}$/u

export function isValidRiotId({ gameName, tagLine }: RiotId): boolean {
  const trimmedName = gameName.trim()
  return (
    trimmedName.length > 0 &&
    trimmedName.length <= maxGameNameLength &&
    !trimmedName.includes('#') &&
    tagLinePattern.test(tagLine.trim())
  )
}

/** Parses user input like "2SikNinja#2Sik". Returns null when it is not a valid Riot ID. */
export function parseRiotIdInput(input: string): RiotId | null {
  const hashIndex = input.lastIndexOf('#')
  if (hashIndex <= 0) return null

  const riotId = {
    gameName: input.slice(0, hashIndex).trim(),
    tagLine: input.slice(hashIndex + 1).trim(),
  }
  return isValidRiotId(riotId) ? riotId : null
}

/** Parses a decoded URL segment like "2SikNinja-2Sik". */
export function parseRiotIdSlug(slug: string): RiotId | null {
  const decodedSlug = safeDecode(slug)
  const dashIndex = decodedSlug.lastIndexOf('-')
  if (dashIndex <= 0) return null

  const riotId = {
    gameName: decodedSlug.slice(0, dashIndex).trim(),
    tagLine: decodedSlug.slice(dashIndex + 1).trim(),
  }
  return isValidRiotId(riotId) ? riotId : null
}

export function toRiotIdSlug({ gameName, tagLine }: RiotId): string {
  return encodeURIComponent(`${gameName}-${tagLine}`)
}

export function formatRiotId({ gameName, tagLine }: RiotId): string {
  return `${gameName}#${tagLine}`
}

export function summonerPath(regionSlug: string, riotId: RiotId): string {
  return `/summoner/${regionSlug}/${toRiotIdSlug(riotId)}`
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
