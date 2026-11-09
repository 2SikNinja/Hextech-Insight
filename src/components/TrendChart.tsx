'use client'

import { type KeyboardEvent, type PointerEvent, useId, useMemo, useRef, useState } from 'react'

// One metric across recent games: each game as a small gray dot, and the
// rolling average as the accent line, which is the part worth reading.
// Colors were checked with the dataviz palette validator against the panel
// surface (dark mode): the dot gray and the violet are clearly separable for
// color-blind readers and both clear 3:1 contrast.

export interface TrendDatum {
  matchId: string
  gameStart: string
  win: boolean
  championName: string
  value: number
  average: number
}

interface TrendChartProps {
  data: TrendDatum[]
  metricLabel: string
  formatValue: (value: number) => string
}

const width = 640
const height = 220
const margin = { top: 16, right: 64, bottom: 28, left: 44 }
const dotColor = '#6b6478'
const lineColor = 'var(--color-accent)'

function niceMax(value: number): number {
  if (value <= 0) return 1
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value / 4) ?? 10
  return Math.ceil(value / (step * magnitude)) * step * magnitude
}

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

export function TrendChart({ data, metricLabel, formatValue }: TrendChartProps) {
  const titleId = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const chart = useMemo(() => {
    const maxValue = niceMax(Math.max(...data.map((datum) => Math.max(datum.value, datum.average))))
    const plotWidth = width - margin.left - margin.right
    const plotHeight = height - margin.top - margin.bottom
    const x = (index: number) => margin.left + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth)
    const y = (value: number) => margin.top + plotHeight - (value / maxValue) * plotHeight
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((fraction) => fraction * maxValue)
    const linePath = data.map((datum, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${y(datum.average)}`).join(' ')
    return { x, y, ticks, linePath, plotHeight }
  }, [data])

  if (data.length === 0) return null

  function indexFromPointer(event: PointerEvent<SVGSVGElement>): number {
    const svg = svgRef.current
    if (!svg) return 0
    const bounds = svg.getBoundingClientRect()
    const svgX = ((event.clientX - bounds.left) / bounds.width) * width
    let nearest = 0
    data.forEach((_, index) => {
      if (Math.abs(chart.x(index) - svgX) < Math.abs(chart.x(nearest) - svgX)) nearest = index
    })
    return nearest
  }

  function handleKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowRight') setActiveIndex((index) => Math.min(data.length - 1, (index ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setActiveIndex((index) => Math.max(0, (index ?? data.length) - 1))
    else if (event.key === 'Escape') setActiveIndex(null)
    else return
    event.preventDefault()
  }

  const active = activeIndex === null ? null : data[activeIndex]
  const last = data[data.length - 1]
  const tooltipLeft = activeIndex === null ? 0 : (chart.x(activeIndex) / width) * 100

  return (
    <figure className="relative">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <svg aria-hidden width="10" height="10">
            <circle cx="5" cy="5" r="4" fill={dotColor} />
          </svg>
          Each game
        </span>
        <span className="flex items-center gap-1.5">
          <svg aria-hidden width="16" height="10">
            <line x1="0" y1="5" x2="16" y2="5" stroke={lineColor} strokeWidth="2" strokeLinecap="round" />
          </svg>
          5-game average
        </span>
        <span className="ml-auto">Use arrow keys or hover to inspect a game</span>
      </figcaption>

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
        <title id={titleId}>
          {`${metricLabel} over the last ${data.length} games. Latest 5-game average ${formatValue(last.average)}.`}
        </title>

        {/* Recessive grid and y-axis labels */}
        {chart.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={chart.y(tick)}
              y2={chart.y(tick)}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text x={margin.left - 8} y={chart.y(tick)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
              {formatValue(tick)}
            </text>
          </g>
        ))}

        {/* x-axis: first and last game dates */}
        <text x={chart.x(0)} y={height - 8} textAnchor="start" className="fill-muted text-[11px]">
          {dateFormat.format(new Date(data[0].gameStart))}
        </text>
        {data.length > 1 && (
          <text x={chart.x(data.length - 1)} y={height - 8} textAnchor="end" className="fill-muted text-[11px]">
            {dateFormat.format(new Date(last.gameStart))}
          </text>
        )}

        {/* Crosshair */}
        {activeIndex !== null && (
          <line
            x1={chart.x(activeIndex)}
            x2={chart.x(activeIndex)}
            y1={margin.top}
            y2={margin.top + chart.plotHeight}
            stroke="var(--color-line-strong)"
            strokeWidth="1"
          />
        )}

        {/* Each game */}
        {data.map((datum, index) => (
          <circle
            key={datum.matchId}
            cx={chart.x(index)}
            cy={chart.y(datum.value)}
            r={index === activeIndex ? 5 : 4}
            fill={dotColor}
            stroke="var(--color-surface)"
            strokeWidth="2"
          />
        ))}

        {/* Rolling average */}
        <path d={chart.linePath} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle
          cx={chart.x(data.length - 1)}
          cy={chart.y(last.average)}
          r="4"
          fill={lineColor}
          stroke="var(--color-surface)"
          strokeWidth="2"
        />
        <text
          x={chart.x(data.length - 1) + 10}
          y={chart.y(last.average)}
          dy="0.32em"
          className="fill-ink text-[12px] font-semibold"
        >
          {formatValue(last.average)}
        </text>
      </svg>

      {active && (
        <div
          role="status"
          className="pointer-events-none absolute top-8 z-10 w-44 -translate-x-1/2 border border-line-strong bg-canvas px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(5.5rem, ${tooltipLeft}%, calc(100% - 5.5rem))` }}
        >
          <p className="font-semibold text-ink">
            {active.championName}
            <span className="ml-2 font-normal text-muted">{active.win ? 'Win' : 'Loss'}</span>
          </p>
          <p className="text-muted">{dateFormat.format(new Date(active.gameStart))}</p>
          <p className="tabular mt-1 text-text">
            {metricLabel}: <span className="font-semibold text-ink">{formatValue(active.value)}</span>
          </p>
          <p className="tabular text-text">
            5-game average: <span className="font-semibold text-ink">{formatValue(active.average)}</span>
          </p>
        </div>
      )}

      {/* The same numbers as a table, for screen readers. */}
      <table className="sr-only">
        <caption>{metricLabel} by game</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Champion</th>
            <th>Result</th>
            <th>{metricLabel}</th>
            <th>5-game average</th>
          </tr>
        </thead>
        <tbody>
          {data.map((datum) => (
            <tr key={datum.matchId}>
              <td>{dateFormat.format(new Date(datum.gameStart))}</td>
              <td>{datum.championName}</td>
              <td>{datum.win ? 'Win' : 'Loss'}</td>
              <td>{formatValue(datum.value)}</td>
              <td>{formatValue(datum.average)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
