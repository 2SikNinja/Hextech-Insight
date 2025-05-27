import { useState, useEffect } from 'react'
import { DatabaseService } from '../database/database-service.js'
import '../styles/summonerSearch.css'

function SummonerSearch({ onNavigate, user }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [region, setRegion] = useState('na1')
  const [summoner, setSummoner] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [favoriteLoading, setFavoriteLoading] = useState(false)

  const regions = [
    { value: 'na1', label: 'North America' },
    { value: 'euw1', label: 'Europe West' },
    { value: 'eun1', label: 'Europe Nordic & East' },
    { value: 'kr', label: 'Korea' },
    { value: 'jp1', label: 'Japan' },
    { value: 'br1', label: 'Brazil' },
    { value: 'la1', label: 'Latin America North' },
    { value: 'la2', label: 'Latin America South' },
    { value: 'oc1', label: 'Oceania' },
    { value: 'tr1', label: 'Turkey' },
    { value: 'ru', label: 'Russia' }
  ]

  // Check if summoner is already favorited when summoner changes
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (user && summoner) {
        try {
          const { isFavorite } = await DatabaseService.isFavorite(user.id, summoner.id)
          setIsFavorited(isFavorite)
        } catch (err) {
          console.error('Error checking favorite status:', err)
        }
      } else {
        setIsFavorited(false)
      }
    }
    
    checkFavoriteStatus()
  }, [user, summoner])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    setLoading(true)
    setError(null)
    setSummoner(null)
    setIsFavorited(false)

    try {
      // First, try to find in our database
      const { data: existingSummoner, error: dbError } = await DatabaseService.searchSummoner(
        searchTerm.trim(),
        region
      )

      if (existingSummoner) {
        setSummoner(existingSummoner)
      } else {
        // For now, create a mock summoner for demonstration
        // In a real app, this would fetch from Riot API
        const mockSummoner = {
          id: Date.now(), // Mock ID
          summoner_name: searchTerm.trim(),
          summoner_level: Math.floor(Math.random() * 500) + 1,
          region: region,
          last_updated: new Date().toISOString(),
          puuid: `mock_puuid_${Date.now()}`,
          profile_icon_id: Math.floor(Math.random() * 28) + 1,
          // Add some mock rank data
          rank_tier: ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'][Math.floor(Math.random() * 9)],
          rank_division: ['IV', 'III', 'II', 'I'][Math.floor(Math.random() * 4)],
          league_points: Math.floor(Math.random() * 100),
          wins: Math.floor(Math.random() * 100) + 10,
          losses: Math.floor(Math.random() * 80) + 5
        }
        
        setSummoner(mockSummoner)
        
        // Show a message that this is demo data
        setError('Demo Mode: Showing mock data. Real Riot API integration coming soon!')
        setTimeout(() => setError(null), 3000)
      }
    } catch (err) {
      setError('Failed to search for summoner. Please try again.')
      console.error('Search error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleViewMatchHistory = () => {
    if (summoner) {
      onNavigate('match-history', summoner)
    }
  }

  const handleViewStats = () => {
    if (summoner) {
      onNavigate('player-stats', summoner)
    }
  }

  const handleAddToFavorites = async () => {
    if (!user) {
      setError('Please sign in to add favorites')
      setTimeout(() => setError(null), 3000)
      return
    }

    if (!summoner) return

    setFavoriteLoading(true)

    try {
      if (isFavorited) {
        // Remove from favorites
        await DatabaseService.removeFromFavorites(user.id, summoner.id)
        setIsFavorited(false)
        setError('Removed from favorites!')
      } else {
        // Add to favorites
        await DatabaseService.addToFavorites(user.id, summoner.id)
        setIsFavorited(true)
        setError('Added to favorites!')
      }
      
      setTimeout(() => setError(null), 3000)
      
    } catch (err) {
      console.error('Favorites error:', err)
      setError('Failed to update favorites')
      setTimeout(() => setError(null), 3000)
    } finally {
      setFavoriteLoading(false)
    }
  }

  const formatLastUpdated = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) {
      return `${diffMins} minutes ago`
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`
    } else if (diffDays < 7) {
      return `${diffDays} days ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getRankDisplay = (summoner) => {
    if (!summoner.rank_tier || !summoner.rank_division) {
      return 'Unranked'
    }
    return `${summoner.rank_tier} ${summoner.rank_division} (${summoner.league_points || 0} LP)`
  }

  const getWinRate = (wins, losses) => {
    if (!wins && !losses) return null
    const total = wins + losses
    return Math.round((wins / total) * 100)
  }

  return (
    <div className="summoner-search">
      <h2>Search Summoner</h2>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="input-group">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter summoner name..."
            className="summoner-input"
            disabled={loading}
          />
          
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="region-select"
            disabled={loading}
          >
            {regions.map(r => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          
          <button type="submit" disabled={loading || !searchTerm.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {loading && (
        <div className="search-loading">
          <div className="loading-spinner"></div>
          <p>Searching for summoner...</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {summoner && (
        <div className="summoner-result">
          <div className="summoner-header">
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
                <h3>{summoner.summoner_name}</h3>
                <div className="summoner-meta">
                  <span className="region-badge">{summoner.region.toUpperCase()}</span>
                  <span className="last-updated">Updated {formatLastUpdated(summoner.last_updated)}</span>
                </div>
              </div>
            </div>
            
            {summoner.rank_tier && (
              <div className="rank-section">
                <div className="rank-info">
                  <span className="rank-display">{getRankDisplay(summoner)}</span>
                  {summoner.wins && summoner.losses && (
                    <div className="winrate-display">
                      <span className="winrate">{getWinRate(summoner.wins, summoner.losses)}% Win Rate</span>
                      <span className="games">({summoner.wins}W {summoner.losses}L)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="action-buttons">
            <button onClick={handleViewMatchHistory}>
              📊 View Match History
            </button>
            <button onClick={handleViewStats}>
              📈 View Statistics
            </button>
            <button 
              onClick={handleAddToFavorites}
              disabled={favoriteLoading}
              className={isFavorited ? 'favorited' : 'not-favorited'}
            >
              {favoriteLoading ? 'Updating...' : 
               isFavorited ? '⭐ Remove from Favorites' : 
               user ? '⭐ Add to Favorites' : 'Sign In to Save'}
            </button>
          </div>
        </div>
      )}

      {!summoner && !loading && !error && (
        <div className="search-tips">
          <h4>Search Tips</h4>
          <ul>
            <li>Enter the exact summoner name (case sensitive)</li>
            <li>Select the correct region where the account is located</li>
            <li>Make sure the summoner name is spelled correctly</li>
            <li>Try searching without special characters if you encounter issues</li>
            <li>Create an account to save your favorite players</li>
          </ul>
        </div>
      )}

      {!user && (
        <div className="signin-prompt">
          <h4>🔐 Sign In for More Features</h4>
          <p>Create an account to save favorite players, track statistics, and get personalized insights!</p>
          <div className="signin-actions">
            <button onClick={() => onNavigate('signin')} className="signin-btn">
              Sign In
            </button>
            <button onClick={() => onNavigate('signup')} className="signup-btn">
              Create Account
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SummonerSearch