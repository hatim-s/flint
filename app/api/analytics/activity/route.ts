import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setCurrentUser } from "@/db/lib/rls";
import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { sql, gte } from "drizzle-orm";

interface ActivityDay {
  date: string;
  noteCount: number;
  level: number;
}

// Helper function to get date string in YYYY-MM-DD format
function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    // Set RLS context
    await setCurrentUser(userId);

    // Calculate date range (last 90 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);

    // Query notes grouped by date for last 90 days
    const activityData = await db
      .select({
        date: sql<string>`DATE(${notes.createdAt})`,
        noteCount: sql<number>`COUNT(*)`,
      })
      .from(notes)
      .where(gte(notes.createdAt, startDate))
      .groupBy(sql`DATE(${notes.createdAt})`)
      .orderBy(sql`DATE(${notes.createdAt})`);

    // Create a map of date -> noteCount for easy lookup
    const activityMap = new Map<string, number>();
    activityData.forEach((day) => {
      const dateValue = day.date;
      const noteCountValue = Number(day.noteCount) || 0;
      if (dateValue) {
        activityMap.set(dateValue, noteCountValue);
      }
    });

    // Generate all dates in range (for calendar grid)
    const allDates: ActivityDay[] = [];
    const currentDate = new Date(startDate);

    while (currentDate <= new Date()) {
      const dateStr = toDateString(currentDate);
      const noteCount = activityMap.get(dateStr) || 0;
      
      // Calculate activity level (0-4 for GitHub-style coloring)
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

    // Calculate streaks
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let previousDateStr: string | null = null;

    // Sort dates descending to find current streak
    const sortedDesc = [...allDates].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    for (const day of sortedDesc) {
      if (day.noteCount > 0) {
        if (previousDateStr === null) {
          currentStreak = 1;
          previousDateStr = day.date;
        } else {
          // Get the date before previous date
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

    // Calculate longest streak from all dates
    const sortedAsc = [...allDates].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    for (const day of sortedAsc) {
      if (day.noteCount > 0) {
        tempStreak++;
        longestStreak = Math.max(longestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }

    return NextResponse.json({
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
    return NextResponse.json(
      { error: "Failed to fetch activity data" },
      { status: 500 }
    );
  }
}
