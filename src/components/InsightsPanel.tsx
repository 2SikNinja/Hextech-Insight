'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { GameImage } from '@/components/GameImage'
import { type TrendDatum, TrendChart } from '@/components/TrendChart'
import { formatPercent } from '@/lib/format'
import { summonerPath } from '@/lib/riot/riotId'

// Deeper insights computed by the Python service (api/_insights.py). Numbers are
// shown neutrally to help players review their own games (Riot's policies do
// not allow shaming players), so nothing here is colored as "bad".

type MetricKey = 'kda' | 'csPerMin' | 'damagePerMin' | 'goldPerMin' | 'visionPerMin'

interface TrendPoint {
  matchId: string
  gameStart: string
  win: boolean
  championId: number
  championName: string
  kda: number
  csPerMin: number
  damagePerMin: number
  goldPerMin: number
  visionPerMin: number
  rolling: Record<MetricKey, number>
}

interface Bucket {
  label: string
  games: number
  wins: number
  winRate: number
}

interface Insights {
  sampleSize: number
  trends: TrendPoint[]
  changes: Partial<Record<MetricKey, { earlier: number; recent: number; change: number }>>
  laning: {
    games: number
    goldDiff10: number | null
    csDiff10: number | null
    xpDiff10: number | null
    goldDiff15: number | null
    csDiff15: number | null
    xpDiff15: number | null
    aheadAt15Share: number | null
    pendingGames: number
  }
  matchups: { championId: number; championName: string; games: number; wins: number; winRate: number; goldDiff15: number | null }[]
  patches: { patch: string; games: number; wins: number; winRate: number; kda: number | null }[]
  timeOfDay: Bucket[]
  sessionPosition: Bucket[]
  teammates: { puuid: string; gameName: string | null; tagLine: string | null; games: number; wins: number; winRate: number }[]
}

const metrics: { key: MetricKey; label: string; format: (value: number) => string }[] = [
  { key: 'kda', label: 'KDA', format: (value) => value.toFixed(2) },
  { key: 'csPerMin', label: 'CS per minute', format: (value) => value.toFixed(1) },
  { key: 'damagePerMin', label: 'Damage per minute', format: (value) => Math.round(value).toLocaleString('en-US') },
  { key: 'goldPerMin', label: 'Gold per minute', format: (value) => Math.round(value).toLocaleString('en-US') },
  { key: 'visionPerMin', label: 'Vision per minute', format: (value) => value.toFixed(2) },
]

interface InsightsPanelProps {
  puuid: string
  queueIds: readonly number[]
  queueLabel: string
  regionSlug: string
  championIcons: Record<string, string>
  championNames: Record<string, string>
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; insights: Insights }

