'use client';

import DateInput from '@/components/ui/DateInput';
import Loader from '@/components/Loader';
import Card from '@/components/ui/Card';
import RankNumber from '@/components/ui/RankNumber';
import Tooltip from '@/components/Tooltip/Tooltip';
import { LeaderboardPeriod, useTopPilotsQuery } from '@/generated/graphql';
import { getSecurityStatusBorderColor } from '@/utils/securityStatus';
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  TrophyIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import EveImage from '@/components/ui/EveImage';

function toDateString(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Returns the Monday (UTC) of the week containing dateStr */
function getWeekMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return toDateString(d);
}

function getWeekSunday(monStr: string): string {
  const d = new Date(monStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 6);
  return toDateString(d);
}

type PilotEntry = {
  rank: number;
  killCount: number;
  character?: {
    id: number;
    name: string;
    securityStatus?: number | null;
    corporation?: { id: number; name: string } | null;
    alliance?: { id: number; name: string } | null;
  } | null;
};

function PilotList({
  pilots,
  loading,
  emptyText,
}: {
  pilots: PilotEntry[];
  loading: boolean;
  emptyText: string;
}) {
  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <Loader size="lg" />
      </div>
    );
  if (pilots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-ink-faint">
        <TrophyIcon className="w-10 h-10 opacity-30" />
        <p className="text-sm font-medium text-center">{emptyText}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col divide-y divide-white/5">
      {pilots.map((pilot) => {
        const char = pilot.character;
        const secBorder = getSecurityStatusBorderColor(char?.securityStatus);
        return (
          <div key={pilot.rank} className={`card-row border-l-4 ${secBorder}`}>
            <div className="flex items-center gap-3">
              {/* Rank */}
              <RankNumber rank={pilot.rank} />

              {/* Portrait */}
              <EveImage
                kind="character"
                id={char?.id ?? 0}
                name={char?.name ?? 'Unknown'}
                size={32}
                className="shrink-0 shadow-md"
              />

              {/* Info */}
              <div className="flex justify-between w-full min-w-0">
                <div className="min-w-0 overflow-hidden">
                  {char ? (
                    <Tooltip
                      content="Show Character Info"
                      className="min-w-0 overflow-hidden"
                    >
                      <Link
                        href={`/characters/${char.id}?tab=killmails`}
                        className="block font-medium text-ink-muted truncate hover:text-blue-400"
                        prefetch={false}
                      >
                        {char.name}
                      </Link>
                    </Tooltip>
                  ) : (
                    <span className="italic font-medium text-ink-faint">
                      Unknown Pilot
                    </span>
                  )}
                </div>

                {/* Kill count + logos */}
                {/* Stacked, this column was 64 tall — the count over two 32px
                    crests — and it, not the portrait, is what held the row at
                    80. Laid out in one line it is 32, the same as the portrait
                    beside it, and the row comes to 48 like the Top* cards. */}
                <div className="flex items-center pl-2 gap-2 shrink-0">
                  <div className="flex">
                    {char?.corporation && (
                      <Tooltip
                        content={`Corporation: ${char.corporation.name}`}
                      >
                        <EveImage
                          kind="corporation"
                          id={char.corporation.id}
                          name={char.corporation.name}
                          size={32}
                        />
                      </Tooltip>
                    )}
                    {char?.alliance && (
                      <Tooltip content={`Alliance: ${char.alliance.name}`}>
                        <EveImage
                          kind="alliance"
                          id={char.alliance.id}
                          name={char.alliance.name}
                          size={32}
                        />
                      </Tooltip>
                    )}
                  </div>
                  <span className="text-base font-medium text-ink-muted tabular-nums whitespace-nowrap">
                    {pilot.killCount.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DailyLeaderboard() {
  const today = toDateString(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const isToday = selectedDate === today;

  const { data, loading } = useTopPilotsQuery({
    variables: {
      filter: {
        period: LeaderboardPeriod.Today,
        anchor: selectedDate,
        limit: 10,
      },
    },
  });

  function prevDay() {
    const d = new Date(selectedDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    setSelectedDate(toDateString(d));
  }

  function nextDay() {
    if (isToday) return;
    const d = new Date(selectedDate + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    setSelectedDate(toDateString(d));
  }

  const displayDate = new Date(selectedDate + 'T00:00:00Z').toLocaleDateString(
    'en-US',
    { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' },
  );

  const pilots = (data?.topPilots ?? []) as PilotEntry[];

  return (
    <Card
      className="flex-1 min-w-0"
      header={
        <div className="flex items-center gap-2">
          <TrophyIcon className="w-5 h-5 text-yellow-400 shrink-0" />
          <h2 className="text-lg font-medium text-white">Daily Top 100</h2>
        </div>
      }
    >
      <div className="card-band">
        <button
          onClick={prevDay}
          className="button button-secondary button-icon shrink-0"
          aria-label="Previous day"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <DateInput
          value={selectedDate}
          max={today}
          onChange={(next) => next && setSelectedDate(next)}
          className="input-boxed px-2 py-1.5 text-xs flex-1 min-w-0"
          aria-label="Leaderboard date"
        />
        <span className="hidden text-xs text-ink-muted sm:block shrink-0">
          {displayDate}
        </span>
        <button
          onClick={nextDay}
          disabled={isToday}
          className="button button-secondary button-icon shrink-0"
          aria-label="Next day"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      <PilotList
        pilots={pilots}
        loading={loading}
        emptyText="No killmail data for this day"
      />
    </Card>
  );
}

function WeeklyLeaderboard() {
  const today = toDateString(new Date());
  const [weekStart, setWeekStart] = useState<string>(getWeekMonday(today));
  const currentWeekStart = getWeekMonday(today);
  const isCurrentWeek = weekStart === currentWeekStart;

  const { data, loading } = useTopPilotsQuery({
    variables: {
      filter: { period: LeaderboardPeriod.Week, anchor: weekStart, limit: 10 },
    },
  });

  function prevWeek() {
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 7);
    setWeekStart(toDateString(d));
  }

  function nextWeek() {
    if (isCurrentWeek) return;
    const d = new Date(weekStart + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + 7);
    setWeekStart(toDateString(d));
  }

  const fmtOpts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  };
  const weekLabel = `${new Date(weekStart + 'T00:00:00Z').toLocaleDateString('en-US', fmtOpts)} – ${new Date(getWeekSunday(weekStart) + 'T00:00:00Z').toLocaleDateString('en-US', fmtOpts)}`;

  const pilots = (data?.topPilots ?? []) as PilotEntry[];

  return (
    <Card
      className="flex-1 min-w-0"
      header={
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="w-5 h-5 text-gray-300 shrink-0" />
          <h2 className="text-lg font-medium text-white">Weekly Top 100</h2>
        </div>
      }
    >
      <div className="card-band">
        <button
          onClick={prevWeek}
          className="button button-secondary button-icon shrink-0"
          aria-label="Previous week"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="flex-1 min-w-0 text-xs font-medium text-center text-gray-300 truncate">
          {weekLabel}
        </span>
        <button
          onClick={nextWeek}
          disabled={isCurrentWeek}
          className="button button-secondary button-icon shrink-0"
          aria-label="Next week"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      <PilotList
        pilots={pilots}
        loading={loading}
        emptyText="No killmail data for this week"
      />
    </Card>
  );
}

function Last90DaysLeaderboard() {
  const { data, loading } = useTopPilotsQuery({
    variables: { filter: { period: LeaderboardPeriod.Last_90Days, limit: 10 } },
  });

  const today = toDateString(new Date());
  const from = toDateString(
    new Date(
      new Date(today + 'T00:00:00Z').getTime() - 89 * 24 * 60 * 60 * 1000,
    ),
  );
  const fmtOpts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  };
  const rangeLabel = `${new Date(from + 'T00:00:00Z').toLocaleDateString('en-US', fmtOpts)} – ${new Date(today + 'T00:00:00Z').toLocaleDateString('en-US', fmtOpts)}`;

  const pilots = (data?.topPilots ?? []) as PilotEntry[];

  return (
    <Card
      className="flex-1 min-w-0"
      header={
        <div className="flex items-center gap-2">
          <ClockIcon className="w-5 h-5 text-gray-300 shrink-0" />
          <h2 className="text-lg font-medium text-white">Last 90 Days</h2>
        </div>
      }
    >
      {/* No stepper to show: this range is fixed. The band still carries it so
          this column's list starts level with the other three. */}
      <div className="card-band">
        <span className="text-xs font-medium text-ink-muted">{rangeLabel}</span>
      </div>

      <PilotList
        pilots={pilots}
        loading={loading}
        emptyText="No killmail data for the last 90 days"
      />
    </Card>
  );
}

function MonthlyLeaderboard() {
  const today = new Date();
  const defaultMonth = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}`;
  const [month, setMonth] = useState<string>(defaultMonth);
  const isCurrentMonth = month === defaultMonth;

  const { data, loading } = useTopPilotsQuery({
    variables: {
      filter: { period: LeaderboardPeriod.Month, anchor: month, limit: 10 },
    },
  });

  function prevMonth() {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 2, 1)); // m-2 because months are 0-indexed
    setMonth(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
    );
  }

  function nextMonth() {
    if (isCurrentMonth) return;
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m, 1));
    setMonth(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`,
    );
  }

  const monthLabel = new Date(month + '-01T00:00:00Z').toLocaleDateString(
    'en-US',
    {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    },
  );

  const pilots = (data?.topPilots ?? []) as PilotEntry[];

  return (
    <Card
      className="flex-1 min-w-0"
      header={
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="w-5 h-5 text-purple-400 shrink-0" />
          <h2 className="text-lg font-medium text-white">Monthly Top 100</h2>
        </div>
      }
    >
      <div className="card-band">
        <button
          onClick={prevMonth}
          className="button button-secondary button-icon shrink-0"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="w-4 h-4" />
        </button>
        <span className="flex-1 min-w-0 text-xs font-medium text-center text-gray-300 truncate">
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="button button-secondary button-icon shrink-0"
          aria-label="Next month"
        >
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>

      <PilotList
        pilots={pilots}
        loading={loading}
        emptyText="No killmail data for this month"
      />
    </Card>
  );
}

function LeaderboardsContent() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Leaderboards</h1>

      {/* Notice */}
      <p className="text-xs text-ink-faint">
        Updated every 5 minutes. Ranked by kill count only.
      </p>

      {/* Side by side */}
      <div className="flex flex-col gap-8 lg:flex-row lg:gap-6">
        <DailyLeaderboard />
        <WeeklyLeaderboard />
        <MonthlyLeaderboard />
        <Last90DaysLeaderboard />
      </div>
    </div>
  );
}

export default function LeaderboardsPage() {
  return (
    <Suspense
      fallback={<Loader fullHeight size="lg" text="Loading leaderboards..." />}
    >
      <LeaderboardsContent />
    </Suspense>
  );
}
