import './styles/riotNotice.css'

function RiotNotice() {
  return (
    <div className="riot-notice">
      <div className="notice-container">
        <h1>Legal Notice & Disclaimers</h1>
        
        <section className="riot-disclaimer">
          <h2>Riot Games Disclaimer</h2>
          <p className="disclaimer-text">
            <strong>Hextech Insight</strong> isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games 
            or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated 
            properties are trademarks or registered trademarks of Riot Games, Inc.
          </p>
        </section>

        <section className="api-usage">
          <h2>Riot API Usage</h2>
          <p>
            This application uses the Riot Games API to provide League of Legends match data and player statistics. 
            All data is sourced directly from Riot's official API and is subject to their terms of service and data policies.
          </p>
          <p>
            We comply with Riot Games' API Terms of Service and Rate Limiting policies to ensure fair usage of their services.
          </p>
        </section>

        <section className="data-usage">
          <h2>Data Usage & Privacy</h2>
          <div className="data-points">
            <h3>What data we collect:</h3>
            <ul>
              <li>Summoner names and game statistics (publicly available through Riot API)</li>
              <li>Match history and performance data</li>
              <li>User account information (email, username) for registered users</li>
              <li>User preferences and favorites</li>
            </ul>
            
            <h3>How we use your data:</h3>
            <ul>
              <li>To provide match history and statistics</li>
              <li>To save your favorite summoners and preferences</li>
              <li>To improve our service and user experience</li>
            </ul>
            
            <h3>Data retention:</h3>
            <ul>
              <li>Match data is cached temporarily to improve performance</li>
              <li>User accounts and preferences are stored until account deletion</li>
              <li>All data can be deleted upon user request</li>
            </ul>
          </div>
        </section>

        <section className="third-party">
          <h2>Third-Party Services</h2>
          <p>
            This application integrates with the following third-party services:
          </p>
          <ul>
            <li><strong>Riot Games API:</strong> For League of Legends game data</li>
            <li><strong>Supabase:</strong> For database and authentication services</li>
          </ul>
          <p>
            Each service has its own privacy policy and terms of service that apply to their respective data handling.
          </p>
        </section>

        <section className="user-responsibilities">
          <h2>User Responsibilities</h2>
          <div className="responsibilities">
            <h3>Acceptable Use:</h3>
            <ul>
              <li>Use the service for legitimate purposes only</li>
              <li>Do not attempt to circumvent rate limits or API restrictions</li>
              <li>Respect other players' privacy and data</li>
              <li>Do not use the service for harassment or toxic behavior</li>
            </ul>
            
            <h3>Account Security:</h3>
            <ul>
              <li>Keep your login credentials secure</li>
              <li>Report any unauthorized access immediately</li>
              <li>Use strong, unique passwords</li>
            </ul>
          </div>
        </section>

        <section className="limitations">
          <h2>Service Limitations</h2>
          <p>
            <strong>Hextech Insight</strong> is provided "as is" without warranties of any kind. We strive for accuracy 
            but cannot guarantee that all data will be complete, current, or error-free.
          </p>
          <div className="limitations-list">
            <h3>Service limitations include:</h3>
            <ul>
              <li>Dependence on Riot Games API availability</li>
              <li>Potential delays in data updates</li>
              <li>Rate limiting may affect real-time data retrieval</li>
              <li>Historical data may not be available for all periods</li>
            </ul>
          </div>
        </section>

        <section className="contact-info">
          <h2>Contact Information</h2>
          <p>
            For questions about this notice, data deletion requests, or other concerns, please contact us at:
          </p>
          <div className="contact-details">
            <p><strong>Email:</strong> privacy@hextechinsight.com</p>
            <p><strong>Data Protection:</strong> Requests for data deletion or modification can be made through your account settings or by contacting us directly.</p>
          </div>
        </section>

        <section className="updates">
          <h2>Updates to This Notice</h2>
          <p>
            This notice may be updated periodically to reflect changes in our practices or legal requirements. 
            Users will be notified of significant changes through the application or via email.
          </p>
          <p className="last-updated">
            <strong>Last Updated:</strong> {new Date().toLocaleDateString()}
          </p>
        </section>

        <div className="acknowledgment">
          <div className="riot-logo-section">
            <p className="logo-disclaimer">
              League of Legends and Riot Games are registered trademarks of Riot Games, Inc. 
              This application is not affiliated with, endorsed by, or sponsored by Riot Games, Inc.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RiotNotice