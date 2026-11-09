'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useActionState, useEffect } from 'react'
import { type LoadMoreState, loadMoreGamesAction } from '@/app/summoner/actions'

const initialState: LoadMoreState = { status: 'idle', message: '', stored: 0 }
const pageSize = 20

export function LoadMoreButton({ puuid, shown }: { puuid: string; shown: number }) {
  const [state, formAction, isPending] = useActionState(loadMoreGamesAction, initialState)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // After older games are stored, show the next page of history.
  useEffect(() => {
    if (state.status !== 'loaded' || state.stored <= shown) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('show', String(Math.min(shown + pageSize, state.stored)))
    router.replace(`${pathname}?${params}`, { scroll: false })
  }, [state, shown, pathname, router, searchParams])

  return (
    <form action={formAction} className="mt-4 flex flex-col items-center gap-2">
      <input type="hidden" name="puuid" value={puuid} />
      <button
        type="submit"
        disabled={isPending}
        className="border border-line-strong px-4 py-2 text-sm font-semibold text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-70"
      >
        {isPending ? 'Loading older games' : 'Load older games'}
      </button>
      <p aria-live="polite" className={`text-sm ${state.status === 'error' ? 'text-loss' : 'text-muted'}`}>
        {state.message}
      </p>
    </form>
  )
}
