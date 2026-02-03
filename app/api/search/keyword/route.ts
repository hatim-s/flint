/**
 * Keyword Search API Route
 * 
 * Provides full-text search functionality for notes using PostgreSQL's
 * GIN index-backed search capabilities.
 * 
 * GET /api/search/keyword?q=<query>&limit=20&offset=0&noteType=note&minMood=5&maxMood=10
 */

import { auth } from "@/auth";
import { searchNotes, countSearchResults } from "@/db/lib/search";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be logged in to search notes" },
        { status: 401 }
      );
    }

    // Extract search parameters from URL
    const { searchParams } = request.nextUrl;
    const query = searchParams.get("q") || "";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const noteType = searchParams.get("noteType") as "note" | "journal" | null;
    const minMoodScore = searchParams.get("minMood") 
      ? parseInt(searchParams.get("minMood")!, 10) 
      : undefined;
    const maxMoodScore = searchParams.get("maxMood")
      ? parseInt(searchParams.get("maxMood")!, 10)
      : undefined;
    const includeCount = searchParams.get("includeCount") === "true";

    // Validate query parameter
    if (!query.trim()) {
      return NextResponse.json(
        { 
          error: "Bad Request", 
          message: "Search query parameter 'q' is required and cannot be empty" 
        },
        { status: 400 }
      );
    }

    // Validate limit and offset
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        { 
          error: "Bad Request", 
          message: "Limit must be between 1 and 100" 
        },
        { status: 400 }
      );
    }

    if (offset < 0) {
      return NextResponse.json(
        { 
          error: "Bad Request", 
          message: "Offset must be non-negative" 
        },
        { status: 400 }
      );
    }

    // Validate mood scores if provided
    if (minMoodScore !== undefined && (minMoodScore < 1 || minMoodScore > 10)) {
      return NextResponse.json(
        { 
          error: "Bad Request", 
          message: "minMood must be between 1 and 10" 
        },
        { status: 400 }
      );
    }

    if (maxMoodScore !== undefined && (maxMoodScore < 1 || maxMoodScore > 10)) {
      return NextResponse.json(
        { 
          error: "Bad Request", 
          message: "maxMood must be between 1 and 10" 
        },
        { status: 400 }
      );
    }

    if (minMoodScore !== undefined && maxMoodScore !== undefined && minMoodScore > maxMoodScore) {
      return NextResponse.json(
        { 
          error: "Bad Request", 
          message: "minMood cannot be greater than maxMood" 
        },
        { status: 400 }
      );
    }

    // Perform the search
    const results = await searchNotes({
      userId: session.user.id,
      query,
      limit,
      offset,
      noteType: noteType || undefined,
      minMoodScore,
      maxMoodScore,
    });

    // Optionally include total count for pagination
    let totalCount: number | undefined;
    if (includeCount) {
      totalCount = await countSearchResults({
        userId: session.user.id,
        query,
        noteType: noteType || undefined,
        minMoodScore,
        maxMoodScore,
      });
    }

    // Return search results
    return NextResponse.json({
      results,
      query,
      count: results.length,
      totalCount,
      pagination: {
        limit,
        offset,
        hasMore: includeCount ? offset + results.length < totalCount! : undefined,
      },
    });
  } catch (error) {
    console.error("Search API error:", error);
    
    return NextResponse.json(
      { 
        error: "Internal Server Error", 
        message: error instanceof Error ? error.message : "An unexpected error occurred while searching" 
      },
      { status: 500 }
    );
  }
}
