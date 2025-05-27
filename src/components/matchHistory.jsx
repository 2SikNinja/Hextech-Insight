import { useState, useEffect } from 'react'
import { DatabaseService } from '../database/database-service.js'
import '../styles/matchHistory.css'

function MatchHistory({ summoner, onNavigate }) {
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFilter, setSelectedFilter] = useState('all')

  useEffect(() => {
    if (summoner) {
      loadMatchHistory()
    }
  }, [summoner])

  const loadMatchHistory = async () => {
    if (!summoner) return

    setLoading(true)
    setError(null)

    try {
      // Try to get real match data from database
      const { data: realMatches, error: dbError } = await DatabaseService.getMatchHistory(summoner.id, 20)

      if (realMatches && realMatches.length > 0) {
        setMatches(realMatches)
      } else {
        // Generate mock match data for demonstration
        const mockMatches = generateMockMatches(summoner)
        setMatches(mockMatches)
      }
    } catch (err) {
      console.error('Match history error:', err)
      setError('Failed to load match history')
      // Still show mock data on error
      const mockMatches = generateMockMatches(summoner)
      setMatches(mockMatches)
    } finally {
      setLoading(false)
    }
  }

  const generateMockMatches = (summoner) => {
    const champions = [
      'Aatrox', 'Ahri', 'Akali', 'Alistar', 'Amumu', 'Anivia', 'Annie', 'Ashe',
      'Azir', 'Bard', 'Blitzcrank', 'Brand', 'Braum', 'Caitlyn', 'Camille', 
      'Cassiopeia', 'Darius', 'Diana', 'Draven', 'Ekko', 'Elise', 'Ezreal',
      'Fiora', 'Fizz', 'Garen', 'Graves', 'Irelia', 'Janna', 'Jarvan IV',
      'Jax', 'Jinx', 'Karma', 'Katarina', 'Kayle', 'Leblanc', 'Lee Sin',
      'Leona', 'Lux', 'Malphite', 'Morgana', 'Nasus', 'Orianna', 'Riven',
      'Ryze', 'Shaco', 'Shen', 'Sivir', 'Sona', 'Thresh', 'Tristana',
      'Twisted Fate', 'Twitch', 'Vayne', 'Veigar', 'Vi', 'Viktor', 'Vladimir',
      'Warwick', 'Xin Zhao', 'Yasuo', 'Yorick', 'Zed', 'Ziggs', 'Zyra'
    ]

    const gameModes = [
      { name: 'Ranked Solo/Duo', queue: 'RANKED_SOLO_5x5' },
      { name: 'Ranked Flex', queue: 'RANKED_FLEX_SR' },
      { name: 'Normal Draft', queue: 'NORMAL_DRAFT' },
      { name: 'Normal Blind', queue: 'NORMAL_BLIND' },
      { name: 'ARAM', queue: 'ARAM' }
    ]

    return Array.from({ length: 15 }, (_, i) => {
      const win = Math.random() > 0.5
      const champion = champions[Math.floor(Math.random() * champions.length)]
      const gameMode = gameModes[Math.floor(Math.random() * gameModes.length)]
      const kills = Math.floor(Math.random() * 20)
      const deaths = Math.floor(Math.random() * 15)
      const assists = Math.floor(Math.random() * 25)
      const duration = Math.floor(Math.random() * 1800) + 900 // 15-45 minutes
      const createdAt = new Date(Date.now() - (i * Math.random() * 86400000 * 3)) // Last 3 days

      return {
        id: i + 1,
        champion_name: champion,
        kills,
        deaths,
        assists,
        win,
        game_duration: duration,
        game_mode: gameMode.name,
        queue_id: gameMode.queue,
        created_at: createdAt.toISOString(),
        cs: Math.floor(Math.random() * 300) + 50,
        gold: Math.floor(Math.random() * 20000) + 5000,
        damage_dealt: Math.floor(Math.random() * 50000) + 10000,
        vision_score: Math.floor(Math.random() * 80) + 10,
        items: Array.from({ length: 6 }, () => Math.floor(Math.random() * 100) + 1),
        spell1: Math.floor(Math.random() * 14) + 1,
        spell2: Math.floor(Math.random() * 14) + 1,
        matches: {
          match_id: `MATCH_${i + 1}`,
          game_creation: createdAt.getTime(),
          game_duration: duration,
          game_mode: gameMode.name,
          queue_id: gameMode.queue
        }
      }
    })
  }

  const filteredMatches = matches.filter(match => {
    if (selectedFilter === 'all') return true
    if (selectedFilter === 'wins') return match.win
    if (selectedFilter === 'losses') return !match.win
    if (selectedFilter === 'ranked') return match.queue_id?.includes('RANKED')
    return true
  })

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffHours < 24) {
      return `${diffHours}h ago`
    } else {
      return `${diffDays}d ago`
    }
  }

  const calculateKDA = (kills, deaths, assists) => {
    if (deaths === 0) return 'Perfect'
    return ((kills + assists) / deaths).toFixed(2)
  }

  const handleMatchClick = (match) => {
    onNavigate('specific-match', match)
  }

  if (!summoner) {
    return (
      <div className="match-history">
        <div className="error-state">
          <h2>No Summoner Selected</h2>
          <p>Please search for a summoner first.</p>
          <button onClick={() => onNavigate('search')}>
            Go to Search
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="match-history">
      <div className="match-header">
        <div className="summoner-info">
          <h1>{summoner.summoner_name}</h1>
          <p>Level {summoner.summoner_level} • {summoner.region.toUpperCase()}</p>
        </div>
        <button 
          onClick={() => onNavigate('search')} 
          className="back-button"
        >
          ← Back to Search
        </button>
      </div>

      <div className="match-filters">
        <button 
          className={selectedFilter === 'all' ? 'active' : ''}
          onClick={() => setSelectedFilter('all')}
        >
          All Games ({matches.length})
        </button>
        <button 
          className={selectedFilter === 'wins' ? 'active' : ''}
          onClick={() => setSelectedFilter('wins')}
        >
          Wins ({matches.filter(m => m.win).length})
        </button>
        <button 
          className={selectedFilter === 'losses' ? 'active' : ''}
          onClick={() => setSelectedFilter('losses')}
        >
          Losses ({matches.filter(m => !m.win).length})
        </button>
        <button 
          className={selectedFilter === 'ranked' ? 'active' : ''}
          onClick={() => setSelectedFilter('ranked')}
        >
          Ranked ({matches.filter(m => m.queue_id?.includes('RANKED')).length})
        </button>
      </div>

      {loading && (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading match history...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!loading && filteredMatches.length === 0 && (
        <div className="empty-state">
          <h3>No matches found</h3>
          <p>Try adjusting your filters or check back later.</p>
        </div>
      )}

      {!loading && filteredMatches.length > 0 && (
        <div className="matches-list">
          {filteredMatches.map(match => (
            <div 
              key={match.id} 
              className={`match-card ${match.win ? 'win' : 'loss'}`}
              onClick={() => handleMatchClick(match)}
            >
              <div className="match-result">
                <span className="result-text">{match.win ? 'Victory' : 'Defeat'}</span>
                <span className="time-ago">{formatTimeAgo(match.created_at)}</span>
              </div>

              <div className="match-info">
                <div className="game-mode">{match.game_mode || 'Unknown'}</div>
                <div className="duration">{formatDuration(match.game_duration || 0)}</div>
              </div>

              <div className="champion-info">
                <div className="champion-image">
                  <img 
                    src={`/league_files/15.8.1/img/champion/${match.champion_name}.png`}
                    alt={match.champion_name}
                    onError={(e) => {
                      e.target.src = '/league_files/img/champion/default.png'
                    }}
                  />
                </div>
                <div className="champion-details">
                  <span className="champion-name">{match.champion_name}</span>
                  <div className="summoner-spells">
                    <img 
                      src={`/league_files/15.8.1/img/spell/${match.spell1 || 1}.png`}
                      alt="Spell 1"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                    <img 
                      src={`/league_files/15.8.1/img/spell/${match.spell2 || 2}.png`}
                      alt="Spell 2"
                      onError={(e) => {
                        e.target.style.display = 'none'
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="match-stats">
                <div className="kda">
                  <span className="kda-text">{match.kills}/{match.deaths}/{match.assists}</span>
                  <span className="kda-ratio">{calculateKDA(match.kills, match.deaths, match.assists)} KDA</span>
                </div>
                <div className="additional-stats">
                  <span>CS: {match.cs || 0}</span>
                  <span>Vision: {match.vision_score || 0}</span>
                </div>
              </div>

              <div className="items">
                {(match.items || []).slice(0, 6).map((item, index) => (
                  <div key={index} className="item-slot">
                    {item > 0 && (
                      <img 
                        src={`/league_files/15.8.1/img/item/${item}.png`}
                        alt={`Item ${item}`}
                        onError={(e) => {
                          e.target.style.display = 'none'
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="view-details">
                <span>Click for details →</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && filteredMatches.length > 0 && (
        <div className="match-actions">
          <button onClick={() => onNavigate('player-stats', summoner)}>
            View Player Statistics
          </button>
          <button onClick={() => onNavigate('search')}>
            Search Another Player
          </button>
        </div>
      )}
    </div>
  )
}

export default MatchHistory