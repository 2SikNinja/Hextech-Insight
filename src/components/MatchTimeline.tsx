'use client'

import Link from 'next/link'
import { type ReactNode, useEffect, useState } from 'react'
import { GameImage } from '@/components/GameImage'
import { type GoldPoint, GoldLeadChart } from '@/components/GoldLeadChart'
import { skillKeys } from '@/lib/buildPath'
import { formatPercent } from '@/lib/format'

// Match deep dive: gold lead, key moments, and per-player build path, skill
// order and lane insights. Builds and skills come from the stored timeline
// (prepared on the server); the analytics come from the Python service.

export interface TimelineItem {
  itemId: number
  name: string
  icon: string | null
  kind: 'buy' | 'sell'
  count: number
}

export interface TimelinePlayer {
  participantId: number
  teamId: number
  name: string
  href: string | null
  championName: string
  championIcon: string
  isFocus: boolean
  trips: { time: string; items: TimelineItem[] }[]
  skills: string[]
}

interface PlayerInsight {
  participantId: number
  laneOpponentId: number | null
  goldDiff10: number | null
  csDiff10: number | null
  xpDiff10: number | null
  goldDiff15: number | null
  csDiff15: number | null
  xpDiff15: number | null
  damageShare: number
  goldShare: number
  killParticipation: number | null
  csPerMin: number
  deathsBefore15: number | null
}

interface MatchInsights {
  hasTimeline: boolean
  gold: GoldPoint[]
  goldSummary: {
    biggestBlueLead: { value: number; minute: number } | null
    biggestRedLead: { value: number; minute: number } | null
    leadChanges: number
    finalLead: number
  } | null
  moments: { seconds: number; kind: string; teamId: number; label: string }[]
  players: PlayerInsight[]
}

interface MatchTimelineProps {
  matchId: string
  players: TimelinePlayer[]
  timelineStatus: 'ready' | 'busy' | 'unavailable'
  retryAfterSeconds?: number
}

type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; insights: MatchInsights }

function signed(value: number | null): string {
  if (value === null) return '-'
  return `${value > 0 ? '+' : ''}${value.toLocaleString('en-US')}`
}

function sideName(teamId: number): string {
  return teamId === 100 ? 'Blue side' : teamId === 200 ? 'Red side' : `Team ${teamId}`
}

