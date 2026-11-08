import { describe, expect, it } from 'vitest'
import { getRegionBySlug, getRegionFromMatchId, isValidMatchId } from '@/lib/riot/regions'
import { formatRiotId, parseRiotIdInput, parseRiotIdSlug, toRiotIdSlug } from '@/lib/riot/riotId'
import { formatDuration, formatKdaRatio, formatTier } from '@/lib/format'

describe('Riot ID parsing', () => {
  it('parses search input', () => {
    expect(parseRiotIdInput('2SikNinja#2Sik')).toEqual({ gameName: '2SikNinja', tagLine: '2Sik' })
    expect(parseRiotIdInput('  Hide on bush #KR1 ')).toEqual({ gameName: 'Hide on bush', tagLine: 'KR1' })
  })

  it('rejects input without a tag', () => {
    expect(parseRiotIdInput('2SikNinja')).toBeNull()
    expect(parseRiotIdInput('#NA1')).toBeNull()
    expect(parseRiotIdInput('Name#')).toBeNull()
    expect(parseRiotIdInput('Name#TOOLONG')).toBeNull()
  })

  it('round-trips names that contain dashes and spaces through the URL slug', () => {
    const riotId = { gameName: 'Some-Name Here', tagLine: 'EUW' }
    const slug = toRiotIdSlug(riotId)
    expect(parseRiotIdSlug(slug)).toEqual(riotId)
    expect(formatRiotId(riotId)).toBe('Some-Name Here#EUW')
  })

  it('handles unicode names', () => {
    const riotId = { gameName: '페이커', tagLine: 'KR1' }
    expect(parseRiotIdSlug(toRiotIdSlug(riotId))).toEqual(riotId)
  })
})

describe('regions', () => {
  it('maps slugs to platforms and routes', () => {
    expect(getRegionBySlug('NA')).toMatchObject({ platform: 'na1', matchRoute: 'americas' })
    expect(getRegionBySlug('oce')).toMatchObject({ platform: 'oc1', matchRoute: 'sea', accountRoute: 'asia' })
    expect(getRegionBySlug('nowhere')).toBeNull()
  })

  it('reads the region from a match ID', () => {
    expect(getRegionFromMatchId('EUW1_7123456789')?.slug).toBe('euw')
    expect(isValidMatchId('NA1_5012345678')).toBe(true)
    expect(isValidMatchId('XX9_123')).toBe(false)
    expect(isValidMatchId('na1_5012345678')).toBe(false)
  })
})

describe('format helpers', () => {
  it('formats durations and KDA', () => {
    expect(formatDuration(1805)).toBe('30:05')
    expect(formatKdaRatio(5, 2, 7)).toBe('6.00')
    expect(formatKdaRatio(5, 0, 7)).toBe('Perfect')
  })

  it('formats tiers', () => {
    expect(formatTier('GOLD', 'II')).toBe('Gold II')
    expect(formatTier('CHALLENGER', 'I')).toBe('Challenger')
    expect(formatTier(null, null)).toBe('Unranked')
  })
})