function signed(value: number | null, digits = 0): string {
  if (value === null) return '-'
  const rounded = Number(value.toFixed(digits))
  return `${rounded > 0 ? '+' : ''}${rounded.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

export function InsightsPanel({ puuid, queueIds, queueLabel, regionSlug, championIcons, championNames }: InsightsPanelProps) {
  const queryKey = queueIds.map((queueId) => `queue=${queueId}`).join('&')
  const [loaded, setLoaded] = useState<{ key: string; state: LoadState } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const params = [queryKey, `tz=${encodeURIComponent(timeZone)}`].filter(Boolean).join('&')

    fetch(`/api/py/insights/${puuid}?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Insights service returned ${response.status}`)
        setLoaded({ key: queryKey, state: { status: 'ready', insights: (await response.json()) as Insights } })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error(error)
        setLoaded({ key: queryKey, state: { status: 'error' } })
      })

    return () => controller.abort()
  }, [puuid, queryKey])

  const state: LoadState = loaded?.key === queryKey ? loaded.state : { status: 'loading' }

  if (state.status === 'loading') {
    return (
      <div className="flex flex-col gap-4" role="status" aria-label="Loading insights">
        <div className="h-72 animate-pulse bg-surface" />
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-48 animate-pulse bg-surface" />
          <div className="h-48 animate-pulse bg-surface" />
        </div>
      </div>
    )
  }
  if (state.status === 'error') {
    return <p className="border border-line bg-surface px-5 py-8 text-sm text-loss">Insights are unavailable right now.</p>
  }

  const { insights } = state
  if (insights.sampleSize === 0) {
    return (
      <p className="border border-line bg-surface px-5 py-8 text-sm text-muted">
        No {queueLabel === 'All' ? '' : `${queueLabel} `}games stored yet. Pick another queue or press Update.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">
        Based on the last {insights.sampleSize} stored {queueLabel === 'All' ? '' : `${queueLabel} `}games.
      </p>
      <TrendsSection insights={insights} />
      <LaningSection laning={insights.laning} />
      <div className="grid gap-4 md:grid-cols-2">
        <MatchupsSection matchups={insights.matchups} championIcons={championIcons} championNames={championNames} />
        <PatchesSection patches={insights.patches} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <BucketsSection title="Time of day" subtitle="In your local time" buckets={insights.timeOfDay} />
        <BucketsSection
          title="Games into a session"
          subtitle="A new session starts after an hour-long break"
          buckets={insights.sessionPosition}
        />
      </div>
      <TeammatesSection teammates={insights.teammates} regionSlug={regionSlug} />
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h3 className="font-semibold text-ink">{title}</h3>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  )
}

function TrendsSection({ insights }: { insights: Insights }) {
  const [metricKey, setMetricKey] = useState<MetricKey>('kda')
  const metric = metrics.find((candidate) => candidate.key === metricKey) ?? metrics[0]
  const change = insights.changes[metricKey]

  const data: TrendDatum[] = insights.trends.map((point) => ({
    matchId: point.matchId,
    gameStart: point.gameStart,
    win: point.win,
    championName: point.championName,
    value: point[metricKey],
    average: point.rolling[metricKey],
  }))

  return (
    <Section title="Trends" subtitle="How each stat has moved across recent games">
      <div role="tablist" aria-label="Stat to chart" className="mb-4 flex flex-wrap gap-1 text-sm">
        {metrics.map((candidate) => (
          <button
            key={candidate.key}
            type="button"
            role="tab"
            aria-selected={candidate.key === metricKey}
            onClick={() => setMetricKey(candidate.key)}
            className={`border px-3 py-1 transition-colors ${
              candidate.key === metricKey
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-line text-muted hover:border-line-strong hover:text-text'
            }`}
          >
            {candidate.label}
          </button>
        ))}
      </div>

      <TrendChart data={data} metricLabel={metric.label} formatValue={metric.format} />

      {change && (
        <p className="tabular mt-3 text-sm text-muted">
          Earlier games averaged <span className="text-ink">{metric.format(change.earlier)}</span>, recent games{' '}
          <span className="text-ink">{metric.format(change.recent)}</span>
          {change.change > 0 && <span className="ml-1 text-accent">(up {metric.format(change.change)})</span>}
        </p>
      )}
    </Section>
  )
}

function LaningSection({ laning }: { laning: Insights['laning'] }) {
  const pendingNote =
    laning.pendingGames > 0
      ? `${laning.pendingGames} more ${laning.pendingGames === 1 ? 'game is' : 'games are'} still being analyzed. Check back in a minute.`
      : null

  return (
    <Section title="Early game" subtitle="Compared with your lane opponent on Summoner's Rift">
      {laning.games === 0 ? (
        <p className="text-sm text-muted">{pendingNote ?? 'No ranked or normal Summoner’s Rift games with a lane opponent yet.'}</p>
      ) : (
        <>
          <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <EarlyStat label="Gold at 15 min" value={signed(laning.goldDiff15)} detail={`${signed(laning.goldDiff10)} at 10`} />
            <EarlyStat label="CS at 15 min" value={signed(laning.csDiff15, 1)} detail={`${signed(laning.csDiff10, 1)} at 10`} />
            <EarlyStat label="XP at 15 min" value={signed(laning.xpDiff15)} detail={`${signed(laning.xpDiff10)} at 10`} />
            <EarlyStat
              label="Ahead in gold at 15"
              value={formatPercent(laning.aheadAt15Share)}
              detail={`of ${laning.games} ${laning.games === 1 ? 'game' : 'games'}`}
            />
          </dl>
          {pendingNote && <p className="mt-3 text-xs text-muted">{pendingNote}</p>}
        </>
      )}
    </Section>
  )
}

function EarlyStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-xl font-semibold text-ink">{value}</dd>
      <dd className="text-xs text-muted">{detail}</dd>
    </div>
  )
}

function MatchupsSection({
  matchups,
  championIcons,
  championNames,
}: {
  matchups: Insights['matchups']
  championIcons: Record<string, string>
  championNames: Record<string, string>
}) {
  return (
    <Section title="Lane matchups" subtitle="Your record against each opponent champion">
      {matchups.length === 0 ? (
        <p className="text-sm text-muted">No lane matchups yet.</p>
      ) : (
        <table className="tabular w-full text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="pb-2 font-normal">Opponent</th>
              <th className="pb-2 text-right font-normal">Record</th>
              <th className="pb-2 text-right font-normal">Gold at 15</th>
            </tr>
          </thead>
          <tbody>
            {matchups.map((matchup) => {
              const name = championNames[matchup.championId] ?? matchup.championName
              return (
                <tr key={matchup.championId} className="border-t border-line/60">
                  <td className="py-1.5">
                    <span className="flex items-center gap-2">
                      <GameImage src={championIcons[matchup.championId] ?? null} alt="" size={24} />
                      <span className="truncate text-text">{name}</span>
                    </span>
                  </td>
                  <td className="py-1.5 text-right text-text">
                    {matchup.wins}W {matchup.games - matchup.wins}L
                  </td>
                  <td className="py-1.5 text-right text-muted">{signed(matchup.goldDiff15)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Section>
  )
}

function PatchesSection({ patches }: { patches: Insights['patches'] }) {
  return (
    <Section title="By patch" subtitle="Results on each game version">
      <table className="tabular w-full text-sm">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="pb-2 font-normal">Patch</th>
            <th className="pb-2 text-right font-normal">Games</th>
            <th className="pb-2 text-right font-normal">Win rate</th>
            <th className="pb-2 text-right font-normal">KDA</th>
          </tr>
        </thead>
        <tbody>
          {patches.map((patch) => (
            <tr key={patch.patch} className="border-t border-line/60">
              <td className="py-1.5 text-text">{patch.patch}</td>
              <td className="py-1.5 text-right text-text">{patch.games}</td>
              <td className="py-1.5 text-right text-text">{formatPercent(patch.winRate)}</td>
              <td className="py-1.5 text-right text-muted">{patch.kda === null ? 'Perfect' : patch.kda.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

function BucketsSection({ title, subtitle, buckets }: { title: string; subtitle: string; buckets: Bucket[] }) {
  const total = buckets.reduce((sum, bucket) => sum + bucket.games, 0)
  return (
    <Section title={title} subtitle={subtitle}>
      <ul className="flex flex-col gap-3 text-sm">
        {buckets.map((bucket) => (
          <li key={bucket.label}>
            <div className="tabular flex justify-between gap-3">
              <span className="text-text">{bucket.label}</span>
              <span className="text-muted">
                {bucket.games} {bucket.games === 1 ? 'game' : 'games'}, {formatPercent(bucket.winRate)} won
              </span>
            </div>
            {/* Bar length shows how often you play then, not how well. */}
            <div className="mt-1 h-1.5 bg-canvas" aria-hidden>
              <div className="h-full rounded-r-sm bg-accent-soft" style={{ width: `${Math.max(3, (bucket.games / total) * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function TeammatesSection({ teammates, regionSlug }: { teammates: Insights['teammates']; regionSlug: string }) {
  return (
    <Section title="Played with" subtitle="Players on your team in two or more recent games">
      {teammates.length === 0 ? (
        <p className="text-sm text-muted">No repeat teammates in these games yet.</p>
      ) : (
        <ul className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {teammates.map((teammate) => (
            <li key={teammate.puuid} className="tabular flex items-baseline justify-between gap-3 border-b border-line/60 pb-2">
              {teammate.gameName && teammate.tagLine ? (
                <Link
                  href={summonerPath(regionSlug, { gameName: teammate.gameName, tagLine: teammate.tagLine })}
                  className="truncate text-ink hover:text-accent"
                >
                  {teammate.gameName}
                  <span className="ml-1 text-muted">#{teammate.tagLine}</span>
                </Link>
              ) : (
                <span className="truncate text-text">{teammate.gameName ?? 'Unknown player'}</span>
              )}
              <span className="shrink-0 text-muted">
                {teammate.games} games, {teammate.wins}W {teammate.games - teammate.wins}L
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}
