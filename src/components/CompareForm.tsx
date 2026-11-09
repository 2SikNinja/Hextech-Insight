'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useId, useState } from 'react'
import { defaultRegionSlug, regions } from '@/lib/riot/regions'
import { parseRiotIdInput, toRiotIdSlug } from '@/lib/riot/riotId'

export interface ComparePlayerInput {
  regionSlug: string
  riotIdText: string
}

interface CompareFormProps {
  initial: [ComparePlayerInput | null, ComparePlayerInput | null]
}

export function CompareForm({ initial }: CompareFormProps) {
  const router = useRouter()
  const formId = useId()
  const [players, setPlayers] = useState<ComparePlayerInput[]>(
    initial.map((player) => player ?? { regionSlug: defaultRegionSlug, riotIdText: '' }),
  )
  const [error, setError] = useState<string | null>(null)

  function update(index: number, changes: Partial<ComparePlayerInput>) {
    setPlayers((current) => current.map((player, position) => (position === index ? { ...player, ...changes } : player)))
    setError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = players.map((player) => parseRiotIdInput(player.riotIdText))
    if (parsed.some((riotId) => !riotId)) {
      setError('Enter both Riot IDs with their tags, like Faker#KR1.')
      return
    }
    const [first, second] = parsed.map((riotId, index) => `${players[index].regionSlug}/${toRiotIdSlug(riotId!)}`)
    router.push(`/compare?a=${first}&b=${second}`)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="border border-line bg-surface p-4">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        {players.map((player, index) => (
          <div key={index}>
            <label htmlFor={`${formId}-${index}`} className="mb-1 block text-sm text-muted">
              Player {index + 1}
            </label>
            <div className="flex border border-line-strong bg-canvas focus-within:border-accent">
              <select
                aria-label={`Player ${index + 1} region`}
                value={player.regionSlug}
                onChange={(event) => update(index, { regionSlug: event.target.value })}
                className="border-r border-line bg-transparent px-2 text-sm font-semibold text-accent outline-none"
              >
                {regions.map((region) => (
                  <option key={region.slug} value={region.slug} className="bg-surface text-text">
                    {region.shortLabel}
                  </option>
                ))}
              </select>
              <input
                id={`${formId}-${index}`}
                type="text"
                value={player.riotIdText}
                onChange={(event) => update(index, { riotIdText: event.target.value })}
                placeholder="Name#TAG"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent px-3 py-2 text-ink placeholder:text-muted outline-none"
              />
            </div>
          </div>
        ))}
        <button type="submit" className="bg-accent px-5 py-2 font-semibold text-canvas transition-colors hover:bg-ink">
          Compare
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-loss">
          {error}
        </p>
      )}
    </form>
  )
}
