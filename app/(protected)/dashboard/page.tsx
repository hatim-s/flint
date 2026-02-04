"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, Plus, BookOpen, Clock, Mic } from "lucide-react";
import { CreateNoteModal } from "@/components/notes";
import { RecentNotes } from "@/components/dashboard/RecentNotes";
import { MoodChart } from "@/components/dashboard/MoodChart";
import { useState, useEffect } from "react";

// Helper function to get time-based greeting
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Helper function to format date
function getFormattedDate() {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Loading skeleton for dashboard quadrants
function QuadrantSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-4 w-48 mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: session, isPending } = useSession();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Global keyboard shortcut: Cmd+N / Ctrl+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        setIsCreateModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const user = session?.user;
  const greeting = getGreeting();
  const formattedDate = getFormattedDate();
  const userName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-950">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold">Flint</h1>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.image || undefined} alt={user.name} />
                    <AvatarFallback>
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium hidden sm:inline">{user.name}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    signOut({
                      fetchOptions: {
                        onSuccess: () => {
                          window.location.href = "/login";
                        },
                      },
                    })
                  }
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Dashboard Content */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">
          {/* Dashboard Header with Greeting and Quick Actions */}
          <div className="mb-8">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold">
                  {greeting}, {userName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{formattedDate}</p>
              </div>
              
              {/* Quick Action Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setIsCreateModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Note
                </Button>
                <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  New Journal
                </Button>
                <Button variant="outline" disabled title="Coming soon">
                  <Mic className="w-4 h-4 mr-2" />
                  Voice Capture
                </Button>
              </div>
            </div>

            {/* Keyboard Shortcut Hint */}
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">
                Press{" "}
                <kbd className="px-2 py-1 text-xs bg-muted rounded border">Cmd+N</kbd> or{" "}
                <kbd className="px-2 py-1 text-xs bg-muted rounded border">Ctrl+N</kbd> to
                create a new note
              </p>
            </div>
          </div>

          {/* 4-Quadrant Grid Layout */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Quadrant 1: Mood Trends (Top-Left) */}
            <MoodChart />

            {/* Quadrant 2: Calendar/Streaks (Top-Right) */}
            <Card className="lg:row-span-1">
              <CardHeader>
                <CardTitle>Writing Streak</CardTitle>
                <CardDescription>Keep the momentum going</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                  Streak calendar coming soon
                </div>
              </CardContent>
            </Card>

            {/* Quadrant 3: Recent Notes (Bottom-Left) */}
            <RecentNotes onCreateNote={() => setIsCreateModalOpen(true)} />

            {/* Quadrant 4: Weekly Summary (Bottom-Right) */}
            <Card className="lg:row-span-1">
              <CardHeader>
                <CardTitle>Weekly Summary</CardTitle>
                <CardDescription>AI-powered insights from your week</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                  Weekly AI summary coming soon
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Create Note Modal */}
      <CreateNoteModal open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} />
    </div>
  );
}
