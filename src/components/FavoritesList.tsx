'use client'

import Link from 'next/link'
import { GameImage } from '@/components/GameImage'
import { favoriteKey, removeFavorite, useFavorites } from '@/lib/favorites'
import { summonerPath } from '@/lib/riot/riotId'

export function FavoritesList() {
  const favorites = useFavorites()

  if (favorites.length === 0) {
    return (
      <div className="border border-line bg-panel px-5 py-10 text-center">
        <p className="text-parchment">No saved players yet.</p>
        <p className="mt-2 text-sm text-muted">Search for a player and press Save on their page to keep them here.</p>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-line border border-line bg-panel">
      {favorites.map((favorite) => {
        const key = favoriteKey(favorite)
        const name = `${favorite.gameName}#${favorite.tagLine}`
        return (
          <li key={key} className="flex items-center gap-4 px-4 py-3">
            <GameImage src={favorite.iconUrl} alt="" size={44} />
            <div className="min-w-0 flex-1">
              <Link
                href={summonerPath(favorite.regionSlug, favorite)}
                className="block truncate font-semibold text-parchment hover:text-gold"
              >
                {favorite.gameName}
                <span className="ml-1 font-normal text-muted">#{favorite.tagLine}</span>
              </Link>
              <p className="text-sm text-muted">
                {favorite.regionLabel}
                <span className="ml-3">{favorite.rankLabel}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => removeFavorite(key)}
              aria-label={`Remove ${name} from favorites`}
              className="px-2 py-1 text-sm text-muted hover:text-loss"
            >
              Remove
            </button>
          </li>
        )
      })}
    </ul>
  )
}