function formatSeconds(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

export function MatchTimeline({ matchId, players, timelineStatus, retryAfterSeconds }: MatchTimelineProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selectedId, setSelectedId] = useState(() => players.find((player) => player.isFocus)?.participantId ?? players[0]?.participantId)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/py/match/${matchId}/insights`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Match insights returned ${response.status}`)
        setState({ status: 'ready', insights: (await response.json()) as MatchInsights })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        console.error(error)
        setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [matchId])

  const insights = state.status === 'ready' ? state.insights : null
  const selected = players.find((player) => player.participantId === selectedId) ?? players[0]
  const selectedInsight = insights?.players.find((player) => player.participantId === selected?.participantId) ?? null
  const opponent = selectedInsight?.laneOpponentId
    ? players.find((player) => player.participantId === selectedInsight.laneOpponentId)
    : null
  const teamIds = [...new Set(players.map((player) => player.teamId))]

  return (
    <div className="flex flex-col gap-6">
      {timelineStatus !== 'ready' && (
        <p role="status" className="border-l-2 border-accent bg-surface px-4 py-3 text-sm text-text">
          {timelineStatus === 'busy'
            ? `The match timeline couldn't be loaded right now. Refresh in ${retryAfterSeconds ?? 60} seconds for build paths and the gold graph.`
            : 'Riot has no timeline for this match, so build paths and the gold graph are not available.'}
        </p>
      )}

      {insights && insights.gold.length > 1 && (
        <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <Panel title="Gold lead" subtitle="Team gold difference, minute by minute">
            <GoldLeadChart points={insights.gold} />
            {insights.goldSummary && (
              <p className="tabular mt-3 text-sm text-muted">
                {insights.goldSummary.biggestBlueLead && (
                  <span className="mr-4">
                    Biggest blue lead <span className="text-ink">{insights.goldSummary.biggestBlueLead.value.toLocaleString('en-US')}</span> at{' '}
                    {insights.goldSummary.biggestBlueLead.minute}m
                  </span>
                )}
                {insights.goldSummary.biggestRedLead && (
                  <span className="mr-4">
                    Biggest red lead <span className="text-ink">{insights.goldSummary.biggestRedLead.value.toLocaleString('en-US')}</span> at{' '}
                    {insights.goldSummary.biggestRedLead.minute}m
                  </span>
                )}
                <span>
                  Lead changed hands <span className="text-ink">{insights.goldSummary.leadChanges}</span>{' '}
                  {insights.goldSummary.leadChanges === 1 ? 'time' : 'times'}
                </span>
              </p>
            )}
          </Panel>

          <Panel title="Key moments">
            {insights.moments.length === 0 ? (
              <p className="text-sm text-muted">No objectives were taken.</p>
            ) : (
              <ol className="tabular max-h-80 overflow-y-auto text-sm">
                {insights.moments.map((moment, index) => (
                  <li key={index} className="flex items-center gap-3 border-b border-line/50 py-1.5 last:border-b-0">
                    <span className="w-11 shrink-0 text-muted">{formatSeconds(moment.seconds)}</span>
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: moment.teamId === 100 ? 'var(--color-blue-side)' : 'var(--color-red-side)' }}
                    />
                    <span className="min-w-0 flex-1 truncate text-text">{moment.label}</span>
                    <span className="shrink-0 text-xs text-muted">{moment.teamId === 100 ? 'Blue' : 'Red'}</span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}

      {selected && (
        <Panel title="Player details" subtitle="Pick a player to see their build, skill order and lane">
          <div role="tablist" aria-label="Players" className="mb-5 flex flex-col gap-2">
            {teamIds.map((teamId) => (
              <div key={teamId} className="flex flex-wrap items-center gap-1.5">
                <span className="w-16 text-xs text-muted">{sideName(teamId)}</span>
                {players
                  .filter((player) => player.teamId === teamId)
                  .map((player) => (
                    <button
                      key={player.participantId}
                      type="button"
                      role="tab"
                      aria-selected={player.participantId === selected.participantId}
                      aria-label={`${player.name} (${player.championName})`}
                      title={`${player.name} (${player.championName})`}
                      onClick={() => setSelectedId(player.participantId)}
                      className={`rounded-[4px] p-0.5 transition-colors ${
                        player.participantId === selected.participantId ? 'bg-accent' : 'bg-transparent hover:bg-line-strong'
                      }`}
                    >
                      <GameImage src={player.championIcon} alt="" size={36} />
                    </button>
                  ))}
              </div>
            ))}
          </div>

          <div role="tabpanel" className="flex flex-col gap-6">
            <div className="flex flex-wrap items-baseline gap-x-3">
              {selected.href ? (
                <Link href={selected.href} className="text-lg font-semibold text-ink hover:text-accent">
                  {selected.name}
                </Link>
              ) : (
                <span className="text-lg font-semibold text-ink">{selected.name}</span>
              )}
              <span className="text-muted">{selected.championName}</span>
            </div>

            {selectedInsight && (
              <dl className="tabular grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                <Stat
                  label="Gold vs lane at 15"
                  value={signed(selectedInsight.goldDiff15)}
                  detail={opponent ? `vs ${opponent.championName}, ${signed(selectedInsight.goldDiff10)} at 10` : 'No lane opponent'}
                />
                <Stat label="CS vs lane at 15" value={signed(selectedInsight.csDiff15)} detail={`${signed(selectedInsight.csDiff10)} at 10`} />
                <Stat label="XP vs lane at 15" value={signed(selectedInsight.xpDiff15)} detail={`${signed(selectedInsight.xpDiff10)} at 10`} />
                <Stat label="CS per minute" value={selectedInsight.csPerMin.toFixed(1)} detail={
                    selectedInsight.deathsBefore15 === null
                      ? 'Deaths before 15:00 unknown'
                      : `${selectedInsight.deathsBefore15} ${selectedInsight.deathsBefore15 === 1 ? 'death' : 'deaths'} before 15:00`
                  } />
                <Stat label="Team damage" value={formatPercent(selectedInsight.damageShare)} detail="share of champion damage" />
                <Stat label="Team gold" value={formatPercent(selectedInsight.goldShare)} detail="share of gold earned" />
                <Stat label="Kill participation" value={formatPercent(selectedInsight.killParticipation)} detail="kills and assists" />
              </dl>
            )}

            <section aria-label="Build path">
              <h4 className="mb-2 text-sm font-semibold text-ink">Build path</h4>
              {selected.trips.length === 0 ? (
                <p className="text-sm text-muted">{timelineStatus === 'ready' ? 'No purchases recorded.' : 'Available once the timeline loads.'}</p>
              ) : (
                <ol className="flex flex-wrap items-start gap-x-1 gap-y-3">
                  {selected.trips.map((trip, tripIndex) => (
                    <li key={tripIndex} className="flex items-start gap-1">
                      {tripIndex > 0 && (
                        <span aria-hidden className="mt-3 px-1 text-muted">
                          ›
                        </span>
                      )}
                      <div className="flex flex-col items-start gap-1">
                        <div className="flex gap-1">
                          {trip.items.map((item, itemIndex) => (
                            <span
                              key={itemIndex}
                              className="relative"
                              title={`${item.kind === 'sell' ? 'Sold ' : ''}${item.name}${item.count > 1 ? ` x${item.count}` : ''}`}
                            >
                              <GameImage
                                src={item.icon}
                                alt={`${item.kind === 'sell' ? 'Sold ' : ''}${item.name}`}
                                size={32}
                                className={item.kind === 'sell' ? 'opacity-40 grayscale' : ''}
                              />
                              {item.count > 1 && (
                                <span className="absolute -bottom-1 -right-1 bg-canvas px-0.5 text-[10px] text-ink ring-1 ring-line">
                                  {item.count}
                                </span>
                              )}
                              {item.kind === 'sell' && (
                                <span className="absolute inset-x-0 bottom-0 bg-canvas/85 text-center text-[9px] font-semibold text-loss">
                                  Sold
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                        <span className="tabular text-xs text-muted">{trip.time}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section aria-label="Skill order">
              <h4 className="mb-2 text-sm font-semibold text-ink">Skill order</h4>
              {selected.skills.length === 0 ? (
                <p className="text-sm text-muted">{timelineStatus === 'ready' ? 'No skill data.' : 'Available once the timeline loads.'}</p>
              ) : (
                <SkillGrid skills={selected.skills} />
              )}
            </section>
          </div>
        </Panel>
      )}

      {state.status === 'error' && <p className="text-sm text-loss">Match insights are unavailable right now.</p>}
    </div>
  )
}

function SkillGrid({ skills }: { skills: string[] }) {
  const levels = Math.min(18, skills.length)
  return (
    <div className="overflow-x-auto">
      <table className="tabular border-separate border-spacing-0.5 text-xs">
        <caption className="sr-only">Skill leveled at each champion level</caption>
        <thead>
          <tr>
            <th scope="col" className="sr-only">
              Skill
            </th>
            {Array.from({ length: levels }, (_, level) => (
              <th key={level} scope="col" className="w-6 pb-1 text-center font-normal text-muted">
                {level + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {skillKeys.map((key) => (
            <tr key={key}>
              <th scope="row" className="pr-2 text-left font-semibold text-text">
                {key}
              </th>
              {Array.from({ length: levels }, (_, level) => {
                const isThis = skills[level] === key
                return (
                  <td
                    key={level}
                    className={`h-6 w-6 text-center ${isThis ? (key === 'R' ? 'bg-accent text-canvas' : 'bg-accent-soft text-ink') : 'bg-canvas'}`}
                  >
                    {isThis ? key : ''}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
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

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-lg font-semibold text-ink">{value}</dd>
      <dd className="text-xs text-muted">{detail}</dd>
    </div>
  )
}
