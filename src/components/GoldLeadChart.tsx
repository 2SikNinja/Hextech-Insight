'use client'

import { type KeyboardEvent, type PointerEvent, useId, useMemo, useRef, useState } from 'react'

// Team gold difference over the game. Diverging around zero: above the line is
// a blue side lead, below is a red side lead. Blue and red were checked with
// the dataviz palette validator on the panel surface; the area labels and the
// tooltip name the side, so the chart never relies on color alone.

export interface GoldPoint {
  minute: number
  lead: number
}

const width = 640
const height = 220
const margin = { top: 16, right: 16, bottom: 28, left: 52 }
const blue = 'var(--color-blue-side)'
const red = 'var(--color-red-side)'

function niceBound(value: number): number {
  if (value <= 0) return 1000
  const magnitude = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value / 2) ?? 10
  return Math.ceil(value / (step * magnitude)) * step * magnitude
}

function formatGold(value: number): string {
  const absolute = Math.abs(value)
  return absolute >= 1000 ? `${(absolute / 1000).toFixed(absolute >= 10_000 ? 0 : 1)}k` : String(absolute)
}

function describeLead(lead: number): string {
  if (lead === 0) return 'Even'
  return `${lead > 0 ? 'Blue' : 'Red'} side +${Math.abs(lead).toLocaleString('en-US')}`
}

export function GoldLeadChart({ points }: { points: GoldPoint[] }) {
  const titleId = useId()
  const clipAbove = useId()
  const clipBelow = useId()
  const svgRef = useRef<SVGSVGElement>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const chart = useMemo(() => {
    const bound = niceBound(Math.max(...points.map((point) => Math.abs(point.lead)), 1))
    const plotWidth = width - margin.left - margin.right
    const plotHeight = height - margin.top - margin.bottom
    const lastMinute = Math.max(points[points.length - 1]?.minute ?? 1, 1)
    const x = (minute: number) => margin.left + (minute / lastMinute) * plotWidth
    const y = (lead: number) => margin.top + plotHeight / 2 - (lead / bound) * (plotHeight / 2)
    const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.minute)},${y(point.lead)}`).join(' ')
    const area = `${line} L${x(points[points.length - 1].minute)},${y(0)} L${x(points[0].minute)},${y(0)} Z`
    const minuteTicks = Array.from({ length: Math.floor(lastMinute / 5) + 1 }, (_, index) => index * 5)
    return { bound, x, y, line, area, minuteTicks, zeroY: y(0), plotHeight }
  }, [points])

  if (points.length < 2) return null

  function indexFromPointer(event: PointerEvent<SVGSVGElement>): number {
    const bounds = svgRef.current?.getBoundingClientRect()
    if (!bounds) return 0
    const svgX = ((event.clientX - bounds.left) / bounds.width) * width
    let nearest = 0
    points.forEach((point, index) => {
      if (Math.abs(chart.x(point.minute) - svgX) < Math.abs(chart.x(points[nearest].minute) - svgX)) nearest = index
    })
    return nearest
  }

  function handleKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === 'ArrowRight') setActiveIndex((index) => Math.min(points.length - 1, (index ?? -1) + 1))
    else if (event.key === 'ArrowLeft') setActiveIndex((index) => Math.max(0, (index ?? points.length) - 1))
    else if (event.key === 'Escape') setActiveIndex(null)
    else return
    event.preventDefault()
  }

  const active = activeIndex === null ? null : points[activeIndex]
  const tooltipLeft = active ? (chart.x(active.minute) / width) * 100 : 0
  const final = points[points.length - 1]

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
        <title id={titleId}>{`Team gold difference by minute. At the end: ${describeLead(final.lead)}.`}</title>
        <defs>
          <clipPath id={clipAbove}>
            <rect x="0" y="0" width={width} height={chart.zeroY} />
          </clipPath>
          <clipPath id={clipBelow}>
            <rect x="0" y={chart.zeroY} width={width} height={height - chart.zeroY} />
          </clipPath>
        </defs>

        {/* Grid: the lead bound above and below, plus the zero line */}
        {[chart.bound, chart.bound / 2, -chart.bound / 2, -chart.bound].map((value) => (
          <g key={value}>
            <line x1={margin.left} x2={width - margin.right} y1={chart.y(value)} y2={chart.y(value)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={margin.left - 8} y={chart.y(value)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
              {formatGold(value)}
            </text>
          </g>
        ))}
        <line x1={margin.left} x2={width - margin.right} y1={chart.zeroY} y2={chart.zeroY} stroke="var(--color-line-strong)" strokeWidth="1" />
        <text x={margin.left - 8} y={chart.zeroY} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
          0
        </text>
        <text x={margin.left + 6} y={margin.top + 10} className="fill-muted text-[11px]">
          Blue side ahead
        </text>
        <text x={margin.left + 6} y={height - margin.bottom - 6} className="fill-muted text-[11px]">
          Red side ahead
        </text>

        {chart.minuteTicks.map((minute) => (
          <text key={minute} x={chart.x(minute)} y={height - 8} textAnchor="middle" className="fill-muted text-[11px]">
            {minute}
          </text>
        ))}

        {/* Lead area: blue above zero, red below */}
        <path d={chart.area} fill={blue} fillOpacity="0.18" clipPath={`url(#${clipAbove})`} />
        <path d={chart.area} fill={red} fillOpacity="0.18" clipPath={`url(#${clipBelow})`} />
        <path d={chart.line} fill="none" stroke={blue} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${clipAbove})`} />
        <path d={chart.line} fill="none" stroke={red} strokeWidth="2" strokeLinejoin="round" clipPath={`url(#${clipBelow})`} />

        {active && (
          <>
            <line
              x1={chart.x(active.minute)}
              x2={chart.x(active.minute)}
              y1={margin.top}
              y2={margin.top + chart.plotHeight}
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
            <circle
              cx={chart.x(active.minute)}
              cy={chart.y(active.lead)}
              r="4"
              fill={active.lead >= 0 ? blue : red}
              stroke="var(--color-surface)"
              strokeWidth="2"
            />
          </>
        )}
      </svg>
      <p className="mt-1 text-center text-xs text-muted">Minute</p>

      {active && (
        <div
          role="status"
          className="pointer-events-none absolute top-4 z-10 w-36 -translate-x-1/2 border border-line-strong bg-canvas px-3 py-2 text-xs shadow-lg"
          style={{ left: `clamp(4.5rem, ${tooltipLeft}%, calc(100% - 4.5rem))` }}
        >
          <p className="text-muted">Minute {active.minute}</p>
          <p className="tabular font-semibold text-ink">{describeLead(active.lead)}</p>
        </div>
      )}

      <table className="sr-only">
        <caption>Team gold difference by minute</caption>
        <thead>
          <tr>
            <th>Minute</th>
            <th>Lead</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.minute}>
              <td>{point.minute}</td>
              <td>{describeLead(point.lead)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
