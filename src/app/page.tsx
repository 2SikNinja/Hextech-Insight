import Link from 'next/link'
import { SearchForm } from '@/components/SearchForm'

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Faint hexagon lattice behind the hero, the one piece of ornament on the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='98' viewBox='0 0 56 98'%3E%3Cpath d='M28 66L0 50V16L28 0l28 16v34L28 66zm0 32L0 82V66l28 16 28-16v16L28 98z' fill='none' stroke='%23c8aa6e' stroke-width='1'/%3E%3C/svg%3E\")",
          maskImage: 'radial-gradient(ellipse at 50% 30%, black, transparent 70%)',
        }}
      />

      <section className="relative mx-auto max-w-3xl px-4 pb-20 pt-20 sm:pt-28">
        <h1 className="font-display text-4xl font-semibold leading-tight text-parchment sm:text-6xl">
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
          <span className="text-parchment">Faker#KR1</span>.
        </p>
      </section>

      <section className="relative border-t border-line bg-panel/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
          <div>
            <h2 className="font-semibold text-parchment">Rank and recent games</h2>
            <p className="mt-2 text-sm text-muted">
              Solo and Flex rank, then every recent game with build, runes, KDA and the full lobby.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-parchment">Champion breakdown</h2>
            <p className="mt-2 text-sm text-muted">
              Win rate, KDA and CS per minute for each champion and role, filtered by queue.
            </p>
          </div>
          <div>
            <h2 className="font-semibold text-parchment">Saved players</h2>
            <p className="mt-2 text-sm text-muted">
              Star a player to keep them in{' '}
              <Link href="/favorites" className="text-gold hover:text-parchment">
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
