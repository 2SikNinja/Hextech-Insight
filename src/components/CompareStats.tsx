'use client'

import { useEffect, useState } from 'react'
import { formatPercent } from '@/lib/format'

// Side-by-side stats for two players, from the Python stats service. Values are
// shown plainly with no winner highlighting, so the comparison never reads as
// ranking one player over another.

interface OverallStats {
  games: number
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
}

type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; overall: (OverallStats | null)[] }

const rows: { label: string; value: (stats: OverallStats) => string }[] = [
  { label: 'Games', value: (stats) => String(stats.games) },
  { label: 'Win rate', value: (stats) => formatPercent(stats.winRate) },
  { label: 'KDA', value: (stats) => (stats.kda === null ? 'Perfect' : stats.kda.toFixed(2)) },
  { label: 'Kills / deaths / assists', value: (stats) => `${stats.avgKills} / ${stats.avgDeaths} / ${stats.avgAssists}` },
  { label: 'Kill participation', value: (stats) => formatPercent(stats.killParticipation) },
  { label: 'CS per minute', value: (stats) => stats.csPerMin.toFixed(1) },
  { label: 'Damage per minute', value: (stats) => stats.damagePerMin.toLocaleString('en-US') },
  { label: 'Gold per minute', value: (stats) => stats.goldPerMin.toLocaleString('en-US') },
  { label: 'Vision per minute', value: (stats) => stats.visionPerMin.toFixed(2) },
]

export function CompareStats({ puuids, names }: { puuids: [string, string]; names: [string, string] }) {
  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    Promise.all(
      puuids.map((puuid) =>
        fetch(`/api/py/stats/${puuid}`, { signal: controller.signal }).then(async (response) => {
          if (!response.ok) throw new Error(`Stats service returned ${response.status}`)
          return ((await response.json()) as { overall: OverallStats | null }).overall
        }),
      ),
    )
      .then((overall) => setLoaded({ status: 'ready', overall }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error(error)
        setLoaded({ status: 'error' })
      })
    return () => controller.abort()
  }, [puuids])

  if (loaded.status === 'loading') return <div className="h-80 animate-pulse bg-surface" role="status" aria-label="Loading stats" />
  if (loaded.status === 'error') return <p className="border border-line bg-surface px-5 py-8 text-sm text-loss">Stats are unavailable right now.</p>

  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="tabular w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th scope="col" className="px-4 py-3 font-normal text-muted">
              Last 100 stored games
            </th>
            {names.map((name) => (
              <th key={name} scope="col" className="px-4 py-3 text-right font-semibold text-ink">
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-line/60 last:border-b-0">
              <th scope="row" className="px-4 py-2.5 text-left font-normal text-muted">
                {row.label}
              </th>
              {loaded.overall.map((stats, index) => (
                <td key={index} className="px-4 py-2.5 text-right text-text">
                  {stats ? row.value(stats) : '-'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
