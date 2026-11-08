import type { Metadata } from 'next'
import { FavoritesList } from '@/components/FavoritesList'

export const metadata: Metadata = {
  title: 'Favorites',
}

export default function FavoritesPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-semibold text-parchment">Favorites</h1>
      <p className="mt-2 text-muted">Players you saved on this device. They are stored in your browser, not an account.</p>
      <div className="mt-8">
        <FavoritesList />
      </div>
    </div>
  )
}
