const RIOT_API_KEY = import.meta.env.VITE_RIOT_API_KEY;

// Continental endpoints for Account-V1 API
const CONTINENTAL_ENDPOINTS = {
  'americas': 'https://americas.api.riotgames.com',
  'asia': 'https://asia.api.riotgames.com', 
  'europe': 'https://europe.api.riotgames.com',
  'sea': 'https://sea.api.riotgames.com'
};

// Regional endpoints for Summoner-V4 API
const REGIONAL_ENDPOINTS = {
  'na1': 'https://na1.api.riotgames.com',
  'br1': 'https://br1.api.riotgames.com',
  'la1': 'https://la1.api.riotgames.com',
  'la2': 'https://la2.api.riotgames.com',
  'kr': 'https://kr.api.riotgames.com',
  'jp1': 'https://jp1.api.riotgames.com',
  'euw1': 'https://euw1.api.riotgames.com',
  'eun1': 'https://eun1.api.riotgames.com',
  'tr1': 'https://tr1.api.riotgames.com',
  'ru': 'https://ru.api.riotgames.com',
  'oc1': 'https://oc1.api.riotgames.com'
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
   * Parse Riot ID (e.g., "2SikNinja#Sik" -> {gameName: "2SikNinja", tagLine: "Sik"})
   */
  static parseRiotId(riotId) {
    const parts = riotId.trim().split('#');
    if (parts.length !== 2) {
      throw new Error('Invalid Riot ID format. Please use format: GameName#TAG');
    }
    
    const [gameName, tagLine] = parts;
    if (!gameName || !tagLine) {
      throw new Error('Invalid Riot ID format. Both game name and tag are required.');
    }
    
    return {
      gameName: gameName.trim(),
      tagLine: tagLine.trim()
    };
  }

  /**
   * Make authenticated request to Riot API using query parameter method
   */
  static async makeRequest(url, retries = 3) {
    if (!RIOT_API_KEY || RIOT_API_KEY === 'your_riot_api_key') {
      throw new Error('API key not configured. Please add your Riot API key to the .env file.');
    }

    // Add API key as query parameter
    const separator = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${separator}api_key=${RIOT_API_KEY}`;

    try {
      const response = await fetch(fullUrl);
      
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
   * Get continental endpoint based on region
   */
  static getContinentalEndpoint(region) {
    const continental = REGION_TO_CONTINENTAL[region];
    if (!continental) {
      throw new Error(`Invalid region: ${region}`);
    }
    return CONTINENTAL_ENDPOINTS[continental];
  }

  /**
   * Get account by Riot ID using the working Account-V1 API endpoint
   */
  static async getAccountByRiotId(riotId, region = 'na1') {
    const { gameName, tagLine } = this.parseRiotId(riotId);
    
    // Get the correct continental endpoint for this region
    const continentalEndpoint = this.getContinentalEndpoint(region);
    
    // Build the URL using the working format from your example
    const url = `${continentalEndpoint}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    
    try {
      const account = await this.makeRequest(url);
      console.log('Account data retrieved:', account);
      return account;
    } catch (error) {
      console.error('Error fetching account by Riot ID:', error);
      throw error;
    }
  }

  /**
   * Get summoner by PUUID using Summoner-V4 API
   */
  static async getSummonerByPuuid(puuid, region = 'na1') {
    const endpoint = REGIONAL_ENDPOINTS[region];
    if (!endpoint) {
      throw new Error(`Invalid region: ${region}`);
    }

    const url = `${endpoint}/lol/summoner/v4/summoners/by-puuid/${puuid}`;
    
    try {
      const summoner = await this.makeRequest(url);
      console.log('Summoner data retrieved:', summoner);
      return summoner;
    } catch (error) {
      console.error('Error fetching summoner by PUUID:', error);
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
   * Complete flow: Get summoner by Riot ID
   * This is the main method you'll use for searching
   */
  static async getSummonerByRiotId(riotId, region = 'na1') {
    try {
      console.log(`🔍 Searching for: ${riotId} in region: ${region}`);
      
      // Step 1: Get account info using Riot ID (Account-V1 API)
      console.log('Step 1: Getting account data...');
      const account = await this.getAccountByRiotId(riotId, region);
      
      if (!account.puuid) {
        throw new Error('No PUUID found in account response');
      }
      
      // Step 2: Get summoner info using PUUID (Summoner-V4 API)
      console.log('Step 2: Getting summoner data using PUUID:', account.puuid);
      const summoner = await this.getSummonerByPuuid(account.puuid, region);
      
      // Step 3: Get rank information
      console.log('Step 3: Getting rank data...');
      const rankData = await this.getSummonerRank(summoner.id, region);
      
      // Combine all data into a unified response
      const combinedData = {
        // Account data (from Account-V1)
        puuid: account.puuid,
        gameName: account.gameName,
        tagLine: account.tagLine,
        
        // Summoner data (from Summoner-V4)
        id: summoner.id,
        accountId: summoner.accountId,
        name: summoner.name,
        summonerLevel: summoner.summonerLevel,
        profileIconId: summoner.profileIconId,
        revisionDate: summoner.revisionDate,
        
        // Additional data
        region,
        rankData,
        
        // For backwards compatibility with your existing components
        summoner_name: `${account.gameName}#${account.tagLine}`,
        
        // Full Riot ID format
        riotId: `${account.gameName}#${account.tagLine}`
      };
      
      console.log('✅ Successfully retrieved summoner data:', combinedData);
      return combinedData;
      
    } catch (error) {
      console.error('❌ Error in getSummonerByRiotId:', error);
      throw error;
    }
  }

  /**
   * Get match history by PUUID using Match-V5 API
   */
  static async getMatchHistory(puuid, region = 'na1', count = 20, startTime = null, endTime = null, queue = null) {
    const continentalEndpoint = this.getContinentalEndpoint(region);
    
    // Build query parameters
    const params = new URLSearchParams({
      start: '0',
      count: count.toString()
    });

    if (startTime) params.append('startTime', startTime.toString());
    if (endTime) params.append('endTime', endTime.toString());
    if (queue) params.append('queue', queue.toString());

    const url = `${continentalEndpoint}/lol/match/v5/matches/by-puuid/${puuid}/ids?${params}`;
    
    try {
      console.log(`🔍 Fetching match IDs: ${url}`);
      const matchIds = await this.makeRequest(url);
      console.log(`✅ Retrieved ${matchIds.length} match IDs`);
      return matchIds;
    } catch (error) {
      console.error('Error fetching match history:', error);
      throw error;
    }
  }

  /**
   * Get detailed match information using Match-V5 API
   */
  static async getMatchDetails(matchId, region = 'na1') {
    const continentalEndpoint = this.getContinentalEndpoint(region);
    const url = `${continentalEndpoint}/lol/match/v5/matches/${matchId}`;
    
    try {
      console.log(`🔍 Fetching match details: ${matchId}`);
      const matchData = await this.makeRequest(url);
      console.log(`✅ Retrieved match details for: ${matchId}`);
      return matchData;
    } catch (error) {
      console.error(`Error fetching match details for ${matchId}:`, error);
      throw error;
    }
  }

  /**
   * Search and cache summoner data using Riot ID
   */
  static async searchAndCacheSummoner(riotId, region = 'na1') {
    try {
      // Get summoner data from Riot API using new Riot ID system
      const summonerData = await this.getSummonerByRiotId(riotId, region);
      
      // Format data for database storage
      const dbSummoner = {
        puuid: summonerData.puuid,
        summoner_id: summonerData.id,
        account_id: summonerData.accountId,
        summoner_name: `${summonerData.gameName}#${summonerData.tagLine}`,
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
   * Helper function to validate Riot ID format
   */
  static isValidRiotId(riotId) {
    try {
      this.parseRiotId(riotId);
      return true;
    } catch {
      return false;
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