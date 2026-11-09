'use client'

import { useActionState } from 'react'
import { type RefreshState, refreshSummonerAction } from '@/app/summoner/actions'

const initialState: RefreshState = { status: 'idle', message: '' }

export function RefreshButton({ puuid }: { puuid: string }) {
  const [state, formAction, isPending] = useActionState(refreshSummonerAction, initialState)

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <input type="hidden" name="puuid" value={puuid} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 bg-accent px-3 py-1.5 text-sm font-semibold text-canvas transition-colors hover:bg-ink disabled:cursor-wait disabled:opacity-70"
      >
        <svg
          aria-hidden
          viewBox="0 0 20 20"
          className={`size-4 ${isPending ? 'animate-spin' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M16.5 10a6.5 6.5 0 1 1-1.9-4.6M16.5 3.5v3.8h-3.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {isPending ? 'Updating' : 'Update'}
      </button>
      <p aria-live="polite" className={`text-sm ${state.status === 'error' ? 'text-loss' : 'text-muted'}`}>
        {state.message}
      </p>
    </form>
  )
}
