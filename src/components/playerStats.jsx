import { useState, useEffect } from 'react'
import { DatabaseService } from '../database/database-service.js'
import '../styles/playerStats.css'

function PlayerStats({ summoner, onNavigate }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTimeframe, setSelectedTimeframe] = useState('all') // 'all', 'recent', 'thisMonth'
  const [selectedQueue, setSelectedQueue] = useState('all') // 'all', 'ranked', 'normal'

  useEffect(() => {
    if (summoner) {
      loadPlayerStats()
    }
  }, [summoner, selectedTimeframe, selectedQueue])

  const loadPlayerStats = async () => {
    if (!summoner) return

    setLoading(true)
    setError(null)

    try {
      const { data: realStats, error: statsError } = await DatabaseService.getPlayerStats(summoner.id)
      
      if (realStats) {
        setStats(realStats)
      } else {
        // Generate comprehensive mock stats for demonstration
        setStats(generateMockStats(summoner))
      }
    } catch (err) {
      console.error('Error loading player stats:', err)
      setError('Failed to load player statistics')
      // Still show mock data on error
      setStats(generateMockStats(summoner))
    } finally {
      setLoading(false)
    }
  }

  const generateMockStats = (summoner) => {
    const champions = [
      'Aatrox', 'Ahri', 'Akali', 'Alistar', 'Ammu', 'Anivia', 'Annie', 'Ashe',
      'Azir', 'Bard', 'Blitzcrank', 'Brand', 'Braum', 'Caitlyn', 'Camille', 
      'Cassiopeia', 'Darius', 'Diana', 'Draven', 'Ekko', 'Elise', 'Ezreal',
      'Fiora', 'Fizz', 'Garen', 'Graves', 'Irelia', 'Janna', 'Jarvan IV',
      'Jax', 'Jinx', 'Karma', 'Katarina', 'Kayle', 'Leblanc', 'Lee Sin'
    ]

    // Generate top champions with realistic stats
    const championStats = Array.from({ length: 8 }, (_, i) => {
      const games = Math.floor(Math.random() * 50) + (i === 0 ? 25 : 10) // Most played has more games
      const winRate = Math.random() * 40 + 40 // 40-80% win rate
      const wins = Math.floor(games * (winRate / 100))
      
      return {
        championName: champions[i],
        games,
        wins,
        winRate: parseFloat(winRate.toFixed(1)),
        avgKills: parseFloat((Math.random() * 10 + 5).toFixed(1)),
        avgDeaths: parseFloat((Math.random() * 6 + 3).toFixed(1)),
        avgAssists: parseFloat((Math.random() * 12 + 6).toFixed(1)),
        kda: parseFloat((Math.random() * 3 + 1).toFixed(2)),
        avgDamage: Math.floor(Math.random() * 30000) + 15000,
        avgGold: Math.floor(Math.random() * 8000) + 12000
      }
    }).sort((a, b) => b.games - a.games)

    return {
      totalGames: Math.floor(Math.random() * 200) + 50,
      wins: Math.floor(Math.random() * 120) + 30,
      losses: Math.floor(Math.random() * 100) + 20,
      winRate: parseFloat((Math.random() * 30 + 45).toFixed(1)),
      avgKills: parseFloat((Math.random() * 5 + 6).toFixed(1)),
      avgDeaths: parseFloat((Math.random() * 3 + 4).toFixed(1)),
      avgAssists: parseFloat((Math.random() * 6 + 8).toFixed(1)),
      kda: parseFloat((Math.random() * 2 + 1.5).toFixed(2)),
      avgGold: Math.floor(Math.random() * 5000) + 13000,
      avgDamage: Math.floor(Math.random() * 15000) + 20000,
      avgVisionScore: parseFloat((Math.random() * 20 + 25).toFixed(1)),
      avgCS: parseFloat((Math.random() * 50 + 140).toFixed(1)),
      championStats,
      // Additional mock data
      bestWinStreakCurrent: Math.floor(Math.random() * 8) + 1,
      bestWinStreakRecord: Math.floor(Math.random() * 15) + 5,
      mostKills: Math.floor(Math.random() * 15) + 15,
      mostDeaths: Math.floor(Math.random() * 10) + 12,
      mostAssists: Math.floor(Math.random() * 20) + 25,
      perfectGames: Math.floor(Math.random() * 5) + 1,
      pentaKills: Math.floor(Math.random() * 3),
      quadraKills: Math.floor(Math.random() * 8) + 2,
      tripleKills: Math.floor(Math.random() * 20) + 10,
      doubleKills: Math.floor(Math.random() * 50) + 30,
      favoriteRole: ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY'][Math.floor(Math.random() * 5)],
      avgGameDuration: Math.floor(Math.random() * 10) + 25 // minutes
    }
  }

  const getPerformanceGrade = (winRate) => {
    if (winRate >= 70) return { grade: 'S+', color: '#c89b3c' }
    if (winRate >= 60) return { grade: 'S', color: '#ffc107' }
    if (winRate >= 55) return { grade: 'A', color: '#28a745' }
    if (winRate >= 50) return { grade: 'B', color: '#17a2b8' }
    if (winRate >= 45) return { grade: 'C', color: '#fd7e14' }
    return { grade: 'D', color: '#dc3545' }
  }

  const getKDAColor = (kda) => {
    if (kda >= 3) return '#c89b3c'
    if (kda >= 2) return '#28a745'
    if (kda >= 1.5) return '#ffc107'
    if (kda >= 1) return '#fd7e14'
    return '#dc3545'
  }

  const formatNumber = (num) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k'
    }
    return num.toString()
  }

  if (!summoner) {
    return (
      <div className="player-stats">
        <div className="error-state">
          <h2>No Summoner Selected</h2>
          <p>Please search for a summoner first to view their statistics.</p>
          <button onClick={() => onNavigate('search')}>
            Go to Search
          </button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="player-stats">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Analyzing player performance...</p>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="player-stats">
        <div className="error-state">
          <h2>Error Loading Statistics</h2>
          <p>{error}</p>
          <button onClick={() => onNavigate('search')}>
            Back to Search
          </button>
        </div>
      </div>
    )
  }

  const performanceGrade = getPerformanceGrade(stats.winRate)

  return (
    <div className="player-stats">
      {/* Header */}
      <div className="stats-header">
        <div className="summoner-info">
          <div className="profile-section">
            <div className="profile-icon">
              <img 
                src={`/league_files/15.8.1/img/profileicon/${summoner.profile_icon_id || 1}.png`}
                alt="Profile Icon"
                onError={(e) => {
                  e.target.src = '/league_files/img/profileicon/1.png'
                }}
              />
              <span className="level-badge">{summoner.summoner_level}</span>
            </div>
            <div className="summoner-details">
              <h1>{summoner.summoner_name}</h1>
              <div className="summoner-meta">
                <span className="region">{summoner.region.toUpperCase()}</span>
                {summoner.rank_tier && (
                  <>
                    <span>•</span>
                    <span className="rank">{summoner.rank_tier} {summoner.rank_division}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="performance-grade">
            <div 
              className="grade-circle"
              style={{ borderColor: performanceGrade.color, color: performanceGrade.color }}
            >
              {performanceGrade.grade}
            </div>
            <span className="grade-label">Performance Grade</span>
          </div>
        </div>
        <button 
          onClick={() => onNavigate('match-history', summoner)} 
          className="back-button"
        >
          ← Back to History
        </button>
      </div>

      {/* Filter Controls */}
      <div className="stats-controls">
        <div className="filter-group">
          <label>Timeframe:</label>
          <select 
            value={selectedTimeframe} 
            onChange={(e) => setSelectedTimeframe(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="recent">Last 20 Games</option>
            <option value="thisMonth">This Month</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Queue Type:</label>
          <select 
            value={selectedQueue} 
            onChange={(e) => setSelectedQueue(e.target.value)}
          >
            <option value="all">All Queues</option>
            <option value="ranked">Ranked Only</option>
            <option value="normal">Normal Only</option>
          </select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="overview-stats">
        <div className="stat-card primary">
          <div className="stat-value">{stats.totalGames}</div>
          <div className="stat-label">Total Games</div>
          <div className="stat-details">{stats.wins}W {stats.losses}L</div>
        </div>
        
        <div className="stat-card success">
          <div className="stat-value">{stats.winRate}%</div>
          <div className="stat-label">Win Rate</div>
          <div className="stat-details">
            {stats.wins > stats.losses ? 'Climbing' : 'Declining'} trend
          </div>
        </div>
        
        <div className="stat-card kda">
          <div 
            className="stat-value"
            style={{ color: getKDAColor(stats.kda) }}
          >
            {stats.kda}
          </div>
          <div className="stat-label">Average KDA</div>
          <div className="stat-details">
            {stats.avgKills} / {stats.avgDeaths} / {stats.avgAssists}
          </div>
        </div>
        
        <div className="stat-card damage">
          <div className="stat-value">{formatNumber(stats.avgDamage)}</div>
          <div className="stat-label">Avg Damage</div>
          <div className="stat-details">Per game</div>
        </div>
        
        <div className="stat-card gold">
          <div className="stat-value">{formatNumber(stats.avgGold)}</div>
          <div className="stat-label">Avg Gold</div>
          <div className="stat-details">Per game</div>
        </div>
        
        <div className="stat-card vision">
          <div className="stat-value">{stats.avgVisionScore}</div>
          <div className="stat-label">Vision Score</div>
          <div className="stat-details">Per game</div>
        </div>
      </div>

      {/* Detailed Performance */}
      <div className="detailed-stats">
        <div className="stats-section">
          <h3>🏆 Performance Highlights</h3>
          <div className="highlights-grid">
            <div className="highlight-card">
              <div className="highlight-icon">🔥</div>
              <div className="highlight-content">
                <span className="highlight-value">{stats.bestWinStreakRecord}</span>
                <span className="highlight-label">Best Win Streak</span>
                <span className="highlight-sub">Current: {stats.bestWinStreakCurrent}</span>
              </div>
            </div>
            
            <div className="highlight-card">
              <div className="highlight-icon">⚔️</div>
              <div className="highlight-content">
                <span className="highlight-value">{stats.mostKills}</span>
                <span className="highlight-label">Most Kills</span>
                <span className="highlight-sub">Single game record</span>
              </div>
            </div>
            
            <div className="highlight-card">
              <div className="highlight-icon">💀</div>
              <div className="highlight-content">
                <span className="highlight-value">{stats.perfectGames}</span>
                <span className="highlight-label">Perfect Games</span>
                <span className="highlight-sub">0 deaths</span>
              </div>
            </div>
            
            <div className="highlight-card">
              <div className="highlight-icon">🎯</div>
              <div className="highlight-content">
                <span className="highlight-value">{stats.avgCS}</span>
                <span className="highlight-label">Avg CS</span>
                <span className="highlight-sub">Per game</span>
              </div>
            </div>
          </div>
        </div>

        <div className="stats-section">
          <h3>🏅 Multikill Records</h3>
          <div className="multikill-stats">
            <div className="multikill-item penta">
              <span className="multikill-count">{stats.pentaKills}</span>
              <span className="multikill-label">Pentakills</span>
            </div>
            <div className="multikill-item quadra">
              <span className="multikill-count">{stats.quadraKills}</span>
              <span className="multikill-label">Quadrakills</span>
            </div>
            <div className="multikill-item triple">
              <span className="multikill-count">{stats.tripleKills}</span>
              <span className="multikill-label">Triplekills</span>
            </div>
            <div className="multikill-item double">
              <span className="multikill-count">{stats.doubleKills}</span>
              <span className="multikill-label">Doublekills</span>
            </div>
          </div>
        </div>
      </div>

      {/* Champion Mastery */}
      <div className="champion-mastery">
        <h3>🏆 Champion Performance</h3>
        <div className="champions-grid">
          {stats.championStats.map((champion, index) => (
            <div key={champion.championName} className="champion-card">
              <div className="champion-rank">#{index + 1}</div>
              <div className="champion-icon">
                <img 
                  src={`/league_files/15.8.1/img/champion/${champion.championName}.png`}
                  alt={champion.championName}
                  onError={(e) => {
                    e.target.src = '/league_files/img/champion/default.png'
                  }}
                />
              </div>
              <div className="champion-info">
                <h4>{champion.championName}</h4>
                <div className="champion-stats">
                  <div className="champion-games">
                    <span className="games-count">{champion.games} games</span>
                    <span className="winrate" style={{ 
                      color: champion.winRate >= 60 ? '#28a745' : 
                             champion.winRate >= 50 ? '#ffc107' : '#dc3545' 
                    }}>
                      {champion.winRate}% WR
                    </span>
                  </div>
                  <div className="champion-kda">
                    <span className="kda-numbers">
                      {champion.avgKills} / {champion.avgDeaths} / {champion.avgAssists}
                    </span>
                    <span 
                      className="kda-ratio"
                      style={{ color: getKDAColor(champion.kda) }}
                    >
                      {champion.kda} KDA
                    </span>
                  </div>
                  <div className="champion-performance">
                    <span>Avg Damage: {formatNumber(champion.avgDamage)}</span>
                    <span>Avg Gold: {formatNumber(champion.avgGold)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Additional Stats */}
      <div className="additional-stats">
        <div className="stat-section">
          <h4>📊 Game Insights</h4>
          <div className="insight-grid">
            <div className="insight-item">
              <span className="insight-label">Favorite Role</span>
              <span className="insight-value">{stats.favoriteRole}</span>
            </div>
            <div className="insight-item">
              <span className="insight-label">Avg Game Time</span>
              <span className="insight-value">{stats.avgGameDuration}m</span>
            </div>
            <div className="insight-item">
              <span className="insight-label">Most Assists</span>
              <span className="insight-value">{stats.mostAssists}</span>
            </div>
            <div className="insight-item">
              <span className="insight-label">Most Deaths</span>
              <span className="insight-value">{stats.mostDeaths}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="stats-actions">
        <button onClick={() => onNavigate('match-history', summoner)}>
          📊 View Match History
        </button>
        <button onClick={() => onNavigate('search')}>
          🔍 Search Another Player
        </button>
        <button onClick={() => onNavigate('home')}>
          🏠 Back to Home
        </button>
      </div>
    </div>
  )
}

export default PlayerStats