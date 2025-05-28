export class ChampionDataService {
	static championData = null
	static itemData = null
	static spellData = null
   
	// Load champion data from local files
	static async loadChampionData() {
	  if (this.championData) return this.championData
   
	  try {
	    const response = await fetch('/league_files/15.8.1/data/en_US/champion.json')
	    const data = await response.json()
	    this.championData = data.data
	    return this.championData
	  } catch (error) {
	    console.error('Failed to load champion data:', error)
	    return {}
	  }
	}
   
	// Load item data
	static async loadItemData() {
	  if (this.itemData) return this.itemData
   
	  try {
	    const response = await fetch('/league_files/15.8.1/data/en_US/item.json')
	    const data = await response.json()
	    this.itemData = data.data
	    return this.itemData
	  } catch (error) {
	    console.error('Failed to load item data:', error)
	    return {}
	  }
	}
   
	// Load summoner spell data
	static async loadSpellData() {
	  if (this.spellData) return this.spellData
   
	  try {
	    const response = await fetch('/league_files/15.8.1/data/en_US/summoner.json')
	    const data = await response.json()
	    this.spellData = data.data
	    return this.spellData
	  } catch (error) {
	    console.error('Failed to load spell data:', error)
	    return {}
	  }
	}
   
	// Get champion by ID
	static async getChampionById(championId) {
	  const champions = await this.loadChampionData()
	  return Object.values(champions).find(champ => 
	    parseInt(champ.key) === parseInt(championId)
	  )
	}
   
	// Get champion by name
	static async getChampionByName(championName) {
	  const champions = await this.loadChampionData()
	  return champions[championName] || null
	}
   
	// Get item by ID
	static async getItemById(itemId) {
	  const items = await this.loadItemData()
	  return items[itemId.toString()] || null
	}
   
	// Get summoner spell by ID
	static async getSpellById(spellId) {
	  const spells = await this.loadSpellData()
	  return Object.values(spells).find(spell => 
	    parseInt(spell.key) === parseInt(spellId)
	  )
	}
   
	// Get champion icon URL
	static getChampionIconUrl(championName) {
	  return `/league_files/15.8.1/img/champion/${championName}.png`
	}
   
	// Get item icon URL
	static getItemIconUrl(itemId) {
	  return `/league_files/15.8.1/img/item/${itemId}.png`
	}
   
	// Get spell icon URL
	static getSpellIconUrl(spellId) {
	  return `/league_files/15.8.1/img/spell/Summoner${spellId}.png`
	}
   
	// Get profile icon URL
	static getProfileIconUrl(iconId) {
	  return `/league_files/15.8.1/img/profileicon/${iconId}.png`
	}
   
	// Get all champions for search/autocomplete
	static async getAllChampions() {
	  const champions = await this.loadChampionData()
	  return Object.values(champions).map(champ => ({
	    id: champ.key,
	    name: champ.name,
	    title: champ.title,
	    tags: champ.tags
	  }))
	}
   }