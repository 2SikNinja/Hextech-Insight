'use client'

import { type KeyboardEvent, type PointerEvent, useId, useMemo, useRef, useState } from 'react'
import { formatTier } from '@/lib/format'
import { apexBase, ladderLabel, ladderValue } from '@/lib/ladder'

// LP over time. Riot only reports the current rank, so the site records a
// point each time the profile is looked up or updated and the rank changed.

export interface RankPoint {
  queue: 'solo' | 'flex'
  tier: string
  division: string | null
  lp: number
  wins: number
  losses: number
  recordedAt: string
}

const width = 320
const height = 170
const margin = { top: 12, right: 12, bottom: 22, left: 64 }
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function rankText(point: RankPoint): string {
  return `${formatTier(point.tier, point.division)} ${point.lp} LP`
}

export function LpHistory({ points }: { points: RankPoint[] }) {
  const queues = (['solo', 'flex'] as const).filter((queue) => points.some((point) => point.queue === queue))
  const [queue, setQueue] = useState<'solo' | 'flex'>(queues[0] ?? 'solo')
  const series = points.filter((point) => point.queue === queue)

  return (
    <section aria-labelledby="lp-heading" className="border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="lp-heading" className="font-semibold text-ink">
          LP history
        </h2>
        {queues.length > 1 && (
          <div role="tablist" aria-label="Queue" className="flex gap-1 text-xs">
            {queues.map((candidate) => (
              <button
                key={candidate}
                type="button"
                role="tab"
                aria-selected={candidate === queue}
                onClick={() => setQueue(candidate)}
                className={`border px-2 py-0.5 ${
                  candidate === queue ? 'border-accent bg-accent/10 text-accent' : 'border-line text-muted hover:text-text'
                }`}
              >
                {candidate === 'solo' ? 'Solo/Duo' : 'Flex'}
              </button>
            ))}
          </div>
        )}
      </header>
      <div className="px-4 py-3">
        {series.length === 0 ? (
          <p className="text-sm text-muted">No ranked games recorded yet.</p>
        ) : series.length === 1 ? (
          <p className="text-sm text-muted">
            Tracking started {dateFormat.format(new Date(series[0].recordedAt))} at{' '}
            <span className="text-ink">{rankText(series[0])}</span>. The graph fills in each time this profile is updated after
            ranked games.
          </p>
        ) : (
          <LpChart key={queue} series={series} />
        )}
      </div>
    </section>
  )
}

function LpChart({ series }: { series: RankPoint[] }) {
  const titleId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const chart = useMemo(() => {
    const values = series.map((point) => ladderValue(point.tier, point.division, point.lp))
    const times = series.map((point) => new Date(point.recordedAt).getTime())
    const isApex = Math.min(...values) >= apexBase
    const step = isApex ? 100 : Math.max(...values) - Math.min(...values) > 500 ? 400 : 100
    const low = Math.floor((Math.min(...values) - 10) / step) * step
    const high = Math.max(Math.ceil((Math.max(...values) + 10) / step) * step, low + step)
    const plotWidth = width - margin.left - margin.right
    const plotHeight = height - margin.top - margin.bottom
    const start = times[0]
    const span = Math.max(times[times.length - 1] - start, 1)
    const x = (index: number) => margin.left + ((times[index] - start) / span) * plotWidth
    const y = (value: number) => margin.top + plotHeight - ((value - low) / (high - low)) * plotHeight
    const ticks = Array.from({ length: Math.round((high - low) / step) + 1 }, (_, index) => low + index * step)
    const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(value)}`).join(' ')
    return { values, x, y, ticks, path, isApex, plotHeight }
  }, [series])

  function indexFromPointer(event: PointerEvent<SVGSVGElement>): number {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return 0
    const svgX = ((event.clientX - bounds.left) / bounds.width) * width
    let nearest = 0
    series.forEach((_, index) => {
      if (Math.abs(chart.x(index) - svgX) < Math.abs(chart.x(nearest) - svgX)) nearest = index
    })
    return nearest
  }

  function handleKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowRight') setActiveIndex((index) => Math.min(series.length - 1, (index ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setActiveIndex((index) => Math.max(0, (index ?? series.length) - 1))
    else if (event.key === 'Escape') setActiveIndex(null)
    else return
    event.preventDefault()
  }

  const first = series[0]
  const last = series[series.length - 1]
  const active = activeIndex === null ? null : series[activeIndex]
  const net = chart.values[chart.values.length - 1] - chart.values[0]

  return (
    <figure className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full touch-none select-none outline-offset-4"
        role="img"
        aria-labelledby={titleId}
        tabIndex={0}
        onPointerMove={(event) => setActiveIndex(indexFromPointer(event))}
        onPointerDown={(event) => setActiveIndex(indexFromPointer(event))}
        onPointerLeave={() => setActiveIndex(null)}
        onKeyDown={handleKey}
        onBlur={() => setActiveIndex(null)}
      >
        <title id={titleId}>{`LP history from ${rankText(first)} to ${rankText(last)}.`}</title>

        {chart.ticks.map((tick) => (
          <g key={tick}>
            <line x1={margin.left} x2={width - margin.right} y1={chart.y(tick)} y2={chart.y(tick)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={margin.left - 6} y={chart.y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[10px]">
              {chart.isApex ? `${tick - apexBase} LP` : ladderLabel(tick)}
            </text>
          </g>
        ))}

        <text x={margin.left} y={height - 6} className="fill-muted text-[10px]">
          {dateFormat.format(new Date(first.recordedAt))}
        </text>
        <text x={width - margin.right} y={height - 6} textAnchor="end" className="fill-muted text-[10px]">
          {dateFormat.format(new Date(last.recordedAt))}
        </text>

        {active && (
          <line
            x1={chart.x(activeIndex!)}
            x2={chart.x(activeIndex!)}
            y1={margin.top}
            y2={margin.top + chart.plotHeight}
            stroke="var(--color-line-strong)"
            strokeWidth="1"
          />
        )}

        <path d={chart.path} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((point, index) => (
          <circle
            key={point.recordedAt}
            cx={chart.x(index)}
            cy={chart.y(chart.values[index])}
            r={index === activeIndex ? 5 : 4}
            fill="var(--color-accent)"
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        ))}
      </svg>

      {active && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 w-36 border border-line-strong bg-canvas px-2.5 py-1.5 text-xs shadow-lg"
          style={{
            // Sits beside the crosshair, on the side with more room, so it never covers the hovered point.
            left: `${(chart.x(activeIndex!) / width) * 100}%`,
            transform: chart.x(activeIndex!) > width / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)',
          }}
        >
          <p className="text-muted">{dateFormat.format(new Date(active.recordedAt))}</p>
          <p className="font-semibold text-ink">{rankText(active)}</p>
          <p className="tabular text-muted">
            {active.wins}W {active.losses}L
          </p>
        </div>
      )}

      <p className="tabular mt-1 text-sm text-muted">
        {series.length} updates since {dateFormat.format(new Date(first.recordedAt))}
        {net > 0 && <span className="ml-2 text-accent">+{net} LP climbed</span>}
      </p>

      <table className="sr-only">
        <caption>LP history</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Rank</th>
            <th>Record</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.recordedAt}>
              <td>{dateFormat.format(new Date(point.recordedAt))}</td>
              <td>{rankText(point)}</td>
              <td>
                {point.wins}W {point.losses}L
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
