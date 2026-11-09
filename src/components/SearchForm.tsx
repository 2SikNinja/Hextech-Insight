'use client'

import { useRouter } from 'next/navigation'
import { type FormEvent, type KeyboardEvent, useEffect, useId, useState, useSyncExternalStore } from 'react'
import type { Suggestion } from '@/app/suggest/route'
import { defaultRegionSlug, getRegionBySlug, regions } from '@/lib/riot/regions'
import { parseRiotIdInput, summonerPath } from '@/lib/riot/riotId'

const regionStorageKey = 'hextech:region'
const minNameLength = 3
const debounceMs = 200

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

/** Text before the "#", which must be at least 3 characters to search. */
function namePart(input: string): string {
  const hashIndex = input.indexOf('#')
  return (hashIndex >= 0 ? input.slice(0, hashIndex) : input).trim()
}

interface SearchFormProps {
  variant?: 'hero' | 'compact'
}

export function SearchForm({ variant = 'hero' }: SearchFormProps) {
  const router = useRouter()
  const inputId = useId()
  const errorId = useId()
  const listboxId = useId()
  const savedRegion = useSyncExternalStore(noopSubscribe, readSavedRegion, () => defaultRegionSlug)

  const [chosenRegion, setChosenRegion] = useState<string | null>(null)
  const [riotIdInput, setRiotIdInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [results, setResults] = useState<{ key: string; suggestions: Suggestion[] } | null>(null)

  const region = chosenRegion ?? savedRegion
  const isHero = variant === 'hero'
  const query = riotIdInput.trim()
  const queryKey = `${region}|${query.toLowerCase()}`
  const canSuggest = namePart(query).length >= minNameLength

  // Look up suggestions once typing pauses. Results are kept per query, so
  // stale responses for an older query are never shown.
  useEffect(() => {
    if (!canSuggest) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/suggest?region=${encodeURIComponent(region)}&q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : { suggestions: [] }))
        .then((body: { suggestions: Suggestion[] }) => setResults({ key: queryKey, suggestions: body.suggestions }))
        .catch(() => {
          // Suggestions are optional; typing the full Riot ID still works.
        })
    }, debounceMs)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [canSuggest, query, queryKey, region])

  const suggestions = canSuggest && results?.key === queryKey ? results.suggestions : []
  const showList = isOpen && suggestions.length > 0
  const activeSuggestion = showList && activeIndex >= 0 ? suggestions[activeIndex] : null

  function goTo(suggestion: Suggestion) {
    saveRegion(region)
    setIsOpen(false)
    setRiotIdInput('')
    router.push(summonerPath(region, { gameName: suggestion.gameName, tagLine: suggestion.tagLine }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (activeSuggestion) {
      goTo(activeSuggestion)
      return
    }
    const riotId = parseRiotIdInput(riotIdInput)
    if (!riotId) {
      // A single match for the typed name is almost certainly the one they want.
      if (suggestions.length === 1) {
        goTo(suggestions[0])
        return
      }
      setError(
        suggestions.length > 1
          ? 'Pick a player from the list, or add the tag after #.'
          : 'Enter a Riot ID with its tag, like Faker#KR1.',
      )
      setIsOpen(true)
      return
    }
    setError(null)
    saveRegion(region)
    setIsOpen(false)
    router.push(summonerPath(region, riotId))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && suggestions.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (index + 1) % suggestions.length)
    } else if (event.key === 'ArrowUp' && suggestions.length > 0) {
      event.preventDefault()
      setIsOpen(true)
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1))
    } else if (event.key === 'Escape') {
      setIsOpen(false)
      setActiveIndex(-1)
    }
  }

  const regionLabel = getRegionBySlug(region)?.shortLabel ?? region.toUpperCase()

  return (
    <form onSubmit={handleSubmit} role="search" noValidate className="relative">
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
          onChange={(event) => {
            setChosenRegion(event.target.value)
            setActiveIndex(-1)
          }}
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
          role="combobox"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeSuggestion ? `${listboxId}-${activeIndex}` : undefined}
          value={riotIdInput}
          onChange={(event) => {
            setRiotIdInput(event.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
            if (error) setError(null)
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
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

      <ul
        id={listboxId}
        role="listbox"
        aria-label={`Players on ${regionLabel}`}
        hidden={!showList}
        className="absolute inset-x-0 top-full z-30 mt-1 border border-line-strong bg-surface py-1 shadow-xl"
      >
        {suggestions.map((suggestion, index) => (
          <li
            key={`${suggestion.gameName}#${suggestion.tagLine}`}
            id={`${listboxId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // mousedown fires before the input's blur, so the click is not lost.
            onMouseDown={(event) => {
              event.preventDefault()
              goTo(suggestion)
            }}
            onMouseEnter={() => setActiveIndex(index)}
            className={`flex cursor-pointer items-center gap-3 px-3 ${isHero ? 'py-2' : 'py-1.5 text-sm'} ${
              index === activeIndex ? 'bg-accent/15' : ''
            }`}
          >
            {suggestion.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- small CDN icon in a dropdown
              <img src={suggestion.iconUrl} alt="" width={28} height={28} className="size-7 shrink-0 rounded-[3px] bg-canvas" />
            ) : (
              <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-[3px] bg-surface-muted text-xs font-semibold text-muted">
                {suggestion.gameName.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate">
              <span className="text-ink">{suggestion.gameName}</span>
              <span className="ml-1 text-muted">#{suggestion.tagLine}</span>
            </span>
            <span className="shrink-0 text-xs text-muted">{regionLabel}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p id={errorId} role="alert" className={`mt-2 text-loss ${isHero ? 'text-sm' : 'text-xs'}`}>
          {error}
        </p>
      )}
    </form>
  )
}
