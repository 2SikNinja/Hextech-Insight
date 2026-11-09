import { GameImage } from '@/components/GameImage'
import { type GameData, championIconUrl, championName } from '@/lib/ddragon'
import type { MasteryEntry } from '@/lib/summoners'

export function MasteryPanel({ mastery, gameData }: { mastery: MasteryEntry[]; gameData: GameData }) {
  if (mastery.length === 0) return null

  return (
    <section aria-labelledby="mastery-heading" className="border border-line bg-surface">
      <header className="border-b border-line px-4 py-3">
        <h2 id="mastery-heading" className="font-semibold text-ink">
          Champion mastery
        </h2>
      </header>
      <ul className="divide-y divide-line/60 px-4">
        {mastery.map((entry) => {
          const name = championName(gameData, entry.championId)
          return (
            <li key={entry.championId} className="flex items-center gap-3 py-2.5">
              <GameImage src={championIconUrl(gameData, entry.championId)} alt="" size={32} />
              <span className="min-w-0 flex-1 truncate text-text">{name}</span>
              <span className="tabular text-right text-sm">
                <span className="block text-ink">{entry.points.toLocaleString('en-US')}</span>
                <span className="block text-xs text-muted">Level {entry.level}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
