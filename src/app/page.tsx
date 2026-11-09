import Link from 'next/link'
import { SearchForm } from '@/components/SearchForm'

export default function HomePage() {
  return (
    <div>
      <section className="mx-auto max-w-3xl px-4 pb-20 pt-20 sm:pt-28">
        <h1 className="font-display text-4xl leading-tight text-ink sm:text-6xl">
          Every match, read closely
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted">
          Look up any League of Legends player to see their rank, last twenty games and how they play each champion.
        </p>

        <div className="mt-10">
          <SearchForm variant="hero" />
        </div>
        <p className="mt-3 text-sm text-muted">
          Riot IDs are the name and tag shown on your profile, such as{' '}
          <span className="text-ink">Faker#KR1</span>.
        </p>
      </section>

      <section className="border-t border-line">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
          <div>
            <h2 className="font-semibold text-ink">Rank and recent games</h2>
            <p className="mt-2 text-sm text-muted">
              Solo and Flex rank, then every recent game with build, runes, KDA and the full lobby.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Champion breakdown</h2>
            <p className="mt-2 text-sm text-muted">
              Win rate, KDA and CS per minute for each champion and role, filtered by queue.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-ink">Saved players</h2>
            <p className="mt-2 text-sm text-muted">
              Star a player to keep them in{' '}
              <Link href="/favorites" className="text-accent hover:text-ink">
                Favorites
              </Link>{' '}
              on this device. No account needed.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
