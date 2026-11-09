import { formatPercent, formatTier } from '@/lib/format'
import type { SummonerRecord } from '@/lib/summoners'

const tierColors: Record<string, string> = {
  IRON: '#a39591',
  BRONZE: '#c08458',
  SILVER: '#b4c2cc',
  GOLD: '#e0b45a',
  PLATINUM: '#4fc4b2',
  EMERALD: '#3fcf80',
  DIAMOND: '#7d9ef5',
  MASTER: '#c27ae3',
  GRANDMASTER: '#f06b55',
  CHALLENGER: '#f4d27e',
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
  const color = tier ? tierColors[tier] ?? '#9b93a9' : undefined

  return (
    <div className="flex items-center gap-4 py-4">
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center border font-display text-lg"
        style={tier ? { borderColor: color, color } : undefined}
      >
        {tier ? tier.charAt(0) : '-'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-muted">{queueName}</p>
        <p className="text-lg font-semibold text-ink" style={color ? { color } : undefined}>
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
    <section aria-labelledby="rank-heading" className="border border-line bg-surface px-4">
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
