import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { setCurrentUser } from "@/db/lib/rls";
import { db } from "@/db";
import { notes } from "@/db/schema/notes";
import { sql, desc, gte, and } from "drizzle-orm";
import { ZodError, z } from "zod";

// Validation schema for query parameters
const moodTrendsQuerySchema = z.object({
  days: z.coerce.number().min(7).max(90).optional().default(30),
});

export async function GET(req: NextRequest) {
  try {
    // Authenticate user
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate query parameters
    const { searchParams } = new URL(req.url);
    const queryValidation = moodTrendsQuerySchema.safeParse(
      Object.fromEntries(searchParams)
    );
    
    if (!queryValidation.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: queryValidation.error.issues },
        { status: 400 }
      );
    }

    const { days } = queryValidation.data;
    const userId = session.user.id;

    // Set RLS context
    await setCurrentUser(userId);

    // Calculate date range (last N days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Query notes with mood scores grouped by date
    const moodData = await db
      .select({
        date: sql<string>`DATE(${notes.createdAt})`,
        avgMood: sql<number>`AVG(${notes.moodScore})`,
        noteCount: sql<number>`COUNT(*)`,
      })
      .from(notes)
      .where(
        and(
          gte(notes.createdAt, startDate),
          sql`${notes.moodScore} IS NOT NULL`
        )
      )
      .groupBy(sql`DATE(${notes.createdAt})`)
      .orderBy(desc(sql`DATE(${notes.createdAt})`));

    // Sort by date ascending for chart
    const sortedData = moodData.reverse();

    // Calculate 7-day moving average
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

    return NextResponse.json({
      data: movingAverageData,
      days,
      dateRange: {
        start: startDate.toISOString(),
        end: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching mood trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch mood trends" },
      { status: 500 }
    );
  }
}
