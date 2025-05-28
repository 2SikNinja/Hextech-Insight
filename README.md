# 🏆 Hextech Insight

> **Modern League of Legends statistics and match analysis application**

A comprehensive League of Legends companion app built with React, Vite, and Supabase. Search for any summoner, analyze match history, track performance statistics, and save your favorite players.


## ✨ Features

### 🔍 **Summoner Search**
- Search any player using the **new Riot ID format** (`GameName#TAG`)
- Support for **all League of Legends regions**
- Real-time data from Riot Games API
- Cached results for improved performance

### 📊 **Match History & Analysis**
- **Detailed match history** with comprehensive statistics
- **Champion performance** breakdown with KDA, CS, and damage stats
- **Win/loss tracking** with visual indicators
- **Item builds** and summoner spell analysis
- **Match timeline** and key events (coming soon)

### 📈 **Player Statistics**
- **Performance grades** and skill assessment
- **Champion mastery** statistics and win rates
- **Multikill records** (doubles, triples, quadras, pentas)
- **Comprehensive KDA analysis** with trends
- **Role performance** and preferred positions

### ⭐ **Favorites System**
- **Save favorite players** for quick access
- **Organize by region** and performance
- **Track updates** and rank changes
- **Quick navigation** to saved summoners

### 🔐 **Authentication**
- **Email/password** registration and login
- **Google OAuth** integration for easy sign-in
- **Secure user profiles** with personalized data
- **Password reset** functionality

