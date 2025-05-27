import { useState, useEffect } from 'react'
import { DatabaseService } from '../database/database-service.js'
import '../styles/userFavorites.css'

function UserFavorites({ onNavigate, user }) {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshingIds, setRefreshingIds] = useState(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('recent') // 'recent', 'name', 'level', 'rank'
  const [filterRegion, setFilterRegion] = useState('all')

  const regions = [
    { value: 'all', label: 'All Regions' },
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

  useEffect(() => {
    if (user) {
      loadFavorites()
    }
  }, [user])

  const loadFavorites = async () => {
    if (!user) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: favError } = await DatabaseService.getUserFavorites(user.id)
      
      if (favError) {
        throw favError
      }

      setFavorites(data || [])
    } catch (err) {
      console.error('Error loading favorites:', err)
      setError('Failed to load your favorites. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveFavorite = async (summonerId, summonerName) => {
    if (!confirm(`Remove ${summonerName} from your favorites?`)) {
      return
    }

    try {
      const { error } = await DatabaseService.removeFromFavorites(user.id, summonerId)
      
      if (error) {
        throw error
      }

      // Remove from local state
      setFavorites(prev => prev.filter(fav => fav.summoner_id !== summonerId))
      
      // Show success message briefly
      setError(`${summonerName} removed from favorites!`)
      setTimeout(() => setError(null), 3000)
      
    } catch (err) {
      console.error('Error removing favorite:', err)
      setError('Failed to remove favorite. Please try again.')
      setTimeout(() => setError(null), 5000)
    }
  }

  const handleRefreshSummoner = async (summonerId, summonerName) => {
    setRefreshingIds(prev => new Set([...prev, summonerId]))
    
    try {
      await DatabaseService.refreshSummonerData(summonerId)
      
      // Reload favorites to get updated data
      await loadFavorites()
      
      setError(`${summonerName} data refreshed!`)
      setTimeout(() => setError(null), 3000)
      
    } catch (err) {
      console.error('Error refreshing summoner:', err)
      setError('Failed to refresh summoner data. Please try again.')
      setTimeout(() => setError(null), 5000)
    } finally {
      setRefreshingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(summonerId)
        return newSet
      })
    }
  }

  const handleViewMatchHistory = (summoner) => {
    onNavigate('match-history', summoner.summoners)
  }

  const handleViewStats = (summoner) => {
    onNavigate('player-stats', summoner.summoners)
  }

  const formatLastUpdated = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const getRankDisplay = (summoner) => {
    if (!summoner.rank_tier || !summoner.rank_division) {
      return 'Unranked'
    }
    return `${summoner.rank_tier} ${summoner.rank_division} (${summoner.league_points || 0} LP)`
  }

  const getRankColor = (tier) => {
    const rankColors = {
      'IRON': '#725A4A',
      'BRONZE': '#CD7F32', 
      'SILVER': '#C0C0C0',
      'GOLD': '#FFD700',
      'PLATINUM': '#40E0D0',
      'DIAMOND': '#6495ED',
      'MASTER': '#9932CC',
      'GRANDMASTER': '#DC143C',
      'CHALLENGER': '#00BFFF'
    }
    return rankColors[tier] || '#a09b8c'
  }

  const filteredAndSortedFavorites = favorites
    .filter(favorite => {
      const summoner = favorite.summoners
      if (!summoner) return false
      
      // Filter by search query
      if (searchQuery && !summoner.summoner_name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      
      // Filter by region
      if (filterRegion !== 'all' && summoner.region !== filterRegion) {
        return false
      }
      
      return true
    })
    .sort((a, b) => {
      const summonerA = a.summoners
      const summonerB = b.summoners
      
      switch (sortBy) {
        case 'name':
          return summonerA.summoner_name.localeCompare(summonerB.summoner_name)
        case 'level':
          return summonerB.summoner_level - summonerA.summoner_level
        case 'rank':
          const rankOrder = ['UNRANKED', 'IRON', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER', 'GRANDMASTER', 'CHALLENGER']
          const rankA = rankOrder.indexOf(summonerA.rank_tier || 'UNRANKED')
          const rankB = rankOrder.indexOf(summonerB.rank_tier || 'UNRANKED')
          if (rankA !== rankB) return rankB - rankA
          return (summonerB.league_points || 0) - (summonerA.league_points || 0)
        case 'recent':
        default:
          return new Date(b.created_at) - new Date(a.created_at)
      }
    })

  if (!user) {
    return (
      <div className="user-favorites">
        <div className="error-state">
          <h2>Sign In Required</h2>
          <p>Please sign in to view and manage your favorite summoners.</p>
          <button onClick={() => onNavigate('signin')}>
            Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="user-favorites">
      <div className="favorites-header">
        <div className="header-content">
          <h1>My Favorites</h1>
          <p>Keep track of your friends and favorite players</p>
        </div>
        <div className="header-actions">
          <button 
            onClick={() => onNavigate('search')} 
            className="add-favorite-btn"
          >
            + Add More Favorites
          </button>
          <button 
            onClick={loadFavorites} 
            className="refresh-all-btn"
            disabled={loading}
          >
            🔄 Refresh All
          </button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="favorites-controls">
        <div className="search-section">
          <input
            type="text"
            placeholder="Search your favorites..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-section">
          <select 
            value={filterRegion} 
            onChange={(e) => setFilterRegion(e.target.value)}
            className="region-filter"
          >
            {regions.map(region => (
              <option key={region.value} value={region.value}>
                {region.label}
              </option>
            ))}
          </select>
          
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value)}
            className="sort-select"
          >
            <option value="recent">Recently Added</option>
            <option value="name">Name (A-Z)</option>
            <option value="level">Level (High to Low)</option>
            <option value="rank">Rank (High to Low)</option>
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="favorites-stats">
        <div className="stat-card">
          <span className="stat-number">{favorites.length}</span>
          <span className="stat-label">Total Favorites</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">{new Set(favorites.map(f => f.summoners?.region)).size}</span>
          <span className="stat-label">Regions</span>
        </div>
        <div className="stat-card">
          <span className="stat-number">
            {favorites.filter(f => f.summoners?.rank_tier && f.summoners.rank_tier !== 'UNRANKED').length}
          </span>
          <span className="stat-label">Ranked Players</span>
        </div>
      </div>

      {error && (
        <div className={`message ${error.includes('Failed') ? 'error-message' : 'success-message'}`}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your favorites...</p>
        </div>
      ) : filteredAndSortedFavorites.length === 0 ? (
        <div className="empty-state">
          {searchQuery || filterRegion !== 'all' ? (
            <>
              <h3>No favorites match your filters</h3>
              <p>Try adjusting your search or region filter.</p>
              <button onClick={() => {
                setSearchQuery('')
                setFilterRegion('all')
              }}>
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <div className="empty-icon">⭐</div>
              <h3>No favorites yet</h3>
              <p>Start building your favorites list by searching for summoners and adding them to your collection.</p>
              <button onClick={() => onNavigate('search')} className="primary-btn">
                Search for Summoners
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="favorites-grid">
          {filteredAndSortedFavorites.map(favorite => {
            const summoner = favorite.summoners
            if (!summoner) return null
            
            const isRefreshing = refreshingIds.has(favorite.summoner_id)
            
            return (
              <div key={favorite.id} className="favorite-card">
                <div className="favorite-header">
                  <div className="summoner-basic-info">
                    <div className="profile-icon">
                      <img 
                        src={`/league_files/15.8.1/img/profileicon/${summoner.profile_icon_id || 1}.png`}
                        alt="Profile Icon"
                        onError={(e) => {
                          e.target.src = '/league_files/img/profileicon/1.png'
                        }}
                      />
                      <span className="summoner-level">{summoner.summoner_level}</span>
                    </div>
                    <div className="summoner-details">
                      <h3 className="summoner-name">{summoner.summoner_name}</h3>
                      <div className="summoner-meta">
                        <span className="region">{summoner.region.toUpperCase()}</span>
                        <span className="separator">•</span>
                        <span className="last-updated">
                          Updated {formatLastUpdated(summoner.last_updated)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleRemoveFavorite(favorite.summoner_id, summoner.summoner_name)}
                    className="remove-btn"
                    title="Remove from favorites"
                  >
                    ×
                  </button>
                </div>

                <div className="rank-info">
                  <div 
                    className="rank-display"
                    style={{ borderColor: getRankColor(summoner.rank_tier) }}
                  >
                    <span 
                      className="rank-text"
                      style={{ color: getRankColor(summoner.rank_tier) }}
                    >
                      {getRankDisplay(summoner)}
                    </span>
                    {summoner.wins && summoner.losses && (
                      <span className="winrate">
                        {Math.round((summoner.wins / (summoner.wins + summoner.losses)) * 100)}% WR
                        ({summoner.wins}W {summoner.losses}L)
                      </span>
                    )}
                  </div>
                </div>

                <div className="favorite-actions">
                  <button 
                    onClick={() => handleViewMatchHistory(favorite)}
                    className="action-btn primary"
                  >
                    📊 Match History
                  </button>
                  <button 
                    onClick={() => handleViewStats(favorite)}
                    className="action-btn secondary"
                  >
                    📈 Statistics
                  </button>
                  <button 
                    onClick={() => handleRefreshSummoner(favorite.summoner_id, summoner.summoner_name)}
                    className={`action-btn refresh ${isRefreshing ? 'refreshing' : ''}`}
                    disabled={isRefreshing}
                    title="Refresh summoner data"
                  >
                    {isRefreshing ? '🔄' : '↻'} 
                    {isRefreshing ? 'Updating...' : 'Refresh'}
                  </button>
                </div>

                <div className="favorite-added">
                  <small>Added to favorites {formatLastUpdated(favorite.created_at)}</small>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick Actions Footer */}
      <div className="favorites-footer">
        <div className="quick-actions">
          <button onClick={() => onNavigate('search')} className="footer-btn">
            🔍 Find More Players
          </button>
          <button onClick={() => onNavigate('home')} className="footer-btn">
            🏠 Home
          </button>
        </div>
        <div className="favorites-tips">
          <h4>💡 Pro Tips:</h4>
          <ul>
            <li>Follow your friends to see when they play</li>
            <li>Track pro players to learn new strategies</li>
            <li>Refresh data to get latest rank and match info</li>
            <li>Use filters to organize large favorites lists</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default UserFavorites