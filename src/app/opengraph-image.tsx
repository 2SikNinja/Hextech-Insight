import { ImageResponse } from 'next/og'
import { OgFrame, loadOgFonts, ogColors, ogContentType, ogSize } from '@/lib/ogImage'

export const alt = 'Hextech Insight: League of Legends match history and stats'
export const size = ogSize
export const contentType = ogContentType

export default async function Image() {
  return new ImageResponse(
    (
      <OgFrame>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05 }}>Every match, read closely</div>
          <div style={{ fontSize: 36, fontWeight: 500, color: ogColors.muted, maxWidth: 900 }}>
            Rank, match history, trends and early-game stats for any League of Legends player.
          </div>
        </div>
      </OgFrame>
    ),
    { ...size, fonts: await loadOgFonts() },
  )
}
