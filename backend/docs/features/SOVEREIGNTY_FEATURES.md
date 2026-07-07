# Sovereignty Data Feature Proposals - Complete Documentation

## 🎯 **Core Features:**

### 1. **Sovereignty War Dashboard**

Real-time visualization of ongoing sovereignty conflicts across New Eden.

**Key Components:**

- Display all active sovereignty campaigns in real-time
- Show attacker/defender scores for each campaign
- Visualize which alliances are fighting over which systems
- War progress bars with score differentials
- Timeline visualization showing campaign duration
- Campaign event types breakdown:
  - TCU Defense (Territorial Claim Unit)
  - IHUB Defense (Infrastructure Hub)
  - Station Defense
  - Station Freeport events
- Participant alliance list with individual scores
- Estimated time remaining for campaigns
- Quick links to system/constellation/region details

**Technical Implementation:**

- Fetch data from `/sovereignty/campaigns` endpoint
- Real-time updates every 5-10 minutes
- WebSocket or polling for live score updates
- Cache campaign data with short TTL (5 minutes)

---

### 2. **Territory Control Map**

Comprehensive visualization of sovereignty distribution across New Eden.

**Key Components:**

- Interactive map showing which alliance controls which systems
- Color-coded visualization by alliance
- Constellation/region-based dominance statistics
- Territory change history tracking:
  - Daily snapshots of sovereignty changes
  - Who lost/gained systems over time
  - Territory swap tracking (system changed hands)
- Faction-controlled vs Alliance-controlled comparisons
- NPC null-sec vs player sovereignty regions
- Corporation-level sovereignty (rare cases)

**Statistics Displayed:**

- Total systems controlled per alliance
- Systems controlled per region
- Percentage of null-sec controlled
- Territory concentration metrics
- Adjacent system clustering analysis

**Technical Implementation:**

- Fetch data from `/sovereignty/map` endpoint
- Store historical snapshots daily
- Calculate deltas between snapshots
- Aggregate by alliance/corporation/faction
- Generate region/constellation summaries

---

### 3. **Alliance Power Rankings**

Comprehensive ranking system based on sovereignty holdings and activity.

**Ranking Categories:**

- **Total Systems Controlled**: Overall sovereignty power
- **Active Wars Count**: Offensive/defensive engagement level
- **Territory Gains (24h/7d/30d)**: Expansion metrics
- **Territory Losses (24h/7d/30d)**: Defensive metrics
- **Net Territory Change**: Overall growth/decline
- **Sovereignty Stability**: How long systems have been held
- **War Win Rate**: Successful campaigns vs total campaigns
- **Defense Success Rate**: Successfully defended structures
- **Attack Success Rate**: Successfully captured structures

**Leaderboards:**

- Top 25 alliances by systems controlled
- Most aggressive attackers (active offensive campaigns)
- Best defenders (successful defense rate)
- Fastest growing alliances (territory gains)
- Declining powers (territory losses)
- Most stable empires (longest held systems)

**Technical Implementation:**

- Daily aggregation of sovereignty data
- Historical comparison calculations
- Win/loss tracking for campaigns
- Alliance-level statistics aggregation
- Ranking algorithm with multiple factors

---

### 4. **Killmail + Sovereignty Integration** ⭐ **(Most Valuable Feature)**

**This is your unique selling point - nobody else can do this!**

**Core Functionality:**
Correlate your extensive killmail database with sovereignty campaign data to provide unprecedented war intelligence.

**Features:**

**A. War Zone Kill Tracking:**

- Highlight all killmails in systems with active sov campaigns
- Special "War Kill" badge on relevant killmails
- Filter killmails by campaign ID or war zone
- Separate statistics for war-related vs normal kills

**B. Campaign Combat Analysis:**

