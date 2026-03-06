# 🌟 Solar System Enhancement Plan - Frontend

## Phase 2: Frontend Development (1.5-2 hours)

**Objective**: Create engaging UI components to display solar system statistics and analytics.

---

## 📋 Table of Contents

- [Task 2.1: Create GraphQL Queries](#task-21-create-graphql-queries-15-min)
- [Task 2.2: Create Statistics Components](#task-22-create-statistics-components-45-min)
- [Task 2.3: Update Solar System Page](#task-23-update-solar-system-page-30-min)
- [Task 2.4: Styling & Responsiveness](#task-24-styling--responsiveness-15-min)
- [Task 2.5: Testing](#task-25-testing-15-min)
- [Design Guidelines](#design-guidelines)
- [Component Specifications](#component-specifications)
- [Completion Checklist](#completion-checklist)

---

## Task 2.1: Create GraphQL Queries (15 min)

**File**: `frontend/src/graphql/solarSystem.graphql` (or add to existing file)

```graphql
query SolarSystemStats($id: Int!, $days: Int = 30) {
  solarSystem(id: $id) {
    stats(days: $days) {
      totalKills
      totalValue
      avgKillsPerDay
      riskScore
      lastKillAt
    }
    hourlyActivity(days: 7) {
      hour
      killCount
    }
    topVictimShips(limit: 10, days: $days) {
      shipTypeId
      shipTypeName
      killCount
      totalValue
    }
    topAttackerShips(limit: 10, days: $days) {
      shipTypeId
      shipTypeName
      killCount
    }
    activeEntities(limit: 10, days: $days) {
      entityId
      entityName
      entityType
      killCount
      isAttacker
    }
    dailyStats(days: $days) {
      date
      killCount
      totalValue
    }
  }
}
```

**Generate types**:

```bash
cd frontend
yarn codegen
```

---

## Task 2.2: Create Statistics Components (45 min)

### Component 1: RiskScoreCard

**File**: `frontend/src/components/SolarSystem/RiskScoreCard.tsx`

**Features**:

- Display circular risk gauge (0-100)
- Color coding: Green (0-30), Yellow (31-60), Red (61-100)
- Show last kill timestamp
- Use ECharts for gauge visualization

**Props**:

```typescript
interface RiskScoreCardProps {
  riskScore?: number;
  lastKillAt?: string;
  loading?: boolean;
}
```

---

### Component 2: HourlyActivityChart

**File**: `frontend/src/components/SolarSystem/HourlyActivityChart.tsx`

**Features**:

- Bar chart showing activity by hour (0-23)
- Highlight peak danger hours
- Show EVE time (UTC) on X-axis
- Tooltip with exact kill count
- Use ECharts for bar chart

**Props**:

```typescript
interface HourlyActivityChartProps {
  data: Array<{ hour: number; killCount: number }>;
  loading?: boolean;
}
```

---

### Component 3: TopShipsTable

**File**: `frontend/src/components/SolarSystem/TopShipsTable.tsx`

**Features**:

- Table showing top victim/attacker ships
- Ship type ID link to ship detail page
- Ship name, kill count, total value
- Toggle between victims/attackers via prop
- Sortable columns

**Props**:

```typescript
interface TopShipsTableProps {
  data: Array<{
    shipTypeId: number;
    shipTypeName: string;
    killCount: number;
    totalValue: number;
  }>;
  type: "victims" | "attackers";
  loading?: boolean;
}
```

---

### Component 4: ActiveEntitiesTable

**File**: `frontend/src/components/SolarSystem/ActiveEntitiesTable.tsx`

**Features**:

- Table showing active corps/alliances
- Entity name linked to entity detail page
- Entity type badge (alliance/corporation)
- Kill count
- Separate sections for attackers/victims
- Sortable columns

**Props**:

```typescript
interface ActiveEntitiesTableProps {
  data: Array<{
    entityId: number;
    entityName: string;
    entityType: "alliance" | "corporation";
    killCount: number;
    isAttacker: boolean;
  }>;
  loading?: boolean;
}
```

---

### Component 5: DailyStatsChart

**File**: `frontend/src/components/SolarSystem/DailyStatsChart.tsx`

**Features**:

- Line chart showing kills per day
- Area chart for ISK destroyed (secondary axis)
- Last 7, 30, or 90 days
- Tooltip with date, kills, and ISK value
- Use ECharts for combination chart

**Props**:

```typescript
interface DailyStatsChartProps {
  data: Array<{
    date: string;
    killCount: number;
    totalValue: number;
  }>;
  loading?: boolean;
}
```

---

### Component 6: TimeRangeSelector

**File**: `frontend/src/components/SolarSystem/TimeRangeSelector.tsx`

**Features**:

- Button group: 7d, 30d, 90d
- Active state styling
- Triggers data refetch

**Props**:

```typescript
interface TimeRangeSelectorProps {
  value: 7 | 30 | 90;
  onChange: (days: 7 | 30 | 90) => void;
}
```

---

## Task 2.3: Update Solar System Page (30 min)

**File**: `frontend/src/app/solar-systems/[id]/page.tsx`

### Changes Required:

1. **Add new "Statistics" tab**

```tsx
const tabs = [
  { id: "attributes" as TabType, label: "Attributes" },
  { id: "statistics" as TabType, label: "Statistics" }, // NEW
  { id: "killmails" as TabType, label: "Killmails" },
];
```

2. **Add state for time range**

```tsx
const [timeRange, setTimeRange] = useState<7 | 30 | 90>(30);
```

3. **Add statistics query**

```tsx
const { data: statsData, loading: statsLoading } = useSolarSystemStatsQuery({
  variables: {
    id: parseInt(id),
    days: timeRange,
  },
  skip: activeTab !== "statistics",
});
```

4. **Implement Statistics Tab Content**

```tsx
{
  activeTab === "statistics" && (
    <div className="statistics-tab">
      {/* Header with Time Range Selector */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">System Analytics</h2>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* Top Metrics Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
        <RiskScoreCard
          riskScore={statsData?.solarSystem?.stats?.riskScore}
          lastKillAt={statsData?.solarSystem?.stats?.lastKillAt}
          loading={statsLoading}
        />
        <StatCard
          title="Total Kills"
          value={statsData?.solarSystem?.stats?.totalKills}
          loading={statsLoading}
        />
        <StatCard
          title="Avg Kills/Day"
          value={statsData?.solarSystem?.stats?.avgKillsPerDay?.toFixed(1)}
          loading={statsLoading}
        />
        <StatCard
          title="Total ISK Destroyed"
          value={formatISK(statsData?.solarSystem?.stats?.totalValue)}
          loading={statsLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <HourlyActivityChart
          data={statsData?.solarSystem?.hourlyActivity || []}
          loading={statsLoading}
        />
        <DailyStatsChart
          data={statsData?.solarSystem?.dailyStats || []}
          loading={statsLoading}
        />
      </div>

      {/* Ship Tables Row */}
      <div className="grid gap-6 lg:grid-cols-2 mb-6">
        <TopShipsTable
          data={statsData?.solarSystem?.topVictimShips || []}
          type="victims"
          loading={statsLoading}
        />
        <TopShipsTable
          data={statsData?.solarSystem?.topAttackerShips || []}
          type="attackers"
          loading={statsLoading}
        />
      </div>

      {/* Active Entities */}
      <ActiveEntitiesTable
        data={statsData?.solarSystem?.activeEntities || []}
        loading={statsLoading}
      />
    </div>
  );
}
```

---

## Task 2.4: Styling & Responsiveness (15 min)

### Requirements:

- **Mobile First**: Design works on screens 320px+
- **Loading States**: Show skeleton loaders during data fetch
- **Error Handling**: Display user-friendly error messages
- **Smooth Transitions**: Fade in/out when switching tabs
- **Consistent Spacing**: Use Tailwind's spacing scale (gap-4, gap-6, etc.)

### Loading State Example:

```tsx
{loading ? (
  <div className="animate-pulse">
    <div className="h-8 bg-white/10 rounded w-1/4 mb-4"></div>
    <div className="h-64 bg-white/10 rounded"></div>
  </div>
) : (
  // Actual content
)}
```

---

## Task 2.5: Testing (15 min)

### Test Checklist:

- [ ] All tabs work correctly
- [ ] Time range selector updates data (7d, 30d, 90d)
- [ ] Charts render properly with real data
- [ ] Tables are sortable and responsive
- [ ] Mobile view works (test at 375px, 768px, 1024px)
- [ ] Loading states display correctly
- [ ] Error states display user-friendly messages
- [ ] Test with different systems:
  - [ ] High-sec (Jita - 30000142)
  - [ ] Low-sec (Rancer - 30001443)
  - [ ] Null-sec (1DQ1-A - 30004759)
  - [ ] Wormhole (J100820 - 31000005)

---

## 🎨 Design Guidelines

### Color Scheme:

```typescript
const RISK_COLORS = {
  low: {
    bg: "bg-green-500/20",
    border: "border-green-500/50",
    text: "text-green-400",
    hex: "#10B981",
  },
  medium: {
    bg: "bg-yellow-500/20",
    border: "border-yellow-500/50",
    text: "text-yellow-400",
    hex: "#F59E0B",
  },
  high: {
    bg: "bg-red-500/20",
    border: "border-red-500/50",
    text: "text-red-400",
    hex: "#EF4444",
  },
  info: {
    bg: "bg-cyan-500/20",
    border: "border-cyan-500/50",
    text: "text-cyan-400",
    hex: "#06B6D4",
  },
};
```

### Typography:

- **Page Headers**: `text-2xl font-bold`
- **Section Headers**: `text-xl font-semibold`
- **Card Titles**: `text-lg font-medium`
- **Body Text**: `text-base`
- **Captions**: `text-sm text-gray-400`
- **Labels**: `text-xs uppercase tracking-wider text-gray-500`

### Spacing:

- **Card Padding**: `p-6`
- **Grid Gap**: `gap-6`
- **Section Margin**: `mb-6`
- **Small Gap**: `gap-4`

---

## 📊 Component Specifications

### StatCard Component

Create a reusable stat card:

```tsx
// frontend/src/components/SolarSystem/StatCard.tsx
interface StatCardProps {
  title: string;
  value?: string | number;
  icon?: React.ReactNode;
  loading?: boolean;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatCard({
  title,
  value,
  icon,
  loading,
  trend,
}: StatCardProps) {
  if (loading) {
    return (
      <div className="p-6 border bg-white/5 border-white/10 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-white/10 rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className="p-6 border bg-white/5 border-white/10">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-gray-400">{title}</h3>
        {icon && <div className="text-gray-400">{icon}</div>}
      </div>
      <div className="text-2xl font-bold text-white">{value ?? "N/A"}</div>
      {trend && (
        <div
          className={`text-sm mt-2 ${trend.isPositive ? "text-green-400" : "text-red-400"}`}
        >
          {trend.isPositive ? "↑" : "↓"} {Math.abs(trend.value)}%
        </div>
      )}
    </div>
  );
}
```

---

## 🚀 Bonus Features (If Time Permits)

- [ ] Export statistics as CSV
- [ ] Share system analytics via URL parameters
- [ ] Compare multiple systems side-by-side
- [ ] Real-time updates via GraphQL subscriptions
- [ ] Timezone selector for hourly chart (UTC, Local, EVE)
- [ ] Animated chart transitions
- [ ] Dark/Light theme toggle for charts

---

## ✅ Completion Checklist

### Frontend Tasks:

- [ ] GraphQL queries created in `solarSystem.graphql`
- [ ] Types generated via `yarn codegen`
- [ ] Component files created:
  - [ ] `RiskScoreCard.tsx`
  - [ ] `HourlyActivityChart.tsx`
  - [ ] `TopShipsTable.tsx`
  - [ ] `ActiveEntitiesTable.tsx`
  - [ ] `DailyStatsChart.tsx`
  - [ ] `TimeRangeSelector.tsx`
  - [ ] `StatCard.tsx`
- [ ] Solar system page updated with "Statistics" tab
- [ ] Styling complete and consistent
- [ ] Mobile responsive (tested at multiple breakpoints)
- [ ] Error states handled gracefully
- [ ] Loading states added for all components

### UI/UX Quality:

- [ ] All interactive elements have hover states
- [ ] Focus states are visible for accessibility
- [ ] Animations are smooth (60fps)
- [ ] Text is readable at all screen sizes
- [ ] Colors pass WCAG contrast requirements
- [ ] Icons are consistent and meaningful

### Testing:

- [ ] Frontend renders correctly with mock data
- [ ] Frontend renders correctly with real backend data
- [ ] Different time ranges work (7d, 30d, 90d)
- [ ] All security types tested (high, low, null, wormhole)
- [ ] Tab switching is smooth
- [ ] URL parameters update correctly
- [ ] Browser back/forward buttons work

---

## 📝 Notes

- **ECharts**: Already included in the project (`echarts` and `echarts-for-react`)
- **Icons**: Use `@heroicons/react/24/outline` (already included)
- **Formatting**: Create utility functions for ISK formatting, date formatting
- **Performance**: Use React.memo() for chart components to prevent unnecessary re-renders
- **Accessibility**: Add aria-labels to interactive elements

---

**Estimated Time**: 1.5-2 hours

**Prerequisites**: Backend implementation completed (see SOLAR_SYSTEM_ENHANCEMENT_BACKEND.md)

**Total Project Time**: 3-4 hours
