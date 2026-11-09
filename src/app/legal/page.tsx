import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About and privacy',
}

export default function LegalPage() {
  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-3xl text-ink">About and privacy</h1>

      <div className="mt-8 space-y-8 leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-ink">What this site does</h2>
          <p className="mt-2 text-muted">
            Hextech Insight shows League of Legends rank, match history and champion statistics using the official Riot
            Games API. Game images come from Riot&apos;s Data Dragon service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">What is stored</h2>
          <p className="mt-2 text-muted">
            When someone looks up a player, their public game data (Riot ID, level, rank and recent matches) is saved so
            later visits load quickly without asking Riot again. There are no accounts. Saved players live only in your
            browser and never reach our server.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Removing your data</h2>
          <p className="mt-2 text-muted">
            To have your stored profile and matches deleted, open an issue on the{' '}
            <a
              href="https://github.com/2SikNinja/Hextech-Insight/issues"
              className="text-accent hover:text-ink"
              rel="noreferrer"
              target="_blank"
            >
              project&apos;s GitHub page
            </a>{' '}
            with your Riot ID and region.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-ink">Riot Games</h2>
          <p className="mt-2 text-muted">
            Hextech Insight isn&apos;t endorsed by Riot Games and doesn&apos;t reflect the views or opinions of Riot Games
            or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated
            properties are trademarks or registered trademarks of Riot Games, Inc.
          </p>
        </section>
      </div>
    </article>
  )
}
