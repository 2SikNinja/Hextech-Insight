import supabase from './supabase-client.js'

export class DatabaseService {
  // =============================================
  // AUTHENTICATION METHODS
  // =============================================
  
  static async signUp(email, password, username) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username: username,
            full_name: username
          }
        }
      })
      
      if (error) throw error
      
      // The user profile will be created automatically by the database trigger
      console.log('✅ Sign up successful:', data)
      return { data, error: null }
    } catch (error) {
      console.error('❌ Sign up error:', error)
      return { data: null, error }
    }
  }

  static async signIn(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      console.log('✅ Sign in successful:', data)
      return { data, error: null }
    } catch (error) {
      console.error('❌ Sign in error:', error)
      return { data: null, error }
    }
  }

  static async signInWithGoogle() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      })
      
      if (error) throw error
      
      console.log('✅ Google sign in initiated:', data)
      return { data, error: null }
    } catch (error) {
      console.error('❌ Google sign in error:', error)
      return { data: null, error }
    }
  }

  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) throw error
      
      console.log('✅ Sign out successful')
      return { error: null }
    } catch (error) {
      console.error('❌ Sign out error:', error)
      return { error }
    }
  }

  static async getCurrentUser() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      
      if (error) throw error
      
      return user
    } catch (error) {
      console.error('❌ Get current user error:', error)
      return null
    }
  }

  static async resetPassword(email) {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      
      if (error) throw error
      
      return { data, error: null }
    } catch (error) {
      console.error('❌ Reset password error:', error)
      return { data: null, error }
    }
  }

  // =============================================
  // USER PROFILE METHODS
  // =============================================
  
  static async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('❌ Get user profile error:', error)
      return { data: null, error }
    }
  }

  static async updateUserProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('❌ Update user profile error:', error)
      return { data: null, error }
    }
  }

  // =============================================
  // SUMMONER METHODS
  // =============================================
  
  static async searchSummoner(riotId, region = 'na1') {
    try {
      const { data, error } = await supabase
        .from('summoners')
        .select('*')
        .eq('summoner_name', riotId)
        .eq('region', region)
        .single()
      
      return { data, error }
    } catch (error) {
      // Not finding a summoner is expected, so don't log as error
      return { data: null, error }
    }
  }

  static async createOrUpdateSummoner(summonerData) {
    try {
      const { data, error } = await supabase
        .from('summoners')
        .upsert(summonerData, { 
          onConflict: 'puuid',
          ignoreDuplicates: false 
        })
        .select()
        .single()
      
      if (error) throw error
      
      console.log('✅ Summoner saved/updated:', data)
      return { data, error: null }
    } catch (error) {
      console.error('❌ Create/update summoner error:', error)
      return { data: null, error }
    }
  }

  static async refreshSummonerData(summonerId) {
    try {
      // This would typically fetch fresh data from Riot API
      // For now, just update the last_updated timestamp
      const { data, error } = await supabase
        .from('summoners')
        .update({ 
          last_updated: new Date().toISOString() 
        })
        .eq('id', summonerId)
        .select()
        .single()
      
      return { data, error }
    } catch (error) {
      console.error('❌ Refresh summoner data error:', error)
      return { data: null, error }
    }
  }

  // =============================================
  // MATCH HISTORY METHODS
  // =============================================
  
  static async getMatchHistory(summonerId, limit = 20) {
    try {
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
    } catch (error) {
      console.error('❌ Get match history error:', error)
      return { data: null, error }
    }
  }

  static async getSpecificMatch(matchId) {
    try {
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
    } catch (error) {
      console.error('❌ Get specific match error:', error)
      return { data: null, error }
    }
  }

  static async saveMatch(matchData, participantsData) {
    try {
      // Start a transaction by inserting match first
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .upsert(matchData, { onConflict: 'match_id' })
        .select()
        .single()

      if (matchError) throw matchError

      // Save participants with the match ID
      const participantsWithMatchId = participantsData.map(p => ({
        ...p,
        match_id: match.id
      }))

      const { data: participants, error: participantsError } = await supabase
        .from('match_participants')
        .upsert(participantsWithMatchId, { 
          onConflict: 'match_id,participant_id' 
        })
        .select()

      if (participantsError) throw participantsError

      return { data: { match, participants }, error: null }
    } catch (error) {
      console.error('❌ Save match error:', error)
      return { data: null, error }
    }
  }

  // =============================================
  // PLAYER STATS METHODS
  // =============================================
  
  static async getPlayerStats(summonerId) {
    try {
      const { data, error } = await supabase
        .from('match_participants')
        .select('kills, deaths, assists, win, champion_name, gold_earned, total_damage_dealt_to_champions')
        .eq('summoner_id', summonerId)
      
      if (error) throw error

      if (!data || data.length === 0) {
        return { data: null, error: null }
      }

      // Calculate comprehensive stats
      const totalGames = data.length
      const wins = data.filter(match => match.win).length
      const winRate = totalGames > 0 ? (wins / totalGames * 100).toFixed(1) : 0
      
      const avgStats = data.reduce((acc, match) => {
        acc.kills += match.kills || 0
        acc.deaths += match.deaths || 0
        acc.assists += match.assists || 0
        acc.gold += match.gold_earned || 0
        acc.damage += match.total_damage_dealt_to_champions || 0
        return acc
      }, { kills: 0, deaths: 0, assists: 0, gold: 0, damage: 0 })

      // Calculate champion stats
      const championMap = {}
      data.forEach(match => {
        const champ = match.champion_name
        if (!championMap[champ]) {
          championMap[champ] = {
            games: 0,
            wins: 0,
            kills: 0,
            deaths: 0,
            assists: 0,
            gold: 0,
            damage: 0
          }
        }
        
        championMap[champ].games++
        if (match.win) championMap[champ].wins++
        championMap[champ].kills += match.kills || 0
        championMap[champ].deaths += match.deaths || 0
        championMap[champ].assists += match.assists || 0
        championMap[champ].gold += match.gold_earned || 0
        championMap[champ].damage += match.total_damage_dealt_to_champions || 0
      })

      const championStats = Object.entries(championMap)
        .map(([name, stats]) => ({
          championName: name,
          games: stats.games,
          wins: stats.wins,
          winRate: parseFloat((stats.wins / stats.games * 100).toFixed(1)),
          avgKills: parseFloat((stats.kills / stats.games).toFixed(1)),
          avgDeaths: parseFloat((stats.deaths / stats.games).toFixed(1)),
          avgAssists: parseFloat((stats.assists / stats.games).toFixed(1)),
          kda: parseFloat(((stats.kills + stats.assists) / Math.max(stats.deaths, 1) / stats.games).toFixed(2)),
          avgGold: Math.floor(stats.gold / stats.games),
          avgDamage: Math.floor(stats.damage / stats.games)
        }))
        .sort((a, b) => b.games - a.games)

      const finalStats = {
        totalGames,
        wins,
        losses: totalGames - wins,
        winRate: parseFloat(winRate),
        avgKills: totalGames > 0 ? parseFloat((avgStats.kills / totalGames).toFixed(1)) : 0,
        avgDeaths: totalGames > 0 ? parseFloat((avgStats.deaths / totalGames).toFixed(1)) : 0,
        avgAssists: totalGames > 0 ? parseFloat((avgStats.assists / totalGames).toFixed(1)) : 0,
        kda: totalGames > 0 ? parseFloat(((avgStats.kills + avgStats.assists) / Math.max(avgStats.deaths, 1) / totalGames).toFixed(2)) : 0,
        avgGold: totalGames > 0 ? Math.floor(avgStats.gold / totalGames) : 0,
        avgDamage: totalGames > 0 ? Math.floor(avgStats.damage / totalGames) : 0,
        championStats: championStats.slice(0, 10) // Top 10 champions
      }

      return { data: finalStats, error: null }
    } catch (error) {
      console.error('❌ Get player stats error:', error)
      return { data: null, error }
    }
  }

  // =============================================
  // USER FAVORITES METHODS
  // =============================================
  
  static async getUserFavorites(userId) {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select(`
          *,
          summoners (
            id,
            summoner_name,
            summoner_level,
            profile_icon_id,
            region,
            rank_tier,
            rank_division,
            league_points,
            wins,
            losses,
            last_updated
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      console.log('✅ Retrieved user favorites:', data?.length || 0, 'favorites')
      return { data, error: null }
    } catch (error) {
      console.error('❌ Get user favorites error:', error)
      return { data: null, error }
    }
  }

  static async addToFavorites(userId, summonerId) {
    try {
      // Check if already favorited
      const { data: existing } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('summoner_id', summonerId)
        .single()
      
      if (existing) {
        return { data: existing, error: { message: 'Already in favorites' } }
      }

      const { data, error } = await supabase
        .from('user_favorites')
        .insert({
          user_id: userId,
          summoner_id: summonerId
        })
        .select(`
          *,
          summoners (
            summoner_name,
            summoner_level,
            region
          )
        `)
        .single()
      
      if (error) throw error
      
      console.log('✅ Added to favorites:', data)
      return { data, error: null }
    } catch (error) {
      console.error('❌ Add to favorites error:', error)
      return { data: null, error }
    }
  }

  static async removeFromFavorites(userId, summonerId) {
    try {
      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('summoner_id', summonerId)
      
      if (error) throw error
      
      console.log('✅ Removed from favorites')
      return { error: null }
    } catch (error) {
      console.error('❌ Remove from favorites error:', error)
      return { error }
    }
  }

  static async isFavorite(userId, summonerId) {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('summoner_id', summonerId)
        .single()
      
      // No error means we found a record (is favorited)
      // Error means no record found (not favorited)
      return { isFavorite: !!data && !error, error: null }
    } catch (error) {
      // This is expected when not favorited, so don't log as error
      return { isFavorite: false, error: null }
    }
  }

  // =============================================
  // REAL-TIME SUBSCRIPTIONS
  // =============================================
  
  static subscribeToUserFavorites(userId, callback) {
    return supabase
      .channel(`user_favorites_${userId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'user_favorites',
        filter: `user_id=eq.${userId}`
      }, callback)
      .subscribe()
  }

  static subscribeToAuthChanges(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }

  // =============================================
  // UTILITY METHODS
  // =============================================
  
  static async testConnection() {
    try {
      const { data, error } = await supabase
        .from('summoners')
        .select('count')
        .limit(1)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error
      }
      
      console.log('✅ Database connection successful')
      return { connected: true, error: null }
    } catch (error) {
      console.error('❌ Database connection failed:', error)
      return { connected: false, error }
    }
  }

  static getSupabaseClient() {
    return supabase
  }
}