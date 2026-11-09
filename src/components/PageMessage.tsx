import type { ReactNode } from 'react'

interface PageMessageProps {
  title: string
  children: ReactNode
  tone?: 'neutral' | 'error'
}

/** Full-width message for empty, not-found and error states. */
export function PageMessage({ title, children, tone = 'neutral' }: PageMessageProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20">
      <h1 className={`font-display text-2xl ${tone === 'error' ? 'text-loss' : 'text-ink'}`}>
        {title}
      </h1>
      <div className="mt-4 space-y-3 text-muted">{children}</div>
    </div>
  )
}
