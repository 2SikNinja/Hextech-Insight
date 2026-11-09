'use client'

import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { type LiveGameState, type LiveTeam, checkLiveGameAction } from '@/app/summoner/actions'
import { GameImage } from '@/components/GameImage'
import { formatDuration } from '@/lib/format'

const initialState: LiveGameState = { status: 'idle' }

export function LiveGame({ puuid }: { puuid: string }) {
  const [state, formAction, isPending] = useActionState(checkLiveGameAction, initialState)

  return (
    <section aria-labelledby="live-heading" className="border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="live-heading" className="font-semibold text-ink">
          Live game
        </h2>
        <form action={formAction}>
          <input type="hidden" name="puuid" value={puuid} />
          <button
            type="submit"
            disabled={isPending}
            className="border border-line-strong px-3 py-1 text-sm font-semibold text-text transition-colors hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-70"
          >
            {isPending ? 'Checking' : state.status === 'idle' ? 'Check' : 'Check again'}
          </button>
        </form>
      </header>

      <div className="px-4 py-3 text-sm" aria-live="polite">
        {state.status === 'idle' && <p className="text-muted">See whether this player is in a game right now.</p>}
        {state.status === 'not_in_game' && <p className="text-muted">Not in a game right now.</p>}
        {state.status === 'error' && <p className="text-loss">{state.message}</p>}
        {state.status === 'in_game' && <LiveGameDetails queueName={state.queueName} startedAt={state.startedAt} teams={state.teams} />}
      </div>
    </section>
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
