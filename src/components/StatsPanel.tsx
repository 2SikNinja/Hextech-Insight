'use client'

import { useEffect, useState } from 'react'
import { GameImage } from '@/components/GameImage'
import { formatPercent, positionLabels } from '@/lib/format'

// Player statistics computed by the Python analytics service (api/index.py).

interface Multikills {
  double: number
  triple: number
  quadra: number
  penta: number
}

interface OverallStats {
  games: number
  wins: number
  losses: number
  winRate: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  kda: number | null
  csPerMin: number
  goldPerMin: number
  damagePerMin: number
  visionPerMin: number
  killParticipation: number | null
  multikills: Multikills
}

interface ChampionStats {
  championId: number
  championName: string
  games: number
  wins: number
  winRate: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  kda: number | null
  csPerMin: number
}

interface RoleStats {
  position: string
  games: number
  wins: number
  winRate: number
  share: number
}

interface PlayerStats {
  sampleSize: number
  remakesExcluded: number
  overall: OverallStats | null
  champions: ChampionStats[]
  roles: RoleStats[]
  recentForm: boolean[]
  streak: { kind: 'win' | 'loss'; count: number } | null
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stats: PlayerStats }

interface StatsPanelProps {
  puuid: string
  queueIds: readonly number[]
  queueLabel: string
  championIcons: Record<string, string>
  championNames: Record<string, string>
}

function kdaText(kda: number | null): string {
  return kda === null ? 'Perfect' : kda.toFixed(2)
}

function winRateColor(winRate: number): string {
  if (winRate >= 0.6) return 'text-teal'
  if (winRate < 0.45) return 'text-loss'
  return 'text-text'
}

export function StatsPanel({ puuid, queueIds, queueLabel, championIcons, championNames }: StatsPanelProps) {
  const queryKey = `${puuid}?${queueIds.map((queueId) => `queue=${queueId}`).join('&')}`
  const [loaded, setLoaded] = useState<{ key: string; state: LoadState } | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    fetch(`/api/py/stats/${queryKey}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Stats service returned ${response.status}`)
        const stats = (await response.json()) as PlayerStats
        setLoaded({ key: queryKey, state: { status: 'ready', stats } })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error(error)
        setLoaded({ key: queryKey, state: { status: 'error', message: 'Stats are unavailable right now.' } })
      })

    return () => controller.abort()
  }, [queryKey])

  // A new filter shows the loading state until its own response arrives.
  const state: LoadState = loaded?.key === queryKey ? loaded.state : { status: 'loading' }

  return (
    <section aria-labelledby="stats-heading" className="border border-line bg-panel">
      <header className="border-b border-line px-4 py-3">
        <h2 id="stats-heading" className="font-semibold text-parchment">
          Performance
        </h2>
        <p className="text-sm text-muted">
          {state.status === 'ready'
            ? `${queueLabel} games, last ${state.stats.sampleSize} stored`
            : `${queueLabel} games`}
        </p>
      </header>

      {state.status === 'loading' && <StatsSkeleton />}
      {state.status === 'error' && <p className="px-4 py-6 text-sm text-loss">{state.message}</p>}
      {state.status === 'ready' && !state.stats.overall && (
        <p className="px-4 py-6 text-sm text-muted">No games in this queue yet. Pick another filter or press Update.</p>
      )}
      {state.status === 'ready' && state.stats.overall && (
        <StatsBody
          stats={state.stats}
          overall={state.stats.overall}
          championIcons={championIcons}
          championNames={championNames}
        />
      )}
    </section>
  )
}

