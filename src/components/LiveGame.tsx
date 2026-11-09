'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useRef, useState } from 'react'
import { type LiveGameState, type LiveTeam, checkLiveGameAction } from '@/app/summoner/actions'
import { GameImage } from '@/components/GameImage'
import { formatDuration } from '@/lib/format'

const initialState: LiveGameState = { status: 'idle' }

interface LiveGameButtonProps {
  puuid: string
  /** Result of the automatic check made when the profile loaded. */
  initialStatus: 'in_game' | 'not_in_game' | 'unknown'
}

/**
 * "Live game" button for the profile header. Shows a red dot when the player is
 * in a game; clicking opens the full live game (both teams, spells, runes).
 */
export function LiveGameButton({ puuid, initialStatus }: LiveGameButtonProps) {
  const [state, formAction, isPending] = useActionState(checkLiveGameAction, initialState)
  const [isOpen, setIsOpen] = useState(false)
  const panelId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  const inGame = state.status === 'in_game' || (state.status === 'idle' && initialStatus === 'in_game')

  function toggle() {
    const opening = !isOpen
    setIsOpen(opening)
    // Load the details the first time the panel opens.
    if (opening && state.status === 'idle') formRef.current?.requestSubmit()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={isOpen}
        aria-controls={panelId}
        className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm font-semibold transition-colors ${
          inGame ? 'border-loss/60 text-ink hover:border-loss' : 'border-line-strong text-text hover:border-accent hover:text-accent'
        }`}
      >
        {inGame && (
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-loss opacity-60" />
            <span className="relative inline-flex size-2.5 rounded-full bg-loss" />
          </span>
        )}
        Live game
        {inGame && <span className="sr-only">(in a game now)</span>}
      </button>

      <form ref={formRef} action={formAction} hidden>
        <input type="hidden" name="puuid" value={puuid} />
      </form>

      {isOpen && (
        <section
          id={panelId}
          aria-label="Live game"
          className="absolute left-0 top-full z-30 mt-2 w-[min(36rem,calc(100vw-2rem))] border border-line-strong bg-surface shadow-xl"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
            <h2 className="font-semibold text-ink">Live game</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => formRef.current?.requestSubmit()}
                disabled={isPending}
                className="px-2 py-1 text-sm text-muted hover:text-accent disabled:opacity-60"
              >
                {isPending ? 'Checking' : 'Refresh'}
              </button>
              <button type="button" onClick={() => setIsOpen(false)} className="px-2 py-1 text-sm text-muted hover:text-ink">
                Close
              </button>
            </div>
          </header>
          <div className="max-h-[70vh] overflow-y-auto px-4 py-3 text-sm" aria-live="polite">
            {(state.status === 'idle' || (isPending && state.status !== 'in_game')) && <p className="text-muted">Checking for a live game.</p>}
            {!isPending && state.status === 'not_in_game' && <p className="text-muted">Not in a game right now.</p>}
            {!isPending && state.status === 'error' && <p className="text-loss">{state.message}</p>}
            {state.status === 'in_game' && <LiveGameDetails queueName={state.queueName} startedAt={state.startedAt} teams={state.teams} />}
          </div>
        </section>
      )}
    </div>
  )
}

function useElapsedSeconds(startedAt: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])
  return Math.max(0, Math.floor((now - startedAt) / 1000))
}

function LiveGameDetails({ queueName, startedAt, teams }: { queueName: string; startedAt: number; teams: LiveTeam[] }) {
  const elapsed = useElapsedSeconds(startedAt)

  return (
    <div>
      <p className="flex items-center gap-2 font-semibold text-ink">
        <span aria-hidden className="size-2 animate-pulse rounded-full bg-win" />
        {queueName}
        <span className="tabular font-normal text-muted">{formatDuration(elapsed)}</span>
      </p>

      <div className="mt-3 flex flex-col gap-4">
        {teams.map((team) => (
          <div key={team.teamId}>
            <p className="mb-1.5 text-xs text-muted">
              {team.teamId === 100 ? 'Blue side' : team.teamId === 200 ? 'Red side' : `Team ${team.teamId}`}
            </p>
            <ul className="flex flex-col gap-1.5">
              {team.players.map((player) => (
                <li key={player.key} className={`flex items-center gap-2 ${player.isFocus ? 'bg-accent/10 -mx-2 px-2 py-0.5' : ''}`}>
                  <GameImage src={player.championIcon} alt={player.championName} size={28} />
                  <span className="flex flex-col gap-0.5">
                    {player.spells.map((spell, index) => (
                      <GameImage key={index} src={spell.icon} alt={spell.name} size={13} />
                    ))}
                  </span>
                  <GameImage src={player.keystone.icon} alt={player.keystone.name} size={18} rounded />
                  <span className="min-w-0 flex-1">
                    {player.href && !player.isFocus ? (
                      <Link href={player.href} className="block truncate text-text hover:text-accent">
                        {player.name}
                      </Link>
                    ) : (
                      <span className={`block truncate ${player.isFocus ? 'font-semibold text-ink' : 'text-text'}`}>{player.name}</span>
                    )}
                    <span className="block truncate text-xs text-muted">
                      {player.championName}
                      {player.rankLabel && <span className="ml-2">{player.rankLabel}</span>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {team.bans.length > 0 && (
              <div className="mt-1.5 flex items-center gap-1" aria-label="Bans">
                <span className="mr-1 text-xs text-muted">Bans</span>
                {team.bans.map((ban, index) => (
                  <GameImage key={index} src={ban.icon} alt={`Banned ${ban.name}`} size={18} className="opacity-60 grayscale" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
