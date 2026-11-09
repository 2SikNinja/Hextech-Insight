import { ImageResponse } from 'next/og'
import { getGameData, profileIconUrl } from '@/lib/ddragon'
import { formatPercent, formatTier } from '@/lib/format'
import { OgFrame, loadOgFonts, ogColors, ogContentType, ogSize } from '@/lib/ogImage'
import { getRegionBySlug } from '@/lib/riot/regions'
import { formatRiotId, parseRiotIdSlug } from '@/lib/riot/riotId'
import { type SummonerRecord, findStoredSummoner } from '@/lib/summoners'

export const alt = 'League of Legends player profile on Hextech Insight'
export const size = ogSize
export const contentType = ogContentType

// Preview card for a shared player link. Reads only what is already stored, so
// generating it never calls the Riot API.
export default async function Image({ params }: { params: Promise<{ region: string; riotId: string }> }) {
  const { region: regionSlug, riotId: riotIdSlug } = await params
  const region = getRegionBySlug(regionSlug)
  const riotId = parseRiotIdSlug(riotIdSlug)

  let summoner: SummonerRecord | null = null
  let iconUrl: string | null = null
  if (region && riotId) {
    try {
      summoner = await findStoredSummoner(region, riotId)
      if (summoner) iconUrl = profileIconUrl(await getGameData(), summoner.profile_icon_id)
    } catch (error) {
      console.error('Preview image lookup failed', error)
    }
  }

  const name = summoner ? summoner.game_name : (riotId?.gameName ?? 'Player')
  const tag = summoner ? summoner.tag_line : (riotId?.tagLine ?? '')
  const soloGames = (summoner?.solo_wins ?? 0) + (summoner?.solo_losses ?? 0)

  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', alignItems: 'center', gap: 40 }}>
          {iconUrl ? (
            <img src={iconUrl} alt="" width={180} height={180} style={{ borderRadius: 12, border: `2px solid ${ogColors.line}` }} />
          ) : (
            <div style={{ width: 180, height: 180, borderRadius: 12, background: ogColors.surface }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 820 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', fontSize: 80, fontWeight: 700, lineHeight: 1.05 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              {tag && <span style={{ marginLeft: 12, fontSize: 52, fontWeight: 500, color: ogColors.muted }}>#{tag}</span>}
            </div>
            <div style={{ display: 'flex', gap: 28, fontSize: 34, fontWeight: 500, color: ogColors.muted }}>
              <span>{region?.label ?? ''}</span>
              {summoner && <span>Level {summoner.summoner_level}</span>}
            </div>
          </div>
        </div>

        {summoner ? (
          <div style={{ display: 'flex', gap: 64, fontSize: 30, color: ogColors.muted }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              Ranked Solo/Duo
              <span style={{ fontSize: 52, fontWeight: 700, color: ogColors.ink }}>
                {formatTier(summoner.solo_tier, summoner.solo_division)}
                {summoner.solo_tier ? ` ${summoner.solo_lp} LP` : ''}
              </span>
            </div>
            {soloGames > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                Win rate
                <span style={{ fontSize: 52, fontWeight: 700, color: ogColors.ink }}>
                  {formatPercent((summoner.solo_wins ?? 0) / soloGames)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 34, color: ogColors.muted }}>
            {riotId ? `Match history and stats for ${formatRiotId(riotId)}` : 'Match history and stats'}
          </div>
        )}
      </OgFrame>
    ),
    { ...size, fonts: await loadOgFonts() },
  )
}
