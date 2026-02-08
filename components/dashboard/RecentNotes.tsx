"use client";

import { formatDistanceToNow } from "date-fns";
import { ArrowRight, Clock, FileText, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/api/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Note } from "@/db/schema/notes";

interface RecentNotesProps {
  onCreateNote?: () => void;
}

export function RecentNotes({ onCreateNote }: RecentNotesProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecentNotes = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch last 5 notes ordered by updatedAt
        const response = await api.notes.$get({
          query: {
            limit: "5",
            sortBy: "updatedAt",
            sortOrder: "desc",
          },
        });

        console.log(response);

        if (!response.ok) {
          throw new Error("Failed to fetch notes");
        }

        const data = await response.json();
        setNotes(data.data || []);
      } catch (err) {
        console.error("Error fetching recent notes:", err);
        setError("Failed to load recent notes");
      } finally {
        setIsLoading(false);
      }
    };

    fetchRecentNotes();
  }, []);

  // Generate preview text (first 100 chars of plain content)
  const getPreview = (note: Note) => {
    const plainText = note.contentPlain || note.content || "";
    return plainText.length > 100 ? `${plainText.slice(0, 100)}...` : plainText;
  };

  // Format relative time
  const getRelativeTime = (date: Date | string) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return "Recently";
    }
  };

  if (isLoading) {
    return (
      <Card className="lg:row-span-1">
        <CardHeader>
          <CardTitle>Recent Notes</CardTitle>
          <CardDescription>Your latest thoughts and ideas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="lg:row-span-1">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Notes</CardTitle>
            <CardDescription>Your latest thoughts and ideas</CardDescription>
          </div>
          {notes.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/notes")}
              className="text-muted-foreground hover:text-foreground"
            >
              View all
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="flex items-center justify-center h-64 text-sm text-destructive">
            {error}
          </div>
        )}

        {!error && notes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                No notes yet
              </p>
              <p className="text-sm text-muted-foreground/70">
                Create your first note to get started
              </p>
            </div>
            {onCreateNote && (
              <Button onClick={onCreateNote} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Create your first note
              </Button>
            )}
          </div>
        )}

        {!error && notes.length > 0 && (
          <div className="space-y-4">
            {notes.map((note) => (
              // biome-ignore lint/a11y/noStaticElementInteractions: is okay
              // biome-ignore lint/a11y/useKeyWithClickEvents: is okay
              <div
                key={note.id}
                onClick={() => router.push(`/notes/${note.id}`)}
                className="group cursor-pointer rounded-lg border p-4 transition-all hover:border-primary hover:bg-accent/50"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium line-clamp-1 group-hover:text-primary transition-colors">
                    {note.title || "Untitled"}
                  </h3>
                  <Badge
                    variant={
                      note.noteType === "journal" ? "default" : "secondary"
                    }
                    className="shrink-0"
                  >
                    {note.noteType === "journal" ? "Journal" : "Note"}
                  </Badge>
                </div>

                {getPreview(note) && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {getPreview(note)}
                  </p>
                )}

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{getRelativeTime(note.updatedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