- Total ISK destroyed per campaign (both sides)
- Kill counts per participating alliance during campaign
- Ship type analysis (what's being used in sov wars)
- Pilot participation tracking (who's fighting)
- Time-based kill activity (peak fighting times)

**C. War Outcome Prediction:**

- Use kill ratios to predict campaign outcomes
- "Which side is winning based on actual combat"
- ISK efficiency per alliance during campaigns
- Combat performance metrics vs campaign scores

**D. Structure Kill Attribution:**

- Track TCU/IHUB structure kills
- Attribute structure kills to campaigns
- Calculate structure replacement costs
- Structure defense success correlation with nearby kills

**E. Participant Performance Metrics:**

- Individual alliance contribution to campaign success
- Kill participation rate during campaigns
- ISK destroyed contribution per participant
- Combat effectiveness scores
- Top performers per campaign

**F. Alliance War Capabilities:**

- Historical war performance analysis
- Average ISK destroyed in campaigns
- Typical fleet compositions in sov wars
- Peak activity times for each alliance
- War sustainability metrics

**Technical Implementation:**

```typescript
// Example queries you can build:
-getWarZoneKillmails(campaignId, dateRange) -
  getCampaignCombatStats(campaignId) -
  getAllianceWarPerformance(allianceId, dateRange) -
  predictCampaignOutcome(campaignId) -
  getStructureKillHistory(allianceId, structureType) -
  getCampaignParticipantStats(campaignId, participantId);
```

**Data Requirements:**

- Link killmails to campaigns by:
  - System ID + timestamp matching
  - Participant alliance matching
  - Structure type matching (for structure kills)
- Store campaign outcomes for ML/prediction models
- Aggregate statistics per campaign

---

### 5. **War Alerts & Notifications**

Real-time notification system for sovereignty events.

**Alert Types:**

**A. New Campaign Alerts:**

- "New sovereignty campaign started in [System]"
- Event type and participating alliances
- Attacker vs Defender identification
- Structure at risk information

**B. Structure Vulnerability Alerts:**

- "TCU/IHUB entering vulnerability window"
- Countdown to vulnerability window
- Weekly timer schedules
- Alliance-specific structure tracking

**C. Favorite Alliance Tracking:**

- "Your favorite alliance is under attack in [System]"
- "Your alliance captured a system in [Region]"
- Major territory changes notifications
- Alliance war performance summaries

**D. Campaign Outcome Alerts:**

- "Campaign completed in [System]"
- Winner/loser identification
- Structure fate (destroyed/saved)
- Statistics summary

**E. Territory Change Alerts:**

- "System sovereignty changed in [System]"
- Old vs new owner
- Impact on regional control

**Delivery Methods:**

- In-app notifications
- Email notifications (opt-in)
- Discord webhook integration
- RSS feed
- API webhooks for third-party integrations

**Technical Implementation:**

- Background worker checking sovereignty changes
- Comparison with previous state
- User preference management
- Notification queue system
- Rate limiting and batching

---

### 6. **Historical Analytics**

Deep historical analysis of sovereignty dynamics over time.

**Analytics Features:**

**A. Campaign History Database:**

- Complete archive of all campaigns
- Campaign outcomes (winner/loser)
- Duration statistics
- Score progressions
- Participant histories

**B. Territory Timeline:**

- System ownership over time (animated map)
- Alliance territory growth/decline charts
- Region control percentage over time
- Constellation dominance shifts
- "Who controlled what when" lookups

**C. Monthly/Yearly Reports:**

- "Top 10 territory gainers this month"
- "Top 10 territory losers this month"
- Most contested systems/regions
- Campaign frequency trends
- Active war periods vs quiet periods

**D. Alliance War History:**

- Complete war record per alliance
- Win/loss records
- Territories gained/lost historically
- War participation frequency
- Success rates over time

**E. System History:**

- Ownership history per system
- Number of times system changed hands
- Average ownership duration
- Most contested systems ever
- Stability scores

**F. Seasonal Trends:**

- Winter/summer war activity differences
- Holiday period impacts
- Patch/expansion impact on sovereignty
- Player activity correlation

**Technical Implementation:**

- Daily snapshots stored permanently
- Campaign outcomes tracked
- Efficient time-series queries
- Aggregation tables for performance
- Data warehouse for historical analysis

---

### 7. **Structure Tracking**

Detailed tracking of sovereignty structures and their vulnerability.

**Features:**

**A. Structure Inventory:**

- Complete list of all TCUs and IHUBs
- Owner alliance per structure
- System/constellation/region grouping
- Structure type breakdown
- Installation dates (if trackable)

**B. Vulnerability Schedules:**

- Display vulnerability windows for all structures
- Weekly schedule view
- Daily upcoming timers
- Timezone-adjusted displays
- Calendar integration

**C. Timer Board:**

- "Next 24 hours" timer list
- Sortable by region/alliance/time
- Countdown timers
- Structure importance scoring
- Historical timer tracking

**D. Occupancy Tracking:**

- Structure occupancy levels
- Vulnerability level indicators
- ADM (Activity Defense Multiplier) estimation
- Occupancy trend tracking

**E. Structure History:**

- Structure installation/destruction events
- Ownership change history
- Maintenance tracking
- Lifetime statistics

**Technical Implementation:**

- Fetch from `/sovereignty/structures` endpoint
- Parse vulnerability window data
- Calculate upcoming timers
- Store structure lifecycle events
- Real-time countdown calculations

---

### 8. **Region/Constellation Hot Zones**

Identify and analyze conflict-heavy areas of null-sec space.

**Features:**

**A. Conflict Density Mapping:**

- Identify regions with most active campaigns
- Constellation-level conflict tracking
- System danger ratings
- Conflict intensity heatmaps

**B. Most Contested Areas:**

- Regions with frequent sovereignty changes
- Systems that change hands often
- Border zones between major powers
- Flashpoint identification

**C. Activity Correlation:**

- Sovereignty wars + killmail activity
- High kill systems with active campaigns
- Combat density vs sovereignty stability
- Safe vs dangerous null-sec regions

**D. Strategic Importance:**

- Chokepoint systems identification
- Regional gates and connections
- Strategic value scoring
- Alliance staging system identification

**E. Risk Assessment:**

- Travel safety ratings based on activity
- Dangerous routes highlighting
- Safe passage identification
- Real-time danger updates

**Technical Implementation:**

- Aggregate campaigns by region/constellation
- Combine with killmail data
- Calculate conflict metrics
- Generate heatmap data
- Real-time risk scoring

---

## 💡 **Quick Win Features:**

These features can be implemented rapidly with high impact:

### 1. **Top 10 Alliances by Systems Controlled**

- Simple aggregation of sovereignty map data
- Rank by count of systems
- Display with alliance names and logos
- Update daily

### 2. **Active Wars Count by Region**

- Count campaigns per region
- Simple visualization (bar chart)
- Real-time updates
- "Hottest regions right now"

### 3. **Most Aggressive Alliances**

- Count attacking campaigns per alliance
- Rank by offensive activity
- "Who's starting the most wars"
- 7-day and 30-day views

### 4. **Most Defensive Alliances**

- Count defensive campaigns per alliance
- "Who's under attack the most"
- Defense frequency metrics

### 5. **Systems Under Siege**

- List all systems with active campaigns
- Simple table view
- Sort by score differential
- Quick access to details

### 6. **Campaign Participation Leaderboard**

- Count alliances by campaign participation
- Most active combatants
- Participation frequency

### 7. **Daily Territory Changes**

- Simple diff between today and yesterday
- List systems that changed ownership
- Minimal computation required

### 8. **Structure Vulnerability Calendar**

- Parse vulnerability windows
- Display in calendar format
- Next 7 days view
- Basic filtering

---

## 🔥 **Unique Value Proposition:**

### What Makes This Special:

**Nobody else has this combination of data:**
Your extensive killmail database combined with sovereignty data creates unique opportunities for intelligence that competitors cannot replicate.

### Unique Analytics:

**1. War Outcome Prediction Engine:**

- Machine learning model using:
  - Kill ratios during campaigns
  - ISK efficiency per side
  - Pilot participation patterns
  - Historical campaign outcomes
  - Ship composition analysis
- Predict campaign winners before they're decided
- Confidence scores for predictions
- Historical prediction accuracy tracking

**2. True War Cost Calculator:**

- Calculate actual ISK lost during campaigns
- Both sides' losses
- Cost per system captured/defended
- Most expensive wars in EVE history
- Cost efficiency per alliance

**3. Combat Effectiveness Metrics:**

- Beyond just campaign scores
- Who's winning the actual fights
- Kill/death ratios during wars
- ISK efficiency per participant
- Correlation between combat and outcomes

**4. Alliance War Capability Profiles:**

- Detailed dossier per alliance:
  - Preferred war times
  - Typical fleet sizes
  - Favorite ship compositions
  - Historical win rates
  - Peak activity periods
  - Sustainable war duration
  - Recovery time after wars

**5. Participant Impact Scoring:**

- Individual alliance contribution to campaigns
- Who's carrying the war effort
- Mercenary effectiveness tracking
- Coalition coordination metrics

**6. Strategic Intelligence:**

- System defense strength profiles
- Vulnerability identification
- Weak points in empire borders
- Optimal attack timing analysis

### Competitive Advantages:

**vs zkillboard:**

- They have kills, you have kills + sovereignty context
- War-related kill filtering
- Campaign performance analytics

**vs EVE-maps sites:**

- They have maps, you have maps + combat data
- True ownership strength (not just sovereignty)
- Predictive analytics

**vs dotlan:**

- They have sovereignty, you have sovereignty + combat intelligence
- Real war impact metrics
- Cost calculations

**You are the only one who can answer:**

- "Is my alliance winning this war?"
- "How much ISK is being destroyed in this campaign?"
- "Which alliance fights the hardest in sov wars?"
- "What's the ROI of capturing this system?"
- "Who are the best sov war fighters in EVE?"

---

## 📊 **Data Schema Suggestions:**

### Required Database Tables:

```prisma
// Sovereignty Campaigns History
model SovereigntyCampaign {
  id                  Int       @id @default(autoincrement())
  campaign_id         Int       @unique
  constellation_id    Int
  solar_system_id     Int
  structure_id        BigInt
  defender_id         Int?
  attackers_score     Float
  defender_score      Float
  event_type          String    // tcu_defense, ihub_defense, etc.
  start_time          DateTime
  end_time            DateTime? // null if still active
  outcome             String?   // defender_won, attacker_won, abandoned
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt

  // Relations
  participants        CampaignParticipant[]
  relatedKillmails    Killmail[] @relation("CampaignKillmails")
  solarSystem         SolarSystem @relation(fields: [solar_system_id], references: [system_id])

  @@index([solar_system_id, start_time])
  @@index([campaign_id])
  @@index([end_time])
}

// Campaign Participants
model CampaignParticipant {
  id                  Int       @id @default(autoincrement())
  campaign_id         Int
  alliance_id         Int
  score               Float
  created_at          DateTime  @default(now())

  campaign            SovereigntyCampaign @relation(fields: [campaign_id], references: [campaign_id])
  alliance            Alliance @relation(fields: [alliance_id], references: [alliance_id])

  @@unique([campaign_id, alliance_id])
  @@index([alliance_id])
}

// Sovereignty Map History (Daily Snapshots)
model SovereigntyMapSnapshot {
  id                  Int       @id @default(autoincrement())
  system_id           Int
  alliance_id         Int?
  corporation_id      Int?
  faction_id          Int?
  snapshot_date       DateTime
  created_at          DateTime  @default(now())

  solarSystem         SolarSystem @relation(fields: [system_id], references: [system_id])

  @@unique([system_id, snapshot_date])
  @@index([snapshot_date])
  @@index([alliance_id, snapshot_date])
}

// Current Sovereignty Map (Updated frequently)
model SovereigntyMapCurrent {
  id                  Int       @id @default(autoincrement())
  system_id           Int       @unique
  alliance_id         Int?
  corporation_id      Int?
  faction_id          Int?
  last_updated        DateTime  @updatedAt

  solarSystem         SolarSystem @relation(fields: [system_id], references: [system_id])

  @@index([alliance_id])
}

// Sovereignty Structures
model SovereigntyStructure {
  id                              Int       @id @default(autoincrement())
  structure_id                    BigInt    @unique
  solar_system_id                 Int
  structure_type_id               Int
  alliance_id                     Int
  vulnerability_occupancy_level   Float?
  vulnerable_start_time           DateTime?
  vulnerable_end_time             DateTime?
  last_seen                       DateTime  @updatedAt
  created_at                      DateTime  @default(now())
  destroyed_at                    DateTime? // Track when structure was destroyed

  solarSystem                     SolarSystem @relation(fields: [solar_system_id], references: [system_id])
  alliance                        Alliance @relation(fields: [alliance_id], references: [alliance_id])

  @@index([solar_system_id])
  @@index([alliance_id])
  @@index([vulnerable_start_time])
}

// Alliance Territory Statistics (Aggregated Daily)
model AllianceTerritoryStats {
  id                      Int       @id @default(autoincrement())
  alliance_id             Int
  date                    DateTime
  systems_controlled      Int
  tcu_count               Int
  ihub_count              Int
  campaigns_attacking     Int
  campaigns_defending     Int
  systems_gained_today    Int
  systems_lost_today      Int
  created_at              DateTime  @default(now())

  alliance                Alliance @relation(fields: [alliance_id], references: [alliance_id])

  @@unique([alliance_id, date])
  @@index([date])
  @@index([systems_controlled])
}

// Territory Changes Log
model TerritoryChange {
  id                  Int       @id @default(autoincrement())
  system_id           Int
  previous_owner_id   Int?      // alliance_id
  new_owner_id        Int?      // alliance_id
  change_type         String    // captured, lost, abandoned
  detected_at         DateTime  @default(now())

  solarSystem         SolarSystem @relation(fields: [system_id], references: [system_id])

  @@index([system_id, detected_at])
  @@index([previous_owner_id])
  @@index([new_owner_id])
}

// Campaign Combat Statistics (Aggregated per campaign)
model CampaignCombatStats {
  id                      Int       @id @default(autoincrement())
  campaign_id             Int       @unique
  alliance_id             Int
  total_kills             Int
  total_losses            Int
  isk_destroyed           BigInt
  isk_lost                BigInt
  pilots_participated     Int
  ships_destroyed         Int
  updated_at              DateTime  @updatedAt

  campaign                SovereigntyCampaign @relation(fields: [campaign_id], references: [campaign_id])
  alliance                Alliance @relation(fields: [alliance_id], references: [alliance_id])

  @@index([campaign_id])
  @@index([alliance_id])
}
```

### Additional Modifications to Existing Tables:

```prisma
// Add to existing Killmail model
model Killmail {
  // ... existing fields ...

  // New fields for sovereignty integration
  related_campaign_id   Int?
  is_war_related        Boolean @default(false)

  campaign              SovereigntyCampaign? @relation("CampaignKillmails", fields: [related_campaign_id], references: [campaign_id])

  @@index([related_campaign_id])
  @@index([is_war_related])
}
```

---

## 🚀 **Implementation Priority & Roadmap:**

### **Phase 1 - Foundation (Week 1-2):**

**Goals:** Set up data pipeline and basic infrastructure

**Tasks:**

1. ✅ Create sovereignty service with ESI endpoints (DONE)
2. Create database schema for sovereignty tables
3. Set up cron workers to fetch sovereignty data:
   - `/sovereignty/campaigns` - Every 5 minutes
   - `/sovereignty/map` - Every 30 minutes
   - `/sovereignty/structures` - Every 30 minutes
4. Create daily snapshot worker for historical data
5. Basic data models and Prisma schema
6. Initial data population scripts

**Deliverables:**

- Sovereignty data flowing into database
- Historical snapshots being created
- Base infrastructure ready

---

### **Phase 2 - Quick Wins (Week 3-4):**

**Goals:** Ship user-facing features quickly

**Features to Implement:**

1. **Alliance Territory Rankings**
   - Top 25 alliances by systems controlled
   - Simple leaderboard page
   - Daily updates

2. **Active Campaigns List**
   - Display all current sovereignty wars
   - Basic information (systems, alliances, scores)
   - Simple table view

3. **Territory Map View**
   - Static map showing current sovereignty
   - Color-coded by alliance
   - Region/constellation breakdowns

4. **Daily Territory Changes**
   - "What changed today" page
   - Systems that changed hands
   - New campaigns started

**Technical:**

- GraphQL queries for sovereignty data
- Basic resolvers
- Frontend components for displays
- Simple caching strategy

**Deliverables:**

- 4 new user-facing pages
- Basic sovereignty visibility
- Foundation for advanced features

---

### **Phase 3 - Advanced Integration (Week 5-8):**

**Goals:** Implement unique killmail + sovereignty features

**Features to Implement:**

1. **War Zone Kill Tracking**
   - Tag killmails with campaign context
   - Background worker to correlate data
   - "War kills" filter on killmail pages
   - Special badges for war-related kills

2. **Campaign Combat Dashboard**
   - Per-campaign statistics
   - ISK destroyed by each side
   - Participant performance metrics
   - Combat timeline visualization

3. **Alliance War Performance**
   - Historical war statistics per alliance
   - Win/loss records
   - Cost analysis
   - Combat effectiveness metrics

4. **Structure Kill Tracking**
   - Separate tracking for structure kills
   - Attribution to campaigns
   - Structure destruction history

**Technical:**

- Complex aggregation queries
- Background workers for correlation
- Advanced caching strategies
- Performance optimization

**Deliverables:**

- Unique analytics nobody else has
- Killmail database fully integrated
- War intelligence features

---

### **Phase 4 - Historical & Predictive (Week 9-12):**

**Goals:** Advanced analytics and intelligence

**Features to Implement:**

1. **Historical Analytics Dashboard**
   - Territory timeline charts
   - Alliance growth/decline tracking
   - Monthly/yearly reports
   - Campaign history browser

2. **Territory Change Visualization**
   - Animated map showing changes over time
   - "Replay" feature for major wars
   - Regional control percentage charts

3. **War Outcome Prediction** (MVP)
   - Simple prediction model
   - Based on kill ratios
   - Confidence scoring
   - Track prediction accuracy

4. **Hot Zones & Risk Assessment**
   - Conflict density heatmaps
   - Travel safety ratings
   - Dangerous systems identification

**Technical:**

- Time-series data visualization
- Basic ML model for predictions
- Complex aggregation queries
- Data visualization libraries

**Deliverables:**

- Historical data fully leveraged
- Predictive features launched
- Advanced intelligence tools

---

### **Phase 5 - User Engagement (Week 13-16):**

**Goals:** Keep users coming back

**Features to Implement:**

1. **Notification System**
   - Alert preferences management
   - Email/in-app notifications
   - Favorite alliance tracking
   - Campaign updates

2. **Interactive Map**
   - Click-to-explore interface
   - Filter by alliance/region
   - Real-time updates
   - Zoom to system details

3. **Timer Board**
   - Upcoming structure timers
   - Countdown displays
   - Calendar integration
   - Export functionality

4. **Custom Dashboards**
   - User-configurable widgets
   - Alliance-specific views
   - Region watchlists
   - Personal war tracker

**Technical:**

- Notification queue system
- WebSocket for real-time updates
- Interactive map library (e.g., Leaflet)
- User preference storage

**Deliverables:**

- Engaging user experience
- Repeat visit triggers
- Personalization features

---

### **Phase 6 - Polish & Monetization (Week 17-20):**

**Goals:** Refine features and generate revenue

**Features to Implement:**

1. **Premium Analytics**
   - Advanced war predictions
   - Deeper historical data access
   - Export capabilities
   - API access

2. **Alliance Leadership Tools**
   - Territory management dashboard
   - Member war participation tracking
   - Strategic planning tools
   - Performance reports

3. **Mobile App**
   - Push notifications
   - Quick access to timers
   - War status checking
   - Offline support

4. **Third-party Integrations**
   - Discord bot
   - API for external tools
   - Webhook support
   - RSS feeds

**Technical:**

- Payment integration
- API rate limiting
- Mobile development
- Discord bot framework

**Deliverables:**

- Revenue streams established
- Mobile presence
- Ecosystem integrations

---

## 💰 **Monetization Opportunities:**

### **Free Tier:**

- Basic sovereignty map
- Current campaign list
- Top 10 rankings
- Last 7 days of data
- Limited notifications

### **Premium Tier ($5-10/month):**

- Advanced war analytics
- Unlimited historical data
- Custom alerts and notifications
- War outcome predictions
- Export data capabilities
- Ad-free experience
- Priority data updates

### **Alliance/Corp Tier ($20-50/month):**

- Alliance management dashboard
- Member participation tracking
- Territory analytics
- Strategic planning tools
- War performance reports
- Custom branding
- Multiple user accounts

### **API Access Tier ($50-100/month):**

- REST API access
- Real-time data feeds
- Webhook integrations
- Higher rate limits
- Commercial use rights
- Priority support

### **Enterprise/Tools Developers:**

- Unlimited API access
- Custom endpoints
- Dedicated support
- White-label options
- Custom data processing

---

## 📈 **Success Metrics:**

### **User Engagement:**

- Daily active users viewing sovereignty data
- Time spent on sovereignty pages
- Return visit rate
- Feature usage statistics

### **Technical Metrics:**

- API response times
- Data freshness (lag time)
- Cache hit rates
- Background job success rates

### **Business Metrics:**

- Premium conversion rate
- Revenue per user
- Customer retention rate
- API adoption rate

### **Content Metrics:**

- Total campaigns tracked
- Historical data depth
- Prediction accuracy rate
- Coverage completeness

---

## 🎯 **Key Performance Indicators (KPIs):**

### **Month 1-3:**

- 1,000+ users viewing sovereignty data
- 100% data coverage (all systems tracked)
- < 10 minute data lag
- 4+ quick win features shipped

### **Month 4-6:**

- 5,000+ active sovereignty users
- 100+ premium subscribers
- Killmail integration complete
- Prediction model at 60%+ accuracy

### **Month 7-12:**

- 20,000+ active users
- 500+ premium subscribers
- 50+ Alliance tier subscribers
- 10+ API customers
- Mobile app launched

---

## 🔧 **Technical Considerations:**

### **Data Volume Estimates:**

- ~8,000 null-sec systems
- ~50-100 active campaigns at any time
- ~15,000-20,000 structures
- Daily snapshots = 8KB/day
- Campaign data = ~5KB per campaign
- Annual storage ≈ 50-100 GB

### **API Rate Limiting:**

- ESI allows 150 requests/second (burst)
- Need ~3 endpoints polled regularly
- Budget: Run sovereignty sync every 5-10 minutes
- Well within rate limits

### **Performance Optimization:**

- Cache sovereignty map (30 min TTL)
- Cache campaigns (5 min TTL)
- Pre-aggregate statistics daily
- Index on frequently queried fields
- Use materialized views for complex queries

### **Scalability:**

- Sovereignty data is relatively small
- Killmail correlation is the heavy operation
- Use background workers for aggregation
- Queue system for expensive calculations
- Consider read replicas for analytics

---

## 🚨 **Potential Challenges:**

### **Data Freshness vs Performance:**

- **Challenge:** Real-time updates are expensive
- **Solution:** Smart caching with short TTLs for active campaigns, longer for historical data

### **Killmail Correlation Complexity:**

- **Challenge:** Matching millions of killmails to campaigns
- **Solution:** Index by system_id and timestamp, batch processing, incremental updates

### **Prediction Model Accuracy:**

- **Challenge:** Many factors affect campaign outcomes
- **Solution:** Start simple, iterate based on results, be transparent about accuracy

### **Historical Data Storage:**

- **Challenge:** Daily snapshots add up over time
- **Solution:** Compress old data, archive to cold storage, aggregate where possible

### **User Privacy & Alliance Intelligence:**

- **Challenge:** Sensitive war information
- **Solution:** Public data only, delay sensitive features, optional private dashboards

---

## 📚 **Documentation Needs:**

### **User Documentation:**

- "Understanding Sovereignty in EVE"
- "How to Read Campaign Statistics"
- "Interpreting War Predictions"
- "Alliance Territory Analytics Guide"
- FAQs and glossary

### **API Documentation:**

- Endpoint reference
- Authentication guide
- Rate limiting policies
- Example integrations
- Webhook setup guide

### **Developer Documentation:**

- Database schema docs
- Background worker architecture
- Cron job schedules
- Caching strategy
- Performance optimization guide

---

## 🎓 **Learning Resources Needed:**

### **EVE Game Mechanics:**

- Sovereignty 3.0 system deep dive
- Activity Defense Multiplier (ADM)
- Entosis Link mechanics
- Structure vulnerabilities
- Campaign scoring system

### **Technical Resources:**

- ESI sovereignty endpoints documentation
- Rate limiting best practices
- Time-series data handling
- ML for outcome prediction
- Real-time notifications architecture

---

## 🤝 **Community Engagement:**

### **Beta Testing:**

- Recruit active null-sec players
- Alliance leadership feedback
- War coordinator input
- Third-party developer feedback

### **Launch Strategy:**

- Announce on r/Eve
- Post in alliance forums
- Reach out to major null-sec alliances
- Coordinate with EVE content creators
- Highlight unique features

### **Feedback Loops:**

- User feedback form
- Discord community
- Regular feature polls
- Alliance representative program
- Bug bounty program

---

## 📝 **Next Steps:**

1. **Review and Prioritize**: Review this document and select which features to implement first
2. **Database Design**: Finalize Prisma schema for sovereignty tables
3. **Worker Setup**: Create background workers for ESI data collection
4. **Quick Wins**: Implement Phase 2 features for rapid user value
5. **Integration**: Begin killmail + sovereignty correlation work
6. **Community**: Share roadmap with EVE community for feedback

---

This comprehensive plan should give you everything you need to build a world-class sovereignty tracking and analytics platform that leverages your existing killmail data in ways nobody else can match.
