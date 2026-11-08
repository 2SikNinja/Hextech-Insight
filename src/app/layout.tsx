import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import '@fontsource-variable/cinzel'
import '@fontsource/barlow/400.css'
import '@fontsource/barlow/500.css'
import '@fontsource/barlow/600.css'
import '@fontsource/barlow/700.css'
import './globals.css'
import { SearchForm } from '@/components/SearchForm'
import { getSiteUrl } from '@/lib/env'

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: 'Hextech Insight: League of Legends match history and stats',
    template: '%s | Hextech Insight',
  },
  description:
    'Look up any League of Legends player by Riot ID to see their rank, recent matches and champion stats.',
  openGraph: {
    siteName: 'Hextech Insight',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0a1428',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-panel focus:px-3 focus:py-2"
        >
          Skip to content
        </a>

        <header className="border-b border-line bg-abyss/95">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
            <Link href="/" className="font-display text-lg font-semibold tracking-wide text-parchment hover:text-gold">
              Hextech Insight
            </Link>
            <div className="order-3 w-full sm:order-none sm:w-auto sm:flex-1">
              <SearchForm variant="compact" />
            </div>
            <nav aria-label="Main" className="ml-auto flex gap-5 text-sm text-muted">
              <Link href="/favorites" className="hover:text-parchment">
                Favorites
              </Link>
              <Link href="/legal" className="hover:text-parchment">
                About
              </Link>
            </nav>
          </div>
        </header>

        <main id="main" className="flex-1">
          {children}
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto max-w-6xl px-4 py-6 text-xs leading-relaxed text-muted">
            <p className="max-w-3xl">
              Hextech Insight isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot
              Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all
              associated properties are trademarks or registered trademarks of Riot Games, Inc.
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
