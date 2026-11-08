import { formatPercent, formatTier } from '@/lib/format'
import type { SummonerRecord } from '@/lib/summoners'

// Tier colors follow the ranked emblems in the game.
const tierColors: Record<string, string> = {
  IRON: '#7c6f6a',
  BRONZE: '#a8714a',
  SILVER: '#9fb0bd',
  GOLD: '#d6a548',
  PLATINUM: '#3fb7a6',
  EMERALD: '#2fbf71',
  DIAMOND: '#6a8ff0',
  MASTER: '#b05fd6',
  GRANDMASTER: '#e0533f',
  CHALLENGER: '#f2c96b',
}

interface RankRowProps {
  queueName: string
  tier: string | null
  division: string | null
  lp: number | null
  wins: number | null
  losses: number | null
}

function RankRow({ queueName, tier, division, lp, wins, losses }: RankRowProps) {
  const games = (wins ?? 0) + (losses ?? 0)
  const color = tier ? tierColors[tier] ?? '#c8aa6e' : undefined

  return (
    <div className="flex items-center gap-4 py-4">
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center border font-display text-lg font-semibold"
        style={tier ? { borderColor: color, color } : undefined}
      >
        {tier ? tier.charAt(0) : '-'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{queueName}</p>
        <p className="text-lg font-semibold text-parchment" style={color ? { color } : undefined}>
          {formatTier(tier, division)}
        </p>
        {tier && (
          <p className="tabular text-sm text-muted">
            {lp} LP <span className="ml-2 text-text">{wins}W {losses}L</span>
            {games > 0 && <span className="ml-2">{formatPercent((wins ?? 0) / games)} win rate</span>}
          </p>
        )}
      </div>
    </div>
  )
}

export function RankPanel({ summoner }: { summoner: SummonerRecord }) {
  return (
    <section aria-labelledby="rank-heading" className="border border-line bg-panel px-4">
      <h2 id="rank-heading" className="sr-only">
        Rank
      </h2>
      <div className="divide-y divide-line">
        <RankRow
          queueName="Ranked Solo/Duo"
          tier={summoner.solo_tier}
          division={summoner.solo_division}
          lp={summoner.solo_lp}
          wins={summoner.solo_wins}
          losses={summoner.solo_losses}
        />
        <RankRow
          queueName="Ranked Flex"
          tier={summoner.flex_tier}
          division={summoner.flex_division}
          lp={summoner.flex_lp}
          wins={summoner.flex_wins}
          losses={summoner.flex_losses}
        />
      </div>
    </section>
  )
}
