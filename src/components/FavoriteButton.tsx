'use client'

import { type Favorite, addFavorite, favoriteKey, removeFavorite, useFavorites } from '@/lib/favorites'

type FavoriteButtonProps = Omit<Favorite, 'savedAt'>

export function FavoriteButton(props: FavoriteButtonProps) {
  const favorites = useFavorites()
  const key = favoriteKey(props)
  const isSaved = favorites.some((favorite) => favoriteKey(favorite) === key)

  function toggle() {
    if (isSaved) removeFavorite(key)
    else addFavorite({ ...props, savedAt: new Date().toISOString() })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={isSaved}
      className={`inline-flex items-center gap-2 border px-3 py-1.5 text-sm font-semibold transition-colors ${
        isSaved
          ? 'border-accent bg-accent/10 text-accent hover:bg-accent/20'
          : 'border-line-strong text-text hover:border-accent hover:text-accent'
      }`}
    >
      <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={1.5}>
        <path d="M10 2.5l2.3 4.7 5.2.8-3.75 3.6.9 5.2L10 14.3l-4.65 2.5.9-5.2L2.5 8l5.2-.8L10 2.5z" strokeLinejoin="round" />
      </svg>
      {isSaved ? 'Saved' : 'Save'}
    </button>
  )
}
