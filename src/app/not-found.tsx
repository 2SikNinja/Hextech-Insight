import Link from 'next/link'
import { PageMessage } from '@/components/PageMessage'

export default function NotFound() {
  return (
    <PageMessage title="Page not found">
      <p>That page does not exist. Player links look like /summoner/na/Name-TAG.</p>
      <p>
        <Link href="/" className="text-gold hover:text-parchment">
          Search for a player
        </Link>
      </p>
    </PageMessage>
  )
}