function StatsBody({
  stats,
  overall,
  championIcons,
  championNames,
}: {
  stats: PlayerStats
  overall: OverallStats
  championIcons: Record<string, string>
  championNames: Record<string, string>
}) {
  return (
    <div className="divide-y divide-line">
      {/* Headline record and form */}
      <div className="px-4 py-4">
        <div className="flex items-baseline gap-3">
          <p className={`tabular text-3xl font-semibold ${winRateColor(overall.winRate)}`}>
            {formatPercent(overall.winRate)}
          </p>
          <p className="tabular text-sm text-muted">
            {overall.wins}W {overall.losses}L
          </p>
        </div>

        <ol className="mt-3 flex gap-1" aria-label="Recent results, newest first">
          {stats.recentForm.map((win, index) => (
            <li
              key={index}
              title={win ? 'Win' : 'Loss'}
              className={`h-2 flex-1 ${win ? 'bg-win' : 'bg-loss'}`}
            >
              <span className="sr-only">{win ? 'Win' : 'Loss'}</span>
            </li>
          ))}
        </ol>
        {stats.streak && stats.streak.count >= 2 && (
          <p className="mt-2 text-sm text-muted">
            On a {stats.streak.count} game {stats.streak.kind} streak
          </p>
        )}
      </div>

      {/* Averages */}
      <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-3 px-4 py-4 text-sm">
        <Stat label="KDA" value={`${kdaText(overall.kda)}`} detail={`${overall.avgKills} / ${overall.avgDeaths} / ${overall.avgAssists}`} />
        <Stat label="Kill participation" value={formatPercent(overall.killParticipation)} />
        <Stat label="CS per minute" value={overall.csPerMin.toFixed(1)} />
        <Stat label="Damage per minute" value={String(overall.damagePerMin)} />
        <Stat label="Gold per minute" value={String(overall.goldPerMin)} />
        <Stat label="Vision per minute" value={overall.visionPerMin.toFixed(2)} />
      </dl>

      {/* Champions */}
      {stats.champions.length > 0 && (
        <div className="px-4 py-4">
          <h3 className="mb-2 text-sm font-semibold text-parchment">Champions</h3>
          <table className="tabular w-full text-sm">
            <thead className="sr-only">
              <tr>
                <th>Champion</th>
                <th>Win rate</th>
                <th>KDA</th>
              </tr>
            </thead>
            <tbody>
              {stats.champions.map((champion) => {
                const name = championNames[champion.championId] ?? champion.championName
                return (
                  <tr key={champion.championId} className="border-t border-line/60 first:border-t-0">
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <GameImage src={championIcons[champion.championId] ?? null} alt={name} size={28} />
                        <span className="min-w-0">
                          <span className="block truncate text-text">{name}</span>
                          <span className="block text-xs text-muted">
                            {champion.games} {champion.games === 1 ? 'game' : 'games'}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={`py-1.5 text-right ${winRateColor(champion.winRate)}`}>
                      {formatPercent(champion.winRate)}
                    </td>
                    <td className="py-1.5 pl-3 text-right text-muted">{kdaText(champion.kda)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Roles */}
      {stats.roles.length > 0 && (
        <div className="px-4 py-4">
          <h3 className="mb-3 text-sm font-semibold text-parchment">Roles</h3>
          <ul className="flex flex-col gap-2.5 text-sm">
            {stats.roles.map((role) => (
              <li key={role.position}>
                <div className="tabular flex justify-between">
                  <span className="text-text">{positionLabels[role.position] ?? role.position}</span>
                  <span className="text-muted">
                    {role.games} played, <span className={winRateColor(role.winRate)}>{formatPercent(role.winRate)}</span> won
                  </span>
                </div>
                <div className="mt-1 h-1.5 bg-abyss" aria-hidden>
                  <div className="h-full bg-gold-dim" style={{ width: `${Math.max(4, role.share * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stats.remakesExcluded > 0 && (
        <p className="px-4 py-3 text-xs text-muted">
          {stats.remakesExcluded} {stats.remakesExcluded === 1 ? 'remake is' : 'remakes are'} left out of these numbers.
        </p>
      )}
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="text-base font-semibold text-parchment">
        {value}
        {detail && <span className="ml-2 text-sm font-normal text-muted">{detail}</span>}
      </dd>
    </div>
  )
}

function StatsSkeleton() {
  return (
    <div className="flex flex-col gap-3 px-4 py-5" aria-label="Loading stats" role="status">
      <div className="h-8 w-24 animate-pulse bg-panel-raised" />
      <div className="h-2 w-full animate-pulse bg-panel-raised" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-9 animate-pulse bg-panel-raised" />
        ))}
      </div>
    </div>
  )
}
