export class ChampionService {
	static championData = null
	static championList = null
   
	// Load complete champion data from local files
	static async loadChampionData() {
	  if (this.championData) return this.championData
   
	  try {
	    const response = await fetch('/league_files/15.8.1/data/en_US/champion.json')
	    const data = await response.json()
	    this.championData = data.data
	    
	    // Create a simple array of champion names for mock data
	    this.championList = Object.keys(this.championData)
	    
	    console.log(`✅ Loaded ${this.championList.length} champions from local data`)
	    return this.championData
	  } catch (error) {
	    console.error('❌ Failed to load champion data:', error)
	    
	    // Fallback to hardcoded list if local files fail
	    this.championList = [
		 'Aatrox', 'Ahri', 'Akali', 'Alistar', 'Amumu', 'Anivia', 'Annie', 'Ashe',
		 'Azir', 'Bard', 'Blitzcrank', 'Brand', 'Braum', 'Caitlyn', 'Camille', 
		 'Cassiopeia', 'Darius', 'Diana', 'Draven', 'Ekko', 'Elise', 'Ezreal',
		 'Fiora', 'Fizz', 'Garen', 'Graves', 'Irelia', 'Janna', 'JarvanIV',
		 'Jax', 'Jinx', 'Karma', 'Katarina', 'Kayle', 'Leblanc', 'LeeSin',
		 'Leona', 'Lux', 'Malphite', 'Morgana', 'Nasus', 'Orianna', 'Riven',
		 'Thresh', 'Tristana', 'Twisted Fate', 'Vayne', 'Veigar', 'Vi', 'Yasuo'
	    ]
	    
	    return {}
	  }
	}
   
	// Get random champion name for mock data
	static async getRandomChampion() {
	  if (!this.championList) {
	    await this.loadChampionData()
	  }
	  
	  const randomIndex = Math.floor(Math.random() * this.championList.length)
	  return this.championList[randomIndex]
	}
   
	// Get multiple random champions
	static async getRandomChampions(count = 10) {
	  if (!this.championList) {
	    await this.loadChampionData()
	  }
	  
	  const shuffled = [...this.championList].sort(() => 0.5 - Math.random())
	  return shuffled.slice(0, count)
	}
   
	// Get champion by name
	static async getChampionByName(championName) {
	  const data = await this.loadChampionData()
	  return data[championName] || null
	}
   
	// Get champion by ID
	static async getChampionById(championId) {
	  const data = await this.loadChampionData()
	  return Object.values(data).find(champ => 
	    parseInt(champ.key) === parseInt(championId)
	  ) || null
	}
   
	// Get all champions for autocomplete/search
	static async getAllChampions() {
	  const data = await this.loadChampionData()
	  return Object.values(data).map(champ => ({
	    id: champ.key,
	    name: champ.name,
	    title: champ.title,
	    tags: champ.tags,
	    image: `/league_files/15.8.1/img/champion/${champ.name}.png`
	  }))
	}
   
	// Get champions by role
	static async getChampionsByRole(role) {
	  const data = await this.loadChampionData()
	  const roleMap = {
	    'TOP': ['Fighter', 'Tank'],
	    'JUNGLE': ['Assassin', 'Fighter'],
	    'MIDDLE': ['Mage', 'Assassin'],
	    'BOTTOM': ['Marksman'],
	    'UTILITY': ['Support']
	  }
	  
	  const roleTags = roleMap[role] || []
	  return Object.values(data).filter(champ => 
	    champ.tags.some(tag => roleTags.includes(tag))
	  )
	}
   
	// Generate realistic team composition
	static async generateRealisticTeamComp() {
	  const roles = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
	  const team = []
	  
	  for (const role of roles) {
	    const roleChampions = await this.getChampionsByRole(role)
	    if (roleChampions.length > 0) {
		 const randomChampion = roleChampions[Math.floor(Math.random() * roleChampions.length)]
		 team.push({
		   champion: randomChampion.name,
		   role: role,
		   id: randomChampion.key
		 })
	    } else {
		 // Fallback to any champion
		 const randomChampion = await this.getRandomChampion()
		 team.push({
		   champion: randomChampion,
		   role: role,
		   id: Math.floor(Math.random() * 160) + 1
		 })
	    }
	  }
	  
	  return team
	}
   
	// Get champion image URL
	static getChampionImageUrl(championName) {
	  return `/league_files/15.8.1/img/champion/${championName}.png`
	}
   
	// Get champion splash art URL  
	static getChampionSplashUrl(championName, skinNum = 0) {
	  return `/league_files/15.8.1/img/champion/splash/${championName}_${skinNum}.jpg`
	}
   
	// Search champions by name (for autocomplete)
	static async searchChampions(query) {
	  if (!query || query.length < 2) return []
	  
	  const allChampions = await this.getAllChampions()
	  const lowercaseQuery = query.toLowerCase()
	  
	  return allChampions.filter(champ =>
	    champ.name.toLowerCase().includes(lowercaseQuery) ||
	    champ.title.toLowerCase().includes(lowercaseQuery)
	  ).slice(0, 10) // Limit to 10 results
	}
   }