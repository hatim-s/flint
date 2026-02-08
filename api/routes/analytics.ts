import { createApp } from "../app";
import { rlsExecutor } from "@/db/lib/rls";
import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { sql, gte, and, desc } from "drizzle-orm";
import { z } from "zod";


interface ActivityDay {
  date: string;
  noteCount: number;
  level: number;
}

function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const moodTrendsQuerySchema = z.object({
  days: z.coerce.number().min(7).max(90).optional().default(30),
});

const app = createApp().get("/analytics/activity", async (c) => {
  try {
    const userId = c.get("userId");
    const rls = rlsExecutor(userId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    const activityData = await db
      .select({
        date: sql<string>`DATE(${notes.createdAt})`,
        noteCount: sql<number>`COUNT(*)`,
      })
      .from(notes)
      .where(and(rls.where(notes), gte(notes.createdAt, startDate)))
      .groupBy(sql`DATE(${notes.createdAt})`)
      .orderBy(sql`DATE(${notes.createdAt})`);

    const activityMap = new Map<string, number>();
    activityData.forEach((day) => {
      const dateValue = day.date;
      const noteCountValue = Number(day.noteCount) || 0;
      if (dateValue) {
        activityMap.set(dateValue, noteCountValue);
      }
    });

    const allDates: ActivityDay[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= new Date()) {
      const dateStr = toDateString(currentDate);
      const noteCount = activityMap.get(dateStr) || 0;

      let level = 0;
      if (noteCount >= 1) level = 1;
      if (noteCount >= 2) level = 2;
      if (noteCount >= 4) level = 3;
      if (noteCount >= 6) level = 4;

      allDates.push({
        date: dateStr,
        noteCount,
        level,
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let previousDateStr: string | null = null;

    const sortedDesc = [...allDates].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const day of sortedDesc) {
      if (day.noteCount > 0) {
        if (previousDateStr === null) {
          currentStreak = 1;
          previousDateStr = day.date;
        } else {
          const prevDate = new Date(previousDateStr);
          const dayBeforeDate = new Date(prevDate);
          dayBeforeDate.setDate(dayBeforeDate.getDate() - 1);
          const dayBeforeStr = toDateString(dayBeforeDate);

          if (day.date === dayBeforeStr) {
            currentStreak++;
          } else {
            break;
          }
          previousDateStr = day.date;
        }
      } else {
        break;
      }
    }

    const sortedAsc = [...allDates].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const day of sortedAsc) {
      if (day.noteCount > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return c.json({
      data: allDates,
      currentStreak,
      longestStreak,
      totalNotes: sortedDesc.reduce((sum, day) => sum + day.noteCount, 0),
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching activity data:", error);
    return c.json({ error: "Failed to fetch activity data" }, 500);
  }
}).get("/analytics/mood-trends", async (c) => {
  try {
    const { searchParams } = new URL(c.req.url);
    const queryValidation = moodTrendsQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );

    if (!queryValidation.success) {
      return c.json(
        { error: "Invalid query parameters", details: queryValidation.error.issues },
        400
      );
    }

    const { days } = queryValidation.data;
    const userId = c.get("userId");
    const rls = rlsExecutor(userId);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const moodData = await db
      .select({
        date: sql<string>`DATE(${notes.createdAt})`,
        avgMood: sql<number>`AVG(${notes.moodScore})`,
        noteCount: sql<number>`COUNT(*)`,
      })
      .from(notes)
      .where(
        and(
          rls.where(notes),
          gte(notes.createdAt, startDate),
          sql`${notes.moodScore} IS NOT NULL`
        )
      )
      .groupBy(sql`DATE(${notes.createdAt})`)
      .orderBy(desc(sql`DATE(${notes.createdAt})`));

    const sortedData = moodData.reverse();

    const movingAverageData = sortedData.map((day, index) => {
      const start = Math.max(0, index - 6);
      const weekData = sortedData.slice(start, index + 1);
      const avgMood =
        weekData.reduce((sum, d) => sum + (d.avgMood || 0), 0) / weekData.length;
      return {
        date: day.date,
        avgMood: Number(day.avgMood) || 0,
        noteCount: Number(day.noteCount) || 0,
        movingAverage: Number(avgMood.toFixed(2)),
      };
    });

    return c.json({
      data: movingAverageData,
      days,
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching mood trends:", error);
    return c.json({ error: "Failed to fetch mood trends" }, 500);
  }
});

export default app;
