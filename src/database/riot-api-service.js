const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;

// API Base URLs for different regions
const REGIONAL_ENDPOINTS = {
  // Americas
  'na1': 'https://na1.api.riotgames.com',
  'br1': 'https://br1.api.riotgames.com',
  'la1': 'https://la1.api.riotgames.com',
  'la2': 'https://la2.api.riotgames.com',
  
  // Asia
  'kr': 'https://kr.api.riotgames.com',
  'jp1': 'https://jp1.api.riotgames.com',
  
  // Europe
  'euw1': 'https://euw1.api.riotgames.com',
  'eun1': 'https://eun1.api.riotgames.com',
  'tr1': 'https://tr1.api.riotgames.com',
  'ru': 'https://ru.api.riotgames.com',
  
  // Oceania
  'oc1': 'https://oc1.api.riotgames.com'
};

// Regional routing values for match data
const CONTINENTAL_ENDPOINTS = {
  'americas': 'https://americas.api.riotgames.com',
  'asia': 'https://asia.api.riotgames.com',
  'europe': 'https://europe.api.riotgames.com',
  'sea': 'https://sea.api.riotgames.com'
};

// Map regions to continental routing
const REGION_TO_CONTINENTAL = {
  'na1': 'americas',
  'br1': 'americas', 
  'la1': 'americas',
  'la2': 'americas',
  'kr': 'asia',
  'jp1': 'asia',
  'euw1': 'europe',
  'eun1': 'europe',
  'tr1': 'europe',
  'ru': 'europe',
  'oc1': 'sea'
};

export class RiotApiService {
  
