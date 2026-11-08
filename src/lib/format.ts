// Small display helpers shared by server and client components.

export function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export function formatKdaRatio(kills: number, deaths: number, assists: number): string {
  if (deaths === 0) return kills + assists === 0 ? '0.00' : 'Perfect'
  return ((kills + assists) / deaths).toFixed(2)
}

export function formatPercent(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return `${(value * 100).toFixed(digits)}%`
}

export function formatCompact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k`
  return String(value)
}

export function formatPerMinute(total: number, durationSeconds: number): string {
  if (durationSeconds <= 0) return '0.0'
  return (total / (durationSeconds / 60)).toFixed(1)
}

const relativeTimeFormat = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function formatTimeAgo(isoDate: string, now: number = Date.now()): string {
  const secondsAgo = Math.round((now - new Date(isoDate).getTime()) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unit, seconds] of units) {
    if (secondsAgo >= seconds) return relativeTimeFormat.format(-Math.floor(secondsAgo / seconds), unit)
  }
  return 'just now'
}

export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(isoDate))
}

/** "15.21.715.1234" -> "15.21" */
export function formatPatch(gameVersion: string): string {
  return gameVersion.split('.').slice(0, 2).join('.')
}

export function formatTier(tier: string | null, division: string | null): string {
  if (!tier) return 'Unranked'
  const name = tier.charAt(0) + tier.slice(1).toLowerCase()
  // Master and above have no divisions.
  return ['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier) ? name : `${name} ${division ?? ''}`.trim()
}

export const positionLabels: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungle',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
}
