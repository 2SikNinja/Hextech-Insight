import supabase from './supabase-client.js'

export class DatabaseService {
  // Authentication methods
  static async signUp(email, password, username) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username
        }
      }
    })
    return { data, error }
  }

  static async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  }

  static async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  static async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    return user
  }

  // Summoner methods
  static async searchSummoner(riotId, region = 'na1') {
    // Search by the full Riot ID (GameName#TAG format)
    const { data, error } = await supabase
      .from('summoners')
      .select('*')
      .eq('summoner_name', riotId)
      .eq('region', region)
      .single()
    
    return { data, error }
  }

  static async createOrUpdateSummoner(summonerData) {
    const { data, error } = await supabase
      .from('summoners')
      .upsert(summonerData, { onConflict: 'puuid' })
      .select()
      .single()
    
    return { data, error }
  }

  // Match History methods
  static async getMatchHistory(summonerId, limit = 20) {
    const { data, error } = await supabase
      .from('match_participants')
      .select(`
        *,
        matches (
          match_id,
          game_creation,
          game_duration,
          game_mode,
          queue_id
        )
      `)
      .eq('summoner_id', summonerId)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    return { data, error }
  }

  static async getSpecificMatch(matchId) {
    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        match_participants (
          *,
          summoners (summoner_name, summoner_level)
        )
      `)
      .eq('match_id', matchId)
      .single()
    
    return { data, error }
  }

  static async saveMatch(matchData, participantsData) {
    // Start a transaction
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .upsert(matchData, { onConflict: 'match_id' })
      .select()
      .single()

    if (matchError) return { data: null, error: matchError }

    // Save participants
    const participantsWithMatchId = participantsData.map(p => ({
      ...p,
      match_id: match.id
    }))

    const { data: participants, error: participantsError } = await supabase
      .from('match_participants')
      .upsert(participantsWithMatchId)
      .select()

    return { data: { match, participants }, error: participantsError }
  }

  // Player Stats methods
  static async getPlayerStats(summonerId) {
    const { data, error } = await supabase
      .from('match_participants')
      .select('kills, deaths, assists, win, champion_name')
      .eq('summoner_id', summonerId)
    
    if (error) return { data: null, error }

    // Calculate stats
    const totalGames = data.length
    const wins = data.filter(match => match.win).length
    const winRate = totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : 0
    
    const avgStats = data.reduce((acc, match) => {
      acc.kills += match.kills
      acc.deaths += match.deaths
      acc.assists += match.assists
      return acc
    }, { kills: 0, deaths: 0, assists: 0 })

    const stats = {
      totalGames,
      wins,
      losses: totalGames - wins,
      winRate: parseFloat(winRate),
      avgKills: totalGames > 0 ? (avgStats.kills / totalGames).toFixed(1) : 0,
      avgDeaths: totalGames > 0 ? (avgStats.deaths / totalGames).toFixed(1) : 0,
      avgAssists: totalGames > 0 ? (avgStats.assists / totalGames).toFixed(1) : 0,
      kda: totalGames > 0 ? ((avgStats.kills + avgStats.assists) / Math.max(avgStats.deaths, 1) / totalGames).toFixed(2) : 0
    }

    return { data: stats, error: null }
  }

  // User Favorites methods
  static async getUserFavorites(userId) {
    const { data, error } = await supabase
      .from('user_favorites')
      .select(`
        *,
        summoners (
          summoner_name,
          summoner_level,
          region,
          last_updated
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    return { data, error }
  }

  static async addToFavorites(userId, summonerId) {
    const { data, error } = await supabase
      .from('user_favorites')
      .insert({
        user_id: userId,
        summoner_id: summonerId
      })
      .select()
      .single()
    
    return { data, error }
  }

  static async removeFromFavorites(userId, summonerId) {
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', userId)
      .eq('summoner_id', summonerId)
    
    return { error }
  }

  static async isFavorite(userId, summonerId) {
    const { data, error } = await supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('summoner_id', summonerId)
      .single()
    
    return { isFavorite: !!data, error }
  }

  // Real-time subscriptions
  static subscribeToUserFavorites(userId, callback) {
    return supabase
      .channel('user_favorites')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_favorites',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe()
  }
}