  /**
   * Make authenticated request to Riot API
   */
  static async makeRequest(url, retries = 3) {
    if (!RIOT_API_KEY || RIOT_API_KEY === 'your_riot_api_key') {
      throw new Error('Riot API key not configured. Please add your API key to the .env file.');
    }

    const headers = {
      'X-Riot-Token': RIOT_API_KEY,
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(url, { headers });
      
      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After') || 1;
        console.log(`Rate limited. Retrying after ${retryAfter} seconds...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        
        if (retries > 0) {
          return this.makeRequest(url, retries - 1);
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      // Handle other HTTP errors
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Summoner not found');
        }
        if (response.status === 403) {
          throw new Error('API key invalid or expired');
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection.');
      }
      throw error;
    }
  }

  /**
   * Get summoner by name and region
   */
  static async getSummonerByName(summonerName, region = 'na1') {
    const endpoint = REGIONAL_ENDPOINTS[region];
    if (!endpoint) {
      throw new Error(`Invalid region: ${region}`);
    }

    const encodedName = encodeURIComponent(summonerName);
    const url = `${endpoint}/lol/summoner/v4/summoners/by-name/${encodedName}`;
    
    try {
      const summoner = await this.makeRequest(url);
      
      // Get rank information
      const rankData = await this.getSummonerRank(summoner.id, region);
      
      return {
        ...summoner,
        region,
        rankData
      };
    } catch (error) {
      console.error('Error fetching summoner:', error);
      throw error;
    }
  }

  /**
   * Get summoner rank information
   */
  static async getSummonerRank(summonerId, region = 'na1') {
    const endpoint = REGIONAL_ENDPOINTS[region];
    const url = `${endpoint}/lol/league/v4/entries/by-summoner/${summonerId}`;
    
    try {
      const rankEntries = await this.makeRequest(url);
      
      // Find ranked solo queue entry
      const soloQueue = rankEntries.find(entry => entry.queueType === 'RANKED_SOLO_5x5');
      const flexQueue = rankEntries.find(entry => entry.queueType === 'RANKED_FLEX_SR');
      
      return {
        soloQueue,
        flexQueue,
        rankEntries
      };
    } catch (error) {
      console.error('Error fetching rank:', error);
      return { soloQueue: null, flexQueue: null, rankEntries: [] };
    }
  }

  /**
   * Get match history by PUUID
   */
  static async getMatchHistory(puuid, region = 'na1', count = 20, startTime = null, endTime = null, queue = null) {
    const continentalRegion = REGION_TO_CONTINENTAL[region];
    const endpoint = CONTINENTAL_ENDPOINTS[continentalRegion];
    
    if (!endpoint) {
      throw new Error(`Invalid region for match data: ${region}`);
    }

    // Build query parameters
    const params = new URLSearchParams({
      start: '0',
      count: count.toString()
    });

    if (startTime) params.append('startTime', startTime.toString());
    if (endTime) params.append('endTime', endTime.toString());
    if (queue) params.append('queue', queue.toString());

    const url = `${endpoint}/lol/match/v5/matches/by-puuid/${puuid}/ids?${params}`;
    
    try {
      return await this.makeRequest(url);
    } catch (error) {
      console.error('Error fetching match history:', error);
      throw error;
    }
  }

  /**
   * Get detailed match information
   */
  static async getMatchDetails(matchId, region = 'na1') {
    const continentalRegion = REGION_TO_CONTINENTAL[region];
    const endpoint = CONTINENTAL_ENDPOINTS[continentalRegion];
    
    const url = `${endpoint}/lol/match/v5/matches/${matchId}`;
    
    try {
      return await this.makeRequest(url);
    } catch (error) {
      console.error('Error fetching match details:', error);
      throw error;
    }
  }

  /**
   * Get match timeline
   */
  static async getMatchTimeline(matchId, region = 'na1') {
    const continentalRegion = REGION_TO_CONTINENTAL[region];
    const endpoint = CONTINENTAL_ENDPOINTS[continentalRegion];
    
    const url = `${endpoint}/lol/match/v5/matches/${matchId}/timeline`;
    
    try {
      return await this.makeRequest(url);
    } catch (error) {
      console.error('Error fetching match timeline:', error);
      throw error;
    }
  }

  /**
   * Get current game information
   */
  static async getCurrentGame(summonerId, region = 'na1') {
    const endpoint = REGIONAL_ENDPOINTS[region];
    const url = `${endpoint}/lol/spectator/v4/active-games/by-summoner/${summonerId}`;
    
    try {
      return await this.makeRequest(url);
    } catch (error) {
      if (error.message.includes('404')) {
        return null; // Not currently in game
      }
      throw error;
    }
  }

  /**
   * Get champion mastery for summoner
   */
  static async getChampionMastery(summonerId, region = 'na1', championId = null) {
    const endpoint = REGIONAL_ENDPOINTS[region];
    
    let url;
    if (championId) {
      url = `${endpoint}/lol/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}/by-champion/${championId}`;
    } else {
      url = `${endpoint}/lol/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}`;
    }
    
    try {
      return await this.makeRequest(url);
    } catch (error) {
      console.error('Error fetching champion mastery:', error);
      throw error;
    }
  }

  /**
   * Get top champion masteries for summoner
   */
  static async getTopChampionMasteries(summonerId, region = 'na1', count = 3) {
    const endpoint = REGIONAL_ENDPOINTS[region];
    const url = `${endpoint}/lol/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}/top?count=${count}`;
    
    try {
      return await this.makeRequest(url);
    } catch (error) {
      console.error('Error fetching top champion masteries:', error);
      throw error;
    }
  }

  /**
   * Search and cache summoner data
   */
  static async searchAndCacheSummoner(summonerName, region = 'na1') {
    try {
      // Get summoner data from Riot API
      const summonerData = await this.getSummonerByName(summonerName, region);
      
      // Format data for database
      const dbSummoner = {
        puuid: summonerData.puuid,
        summoner_id: summonerData.id,
        account_id: summonerData.accountId,
        summoner_name: summonerData.name,
        summoner_level: summonerData.summonerLevel,
        profile_icon_id: summonerData.profileIconId,
        region: region,
        rank_tier: summonerData.rankData?.soloQueue?.tier || null,
        rank_division: summonerData.rankData?.soloQueue?.rank || null,
        league_points: summonerData.rankData?.soloQueue?.leaguePoints || 0,
        wins: summonerData.rankData?.soloQueue?.wins || 0,
        losses: summonerData.rankData?.soloQueue?.losses || 0,
        last_updated: new Date().toISOString()
      };

      return dbSummoner;
    } catch (error) {
      console.error('Error searching and caching summoner:', error);
      throw error;
    }
  }

  /**
   * Get and format match data for database storage
   */
  static async getAndFormatMatch(matchId, region = 'na1') {
    try {
      const matchData = await this.getMatchDetails(matchId, region);
      
      // Format match data for database
      const dbMatch = {
        match_id: matchData.metadata.matchId,
        game_creation: matchData.info.gameCreation,
        game_duration: matchData.info.gameDuration,
        game_end_timestamp: matchData.info.gameEndTimestamp,
        game_mode: matchData.info.gameMode,
        game_type: matchData.info.gameType,
        game_version: matchData.info.gameVersion,
        map_id: matchData.info.mapId,
        platform_id: matchData.info.platformId,
        queue_id: matchData.info.queueId,
        tournament_code: matchData.info.tournamentCode || null
      };

      // Format participants data
      const dbParticipants = matchData.info.participants.map(participant => ({
        puuid: participant.puuid,
        participant_id: participant.participantId,
        team_id: participant.teamId,
        champion_id: participant.championId,
        champion_name: participant.championName,
        champion_level: participant.champLevel,
        kills: participant.kills,
        deaths: participant.deaths,
        assists: participant.assists,
        gold_earned: participant.goldEarned,
        total_damage_dealt: participant.totalDamageDealt,
        total_damage_dealt_to_champions: participant.totalDamageDealtToChampions,
        total_damage_taken: participant.totalDamageTaken,
        total_heal: participant.totalHeal,
        total_minions_killed: participant.totalMinionsKilled,
        neutral_minions_killed: participant.neutralMinionsKilled,
        vision_score: participant.visionScore,
        wards_placed: participant.wardsPlaced,
        wards_killed: participant.wardsKilled,
        item0: participant.item0,
        item1: participant.item1,
        item2: participant.item2,
        item3: participant.item3,
        item4: participant.item4,
        item5: participant.item5,
        item6: participant.item6,
        summoner1_id: participant.summoner1Id,
        summoner2_id: participant.summoner2Id,
        primary_rune_tree: participant.perks?.styles?.[0]?.style || 0,
        secondary_rune_tree: participant.perks?.styles?.[1]?.style || 0,
        win: participant.win,
        team_position: participant.teamPosition,
        lane: participant.lane,
        role: participant.role,
        first_blood_kill: participant.firstBloodKill,
        first_tower_kill: participant.firstTowerKill,
        double_kills: participant.doubleKills,
        triple_kills: participant.tripleKills,
        quadra_kills: participant.quadraKills,
        penta_kills: participant.pentaKills
      }));

      return { match: dbMatch, participants: dbParticipants };
    } catch (error) {
      console.error('Error getting and formatting match:', error);
      throw error;
    }
  }

  /**
   * Helper function to validate region
   */
  static isValidRegion(region) {
    return Object.keys(REGIONAL_ENDPOINTS).includes(region);
  }

  /**
   * Helper function to get all supported regions
   */
  static getSupportedRegions() {
    return Object.keys(REGIONAL_ENDPOINTS);
  }

  /**
   * Helper function to format queue names
   */
  static getQueueName(queueId) {
    const queueMap = {
      400: 'Normal Draft',
      420: 'Ranked Solo',
      430: 'Normal Blind',
      440: 'Ranked Flex',
      450: 'ARAM',
      700: 'Clash',
      900: 'URF',
      1020: 'One for All',
      1300: 'Nexus Blitz',
      1400: 'Ultimate Spellbook'
    };
    
    return queueMap[queueId] || 'Unknown Queue';
  }
}