/** biome-ignore-all lint/suspicious/noArrayIndexKey: is okay since none of them are deletable or draggable */
"use client";

import { Calendar, Flame } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityDay {
  date: string;
  noteCount: number;
  level: number;
}

interface ActivityResponse {
  data: ActivityDay[];
  currentStreak: number;
  longestStreak: number;
  totalNotes: number;
  dateRange: {
    start: string;
    end: string;
  };
}

interface StreakCalendarProps {
  days?: number;
}

export function StreakCalendar({ days = 90 }: StreakCalendarProps) {
  const [data, setData] = useState<ActivityDay[]>([]);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<ActivityDay | null>(null);

  useEffect(() => {
    async function fetchActivity() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await api.analytics.activity.$get();

        if (!response.ok) {
          throw new Error("Failed to fetch activity data");
        }

        const result: ActivityResponse = await response.json();
        setData(result.data);
        setCurrentStreak(result.currentStreak);
        setLongestStreak(result.longestStreak);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchActivity();
  }, []);

  // Format date string helper
  const toDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Get color based on activity level
  const getLevelColor = (level: number) => {
    if (level === 0) return "bg-muted/20";
    if (level === 1) return "bg-green-200 dark:bg-green-900";
    if (level === 2) return "bg-green-400 dark:bg-green-700";
    if (level === 3) return "bg-green-600 dark:bg-green-500";
    return "bg-green-800 dark:bg-green-400";
  };

  // Format date for tooltip
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Writing Streak</CardTitle>
          <CardDescription>Keep the momentum going</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Create data map for quick lookup
  const dataMap = new Map<string, ActivityDay>();
  data.forEach((day) => {
    dataMap.set(day.date, day);
  });

  // Generate calendar grid
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const endDate = new Date();

  const calendarData: Array<{
    date: string;
    day: ActivityDay | null;
    isNewWeek: boolean;
    isNewMonth: boolean;
  }> = [];

  const currentDate = new Date(startDate);
  let lastDayOfWeek = -1;
  let lastMonth = -1;

  while (currentDate <= endDate) {
    const dateStr = toDateString(currentDate);
    const dayOfWeek = currentDate.getDay();
    const month = currentDate.getMonth();
    const isNewWeek = dayOfWeek < lastDayOfWeek;
    const isNewMonth = month !== lastMonth;

    calendarData.push({
      date: dateStr,
      day: dataMap.get(dateStr) || null,
      isNewWeek,
      isNewMonth,
    });

    lastDayOfWeek = dayOfWeek;
    lastMonth = month;
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Group by month
  const monthGroups: Array<{
    month: string;
    weeks: Array<(ActivityDay | null)[]>;
  }> = [];

  let currentGroup: Array<(ActivityDay | null)[]> = [];
  let currentWeek: (ActivityDay | null)[] = [];
  let currentMonthName = "";

  calendarData.forEach((item) => {
    const monthName = new Date(item.date).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    if (monthName !== currentMonthName) {
      if (currentWeek.length > 0) {
        currentGroup.push([...currentWeek]);
      }
      if (currentGroup.length > 0) {
        monthGroups.push({ month: currentMonthName, weeks: [...currentGroup] });
      }
      currentGroup = [];
      currentWeek = [];
      currentMonthName = monthName;
    }

    currentWeek.push(item.day);

    if (item.isNewWeek) {
      if (currentWeek.length > 0) {
        currentGroup.push([...currentWeek]);
      }
      currentWeek = [];
    }
  });

  // Add last week and month
  if (currentWeek.length > 0) {
    currentGroup.push([...currentWeek]);
  }
  if (currentGroup.length > 0) {
    monthGroups.push({ month: currentMonthName, weeks: [...currentGroup] });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Writing Streak</CardTitle>
            <CardDescription>Keep the momentum going</CardDescription>
          </div>
          {currentStreak > 0 && (
            <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950 px-3 py-1.5 rounded-full">
              <Flame className="h-5 w-5 text-orange-500" />
              <span className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {currentStreak}
              </span>
              <span className="text-sm text-muted-foreground">
                {currentStreak === 1 ? "day" : "days"}
              </span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Longest streak display */}
          <div className="flex items-center gap-4 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Longest streak:{" "}
              <span className="font-semibold text-foreground">
                {longestStreak}
              </span>{" "}
              days
            </span>
          </div>

          {/* GitHub-style contribution calendar */}
          <div className="space-y-4">
            {monthGroups.map((monthData, monthIndex) => (
              <div key={monthIndex}>
                <h4 className="text-sm font-medium mb-2">{monthData.month}</h4>
                <div className="flex gap-1">
                  {monthData.weeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-1">
                      {week.map((day, dayIndex) => {
                        if (!day)
                          return (
                            <div
                              key={dayIndex}
                              className="w-3 h-3 rounded-sm"
                            />
                          );

                        return (
                          // biome-ignore lint/a11y/noStaticElementInteractions: is okay
                          <div
                            key={dayIndex}
                            className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:ring-2 hover:ring-offset-1 hover:ring-primary ${getLevelColor(day.level)}`}
                            onMouseEnter={() => setHoveredDate(day)}
                            onMouseLeave={() => setHoveredDate(null)}
                            title={`${day.noteCount} ${day.noteCount === 1 ? "note" : "notes"}`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Tooltip for hovered day */}
          {hoveredDate && (
            <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-50 bg-background/50 backdrop-blur-sm">
              <div className="bg-background border rounded-lg p-4 shadow-lg max-w-sm pointer-events-auto">
                <p className="font-semibold mb-2">
                  {formatDate(hoveredDate.date)}
                </p>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="text-muted-foreground">
                      Notes created:
                    </span>{" "}
                    <span className="font-medium">{hoveredDate.noteCount}</span>
                  </div>
                  {hoveredDate.noteCount > 0 && (
                    <div>
                      <span className="text-muted-foreground">
                        Activity level:
                      </span>{" "}
                      <span className="font-medium">{hoveredDate.level}/4</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
