"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "@/api/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface MoodDataPoint {
  date: string;
  avgMood: number;
  noteCount: number;
  movingAverage: number;
}

interface MoodTrendsResponse {
  data: MoodDataPoint[];
  days: number;
  dateRange: {
    start: string;
    end: string;
  };
}

interface MoodChartProps {
  days?: number;
}

export function MoodChart({ days = 30 }: MoodChartProps) {
  const [data, setData] = useState<MoodDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMoodTrends() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await api.analytics["mood-trends"].$get({
          query: { days: String(days) },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch mood trends");
        }

        const result: MoodTrendsResponse = await response.json();
        setData(result.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setIsLoading(false);
      }
    }

    fetchMoodTrends();
  }, [days]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Determine color based on mood score
  const getMoodColor = (mood: number) => {
    if (mood >= 7) return "#22c55e"; // green
    if (mood >= 4) return "#eab308"; // yellow
    return "#ef4444"; // red
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
          <CardTitle>Mood Trends</CardTitle>
          <CardDescription>Your emotional patterns over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
            {error}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Mood Trends</CardTitle>
          <CardDescription>Your emotional patterns over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
            No mood data yet. Start journaling to see your trends!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mood Trends</CardTitle>
        <CardDescription>
          Your emotional patterns over the last {days} days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={256}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              className="text-xs"
            />
            <YAxis
              domain={[1, 10]}
              ticks={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}
              className="text-xs"
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0]?.payload;
                  if (!data) return null;
                  return (
                    <div className="bg-background border rounded-lg p-3 shadow-md">
                      <p className="font-semibold">{formatDate(data.date)}</p>
                      <div className="mt-2 space-y-1 text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: getMoodColor(data.avgMood),
                            }}
                          />
                          <span>Average Mood: {data.avgMood.toFixed(1)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-500" />
                          <span>
                            Moving Average: {data.movingAverage.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">
                            {data.noteCount}{" "}
                            {data.noteCount === 1 ? "note" : "notes"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Line
              type="monotone"
              dataKey="avgMood"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: "#8b5cf6", r: 4 }}
              activeDot={{ r: 6 }}
              name="Average Mood"
            />
            <Line
              type="monotone"
              dataKey="movingAverage"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="7-Day Moving Average"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
