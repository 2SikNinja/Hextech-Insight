import { useState, useEffect } from 'react'
import { DatabaseService } from '../database/database-service.js'
import { RiotApiService } from '../database/riot-api-service.js'
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

  const validateRiotId = (riotId) => {
    const trimmed = riotId.trim()
    if (!trimmed.includes('#')) {
      return 'Please use the format: GameName#TAG (e.g., 2SikNinja#2Sik)'
    }
    
    const parts = trimmed.split('#')
    if (parts.length !== 2) {
      return 'Invalid format. Please use: GameName#TAG'
    }
    
    const [gameName, tagLine] = parts
    if (!gameName || !tagLine) {
      return 'Both game name and tag are required'
    }
    
    if (gameName.length < 3 || gameName.length > 16) {
      return 'Game name must be 3-16 characters long'
    }
    
    if (tagLine.length < 3 || tagLine.length > 5) {
      return 'Tag must be 3-5 characters long'
    }
    
    return null
  }

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchTerm.trim()) return

    // Validate Riot ID format
    const validationError = validateRiotId(searchTerm)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError(null)
    setSummoner(null)
    setIsFavorited(false)

    try {
      console.log(`🔍 Starting search for: ${searchTerm} in region: ${region}`)
      
      // First, try to find in our database using the full Riot ID
      const { data: existingSummoner, error: dbError } = await DatabaseService.searchSummoner(
        searchTerm.trim(),
        region
      )

      if (existingSummoner) {
        console.log('✅ Found existing summoner in database:', existingSummoner)
        setSummoner(existingSummoner)
        setError('Found cached data! Searching for fresh data...')
        
        // Still try to get fresh data in the background
        setTimeout(() => setError(null), 2000)
      } else {
        console.log('❌ Summoner not found in database, fetching from Riot API...')
      }

      // Try to get fresh data from Riot API
      try {
        console.log('🌐 Calling Riot API...')
        const riotSummonerData = await RiotApiService.getSummonerByRiotId(searchTerm.trim(), region)
        
        console.log('✅ Riot API Success! Data received:', riotSummonerData)
        
        // Format for our app
        const formattedSummoner = {
          id: Date.now(), // Temporary ID for display, will be replaced when saved to DB
          puuid: riotSummonerData.puuid,
          summoner_id: riotSummonerData.id,
          account_id: riotSummonerData.accountId,
          summoner_name: `${riotSummonerData.gameName}#${riotSummonerData.tagLine}`,
          summoner_level: riotSummonerData.summonerLevel,
          profile_icon_id: riotSummonerData.profileIconId,
          region: region,
          rank_tier: riotSummonerData.rankData?.soloQueue?.tier || null,
          rank_division: riotSummonerData.rankData?.soloQueue?.rank || null,
          league_points: riotSummonerData.rankData?.soloQueue?.leaguePoints || 0,
          wins: riotSummonerData.rankData?.soloQueue?.wins || 0,
          losses: riotSummonerData.rankData?.soloQueue?.losses || 0,
          last_updated: new Date().toISOString()
        }

        setSummoner(formattedSummoner)
        setError('✅ Fresh data loaded from Riot API!')
        setTimeout(() => setError(null), 3000)

        // Try to save to database for future searches
        try {
          const savedSummoner = await DatabaseService.createOrUpdateSummoner(formattedSummoner)
          console.log('✅ Saved to database:', savedSummoner)
        } catch (saveError) {
          console.log('⚠️ Could not save to database:', saveError)
          // Continue anyway since we have the data
        }

      } catch (apiError) {
        console.error('❌ Riot API error:', apiError)
        
        // If we have cached data, use it
        if (existingSummoner) {
          console.log('📦 Using cached data due to API error')
          setError('⚠️ Using cached data (API temporarily unavailable)')
          setTimeout(() => setError(null), 4000)
          return
        }
        
        // Handle specific API errors
        if (apiError.message.includes('not found')) {
          setError('❌ Summoner not found. Please check the Riot ID and region.')
        } else if (apiError.message.includes('API key')) {
          setError('⚠️ API key issue. Please check your configuration.')
        } else if (apiError.message.includes('Rate limit')) {
          setError('⏱️ Rate limited. Please wait a moment and try again.')
        } else {
          setError('⚠️ API temporarily unavailable. Please try again later.')
          
          // Create mock summoner for demonstration if no cached data
          const { gameName, tagLine } = RiotApiService.parseRiotId(searchTerm.trim())
          const mockSummoner = {
            id: Date.now(),
            summoner_name: `${gameName}#${tagLine}`,
            summoner_level: Math.floor(Math.random() * 500) + 1,
            region: region,
            last_updated: new Date().toISOString(),
            puuid: `mock_puuid_${Date.now()}`,
            profile_icon_id: Math.floor(Math.random() * 28) + 1,
            rank_tier: ['IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER'][Math.floor(Math.random() * 9)],
            rank_division: ['IV', 'III', 'II', 'I'][Math.floor(Math.random() * 4)],
            league_points: Math.floor(Math.random() * 100),
            wins: Math.floor(Math.random() * 100) + 10,
            losses: Math.floor(Math.random() * 80) + 5
          }
          
          setSummoner(mockSummoner)
          setError('🧪 Demo Mode: Showing mock data due to API error.')
        }
        
        setTimeout(() => setError(null), 5000)
      }
    } catch (err) {
      setError('❌ Failed to search for summoner. Please try again.')
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
    return `${summoner.rank_tier} ${summoner.rank_division}`
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
            placeholder="Enter Riot ID (e.g., 2SikNinja#2Sik)..."
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
          <p>Searching Riot API...</p>
        </div>
      )}

      {error && (
        <div className={`error-message ${error.includes('✅') || error.includes('📦') ? 'success-message' : ''}`}>
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
              </div>
              <div className="summoner-details">
                <h3>{summoner.summoner_name}</h3>
                <div className="summoner-meta">
                  <span className="region-badge">{summoner.region.toUpperCase()}</span>
                  <span className="level-display">Level {summoner.summoner_level}</span>
                  <span className="last-updated">Updated {formatLastUpdated(summoner.last_updated)}</span>
                  {summoner.puuid && (
                    <span className="puuid-indicator">✅ PUUID: {summoner.puuid.substring(0, 8)}...</span>
                  )}
                </div>
              </div>
            </div>
            
            {summoner.rank_tier && (
              <div className="rank-section">
                <div className="rank-info">
                  <div className="rank-display">{getRankDisplay(summoner)}</div>
                  <div className="lp-display">{summoner.league_points || 0} LP</div>
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
          <h4>🆕 New Riot ID Format</h4>
          <ul>
            <li><strong>Use the new format:</strong> GameName#TAG (e.g., 2SikNinja#2Sik)</li>
            <li><strong>Find your Riot ID:</strong> Check in-game or on your Riot account</li>
            <li>Game name: 3-16 characters, Tag: 3-5 characters</li>
            <li>Select the correct region where your account is located</li>
            <li>Make sure both the game name and tag are spelled correctly</li>
            <li>Create an account to save your favorite players</li>
          </ul>
          
          <div className="format-examples">
            <h5>✅ Correct Format Examples:</h5>
            <ul>
              <li>2SikNinja#2Sik</li>
              <li>PlayerName#123</li>
              <li>GamerTag#ABCD</li>
            </ul>
            
            <h5>❌ Incorrect Formats:</h5>
            <ul>
              <li>2SikNinja (missing tag)</li>
              <li>#2Sik (missing game name)</li>
              <li>Player#Name#123 (multiple #)</li>
            </ul>
          </div>
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