### 🎨 **Modern UI/UX**
- **Dark theme** optimized for gaming
- **Responsive design** for all screen sizes
- **League of Legends inspired** color scheme
- **Smooth animations** and transitions
- **Mobile-friendly** interface

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16 or higher) - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)
- **Riot Games Account** - [Sign up here](https://signup.leagueoflegends.com/)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/hextech-insight.git
   cd hextech-insight
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Get your Riot API key from https://developer.riotgames.com/
   # Edit .env and add your API key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   Visit http://localhost:5173
   ```

That's it! The database and authentication are already configured. 🎉

## 🔑 Getting Your Riot API Key

1. **Visit the [Riot Developer Portal](https://developer.riotgames.com/)**
2. **Sign in** with your Riot Games account
3. **Generate a Personal API Key** (free, expires every 24 hours)
4. **Copy the key** and paste it in your `.env` file
5. **For production**, apply for a Production API Key

```bash
# Example .env file
VITE_RIOT_API_KEY=RGAPI-12345678-abcd-1234-efgh-123456789012
```

## 🗄️ Database & Authentication

**Good news!** The database and authentication are **already set up and shared**:

- ✅ **No database setup required** - connects to shared Supabase instance
- ✅ **Authentication ready** - create accounts and sign in immediately  
- ✅ **Secure by design** - your data is protected by Row Level Security
- ✅ **Google OAuth configured** - sign in with Google works out of the box

The shared database approach means:
- **Faster setup** for new developers
- **Shared summoner cache** improves performance for everyone
- **Community features** possible in the future
- **Your personal data** (favorites, profile) remains private

## 🛠️ Tech Stack

### Frontend
- **⚛️ React 18** - Modern React with hooks and functional components
- **⚡ Vite** - Fast build tool and dev server
- **🎨 CSS3** - Custom styling with CSS Grid and Flexbox
- **📱 Responsive Design** - Mobile-first approach

### Backend & Database  
- **🗄️ Supabase** - Backend-as-a-Service with PostgreSQL
- **🔐 Supabase Auth** - Authentication with email and OAuth
- **🛡️ Row Level Security** - Database-level security policies
- **🔄 Real-time subscriptions** - Live data updates

### APIs & Services
- **🎮 Riot Games API** - Official League of Legends data
- **🌍 Multi-region support** - All LoL regions supported
- **📊 Match API v5** - Latest match and summoner data
- **⚡ Rate limiting** - Proper API usage with limits

## 📁 Project Structure

```
src/
├── components/           # React components
│   ├── accountCreation.jsx    # User registration
│   ├── matchHistory.jsx       # Match history display
│   ├── playerStats.jsx        # Player statistics
│   ├── specificMatch.jsx      # Detailed match view
│   ├── summonerSearch.jsx     # Search functionality
│   ├── userFavorites.jsx      # Favorites management
│   ├── userSignIn.jsx         # Authentication
│   └── riotNotice.jsx         # Legal notices
├── database/            # API and database services
│   ├── database-service.js    # Supabase operations
│   ├── riot-api-service.js    # Riot API integration
│   ├── champion-service.js    # Champion data
│   └── supabase-client.js     # Supabase configuration
├── styles/              # CSS stylesheets
│   ├── App.css               # Main app styles
│   ├── summonerSearch.css    # Search component styles
│   ├── matchHistory.css      # Match history styles
│   └── [other components].css
└── App.jsx              # Main application component
```

## 🎮 Usage Examples

### Search for a Summoner
```
Format: GameName#TAG
Examples:
  - 2SikNinja#2Sik
  - PlayerName#123
  - GamerTag#ABCD
```

### Supported Regions
- **NA1** - North America
- **EUW1** - Europe West  
- **EUN1** - Europe Nordic & East
- **KR** - Korea
- **JP1** - Japan
- **BR1** - Brazil
- **LA1** - Latin America North
- **LA2** - Latin America South
- **OC1** - Oceania
- **TR1** - Turkey
- **RU** - Russia


## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. **Fork the repository**
2. **Clone your fork:**
   ```bash
   git clone https://github.com/yourusername/hextech-insight.git
   ```
3. **Create a feature branch:**
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Add your Riot API key** to `.env` for testing
5. **Make your changes** and test thoroughly
6. **Commit your changes:**
   ```bash
   git commit -m 'Add some amazing feature'
   ```
7. **Push to your branch:**
   ```bash
   git push origin feature/amazing-feature
   ```
8. **Open a Pull Request** with a clear description

### Development Guidelines

- **Follow React best practices** - hooks, functional components
- **Use consistent naming** - camelCase for variables, PascalCase for components
- **Add comments** for complex logic
- **Test your changes** thoroughly before submitting
- **Responsive design** - ensure mobile compatibility
- **Performance** - optimize API calls and rendering

### Ideas for Contributions

- 🎨 **UI/UX improvements** - better animations, layouts
- 📊 **New statistics** - advanced match analysis
- 🔍 **Search enhancements** - filters, sorting options
- 📱 **Mobile optimization** - native app features
- 🌐 **Internationalization** - multi-language support
- 🎮 **Game mode support** - TFT, Wild Rift integration
- 📈 **Data visualization** - charts and graphs
- 🔔 **Notifications** - rank changes, match updates

## 🆘 Troubleshooting

### Common Issues

**❌ "API key not configured"**
- ✅ Make sure `.env` file exists in project root
- ✅ Verify `VITE_RIOT_API_KEY` is set correctly
- ✅ Restart dev server after changing `.env`
- ✅ Check API key starts with `RGAPI-`

**❌ "Summoner not found"**
- ✅ Use new Riot ID format: `GameName#TAG`
- ✅ Check region matches the account's actual region
- ✅ Verify spelling of game name and tag
- ✅ Try searching in different regions

**❌ "Rate limit exceeded"**
- ✅ Personal API keys have low rate limits
- ✅ Wait a few minutes before making more requests
- ✅ Consider getting a Production API key for higher limits

**❌ "Failed to load match history"**
- ✅ Some older matches may not be available
- ✅ Try refreshing the page
- ✅ Check if summoner has recent matches

**❌ "Sign in not working"**
- ✅ Database should work automatically
- ✅ Try clearing browser cache
- ✅ Check browser console for error messages
- ✅ Try incognito/private browsing mode

**❌ "Can't add to favorites"**
- ✅ Make sure you're signed in
- ✅ Try refreshing and signing in again
- ✅ Check browser permissions


## 🔒 Security & Privacy

### Data Protection
- **✅ Personal data encrypted** - Supabase handles encryption
- **✅ Secure authentication** - Industry-standard practices
- **✅ No sensitive data stored** - Only summoner names and stats
- **✅ Row Level Security** - Database policies protect user data

### API Key Security
- **⚠️ Client-side visibility** - API keys are visible in browser (normal for frontend apps)
- **✅ Rate limiting** - Riot API prevents abuse
- **✅ Gitignore protection** - `.env` files not committed
- **✅ Personal use** - Keys tied to your Riot account

### Privacy Policy
- **Data collected:** Summoner names, match data (public), user favorites
- **Data usage:** Displaying statistics, saving preferences
- **Data sharing:** No personal data shared with third parties
- **Data retention:** Cached match data, user accounts until deletion


### What this means:
- ✅ **Free to use** - personal and commercial use
- ✅ **Modify freely** - adapt for your needs  
- ✅ **Distribute** - share with others
- ✅ **No warranty** - provided as-is

## ⚖️ Legal Disclaimer

Hextech Insight isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. 

**Riot Games, League of Legends**, and all associated properties are trademarks or registered trademarks of **Riot Games, Inc.**

This project is a **fan-made tool** created for the League of Legends community and is not affiliated with, endorsed by, or sponsored by Riot Games.


### Built With
- [React](https://reactjs.org/) - Frontend framework
- [Vite](https://vitejs.dev/) - Build tool and dev server
- [Supabase](https://supabase.com/) - Backend and database
- [Riot Games API](https://developer.riotgames.com/) - Game data

---

<div align="center">

**Made with ❤️ for the League of Legends community**

[⭐ Star this repo](https://github.com/2SikNinja/Hextech-Insight) | [🐛 Report Bug](https://github.com/2SikNinja/Hextech-Insight/issues) | [💡 Request Feature](https://github.com/2SikNinja/Hextech-Insight/issues)

**Happy climbing! 🏆**

</div>