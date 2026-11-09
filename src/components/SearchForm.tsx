'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, useId, useState, useSyncExternalStore } from 'react'
import { defaultRegionSlug, getRegionBySlug, regions } from '@/lib/riot/regions'
import { parseRiotIdInput, summonerPath } from '@/lib/riot/riotId'

const regionStorageKey = 'hextech:region'

// The last region a visitor searched in, so they do not have to pick it every time.
function readSavedRegion(): string {
  try {
    const saved = window.localStorage.getItem(regionStorageKey)
    return saved && getRegionBySlug(saved) ? saved : defaultRegionSlug
  } catch {
    return defaultRegionSlug
  }
}

function saveRegion(slug: string) {
  try {
    window.localStorage.setItem(regionStorageKey, slug)
  } catch {
    // Storage can be unavailable (private mode); the search still works.
  }
}

const noopSubscribe = () => () => {}

interface SearchFormProps {
  variant?: 'hero' | 'compact'
}

export function SearchForm({ variant = 'hero' }: SearchFormProps) {
  const router = useRouter()
  const inputId = useId()
  const errorId = useId()
  const savedRegion = useSyncExternalStore(noopSubscribe, readSavedRegion, () => defaultRegionSlug)

  const [chosenRegion, setChosenRegion] = useState<string | null>(null)
  const [riotIdInput, setRiotIdInput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const region = chosenRegion ?? savedRegion
  const isHero = variant === 'hero'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const riotId = parseRiotIdInput(riotIdInput)
    if (!riotId) {
      setError('Enter a Riot ID with its tag, like Faker#KR1.')
      return
    }
    setError(null)
    saveRegion(region)
    router.push(summonerPath(region, riotId))
  }

  return (
    <form onSubmit={handleSubmit} role="search" noValidate>
      <div
        className={
          isHero
            ? 'flex items-stretch border-2 border-line-strong bg-surface transition-shadow focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--color-accent-soft)]'
            : 'flex items-stretch border border-line bg-surface focus-within:border-accent'
        }
      >
        <label htmlFor={`${inputId}-region`} className="sr-only">
          Region
        </label>
        <select
          id={`${inputId}-region`}
          value={region}
          onChange={(event) => setChosenRegion(event.target.value)}
          className={`cursor-pointer border-r border-line bg-transparent font-semibold text-accent outline-none focus-visible:outline-offset-[-2px] ${
            isHero ? 'px-4 text-base' : 'px-2 text-sm'
          }`}
        >
          {regions.map((option) => (
            <option key={option.slug} value={option.slug} className="bg-surface text-text">
              {option.shortLabel}
            </option>
          ))}
        </select>

        <label htmlFor={inputId} className="sr-only">
          Riot ID
        </label>
        <input
          id={inputId}
          type="text"
          value={riotIdInput}
          onChange={(event) => {
            setRiotIdInput(event.target.value)
            if (error) setError(null)
          }}
          placeholder={isHero ? 'Riot ID, like Faker#KR1' : 'Search Riot ID'}
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted outline-none ${
            isHero ? 'px-4 py-4 text-lg' : 'px-3 py-1.5 text-sm'
          }`}
        />

        <button
          type="submit"
          className={`font-semibold text-canvas transition-colors bg-accent hover:bg-ink ${
            isHero ? 'px-6 text-base' : 'px-3 text-sm'
          }`}
        >
          Search
        </button>
      </div>

      {error && (
        <p id={errorId} role="alert" className={`mt-2 text-loss ${isHero ? 'text-sm' : 'text-xs'}`}>
          {error}
        </p>
      )}
    </form>
  )
}
