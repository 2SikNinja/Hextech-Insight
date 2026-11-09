'use client'

import { useEffect } from 'react'
import { PageMessage } from '@/components/PageMessage'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <PageMessage title="Something went wrong" tone="error">
      <p>This page failed to load. It may be a temporary problem with Riot&apos;s servers.</p>
      <p>
        <button type="button" onClick={reset} className="font-semibold text-accent hover:text-ink">
          Try again
        </button>
      </p>
    </PageMessage>
  )
}
