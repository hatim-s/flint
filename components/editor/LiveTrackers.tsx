"use client";

import { FileText, Smile } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

interface LiveTrackersProps {
  moodScore: number;
  onMoodChange: (value: number) => void;
  wordCount: number;
  noteType?: "note" | "journal";
}

const MOOD_LABELS = [
  { range: [1, 2], label: "Very Low", color: "bg-red-500" },
  { range: [3, 4], label: "Low", color: "bg-orange-500" },
  { range: [5, 6], label: "Neutral", color: "bg-yellow-500" },
  { range: [7, 8], label: "Good", color: "bg-green-500" },
  { range: [9, 10], label: "Excellent", color: "bg-emerald-500" },
];

function getMoodLabel(score: number) {
  const mood = MOOD_LABELS.find(
    // biome-ignore lint/style/noNonNullAssertion: range has atleast 2 elements
    ({ range }) => score >= range[0]! && score <= range[1]!,
  );
  // biome-ignore lint/style/noNonNullAssertion: mood labels has enough items
  return mood ?? MOOD_LABELS[2]!; // Default to neutral
}

export function LiveTrackers({
  moodScore,
  onMoodChange,
  wordCount,
  noteType,
}: LiveTrackersProps) {
  const currentMood = getMoodLabel(moodScore);

  return (
    <div className="space-y-4">
      {/* Mood Tracker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smile className="h-4 w-4" />
            Mood Tracker
          </CardTitle>
          <CardDescription>How are you feeling?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Score: {moodScore}</span>
              <Badge variant="secondary" className={currentMood.color}>
                {currentMood.label}
              </Badge>
            </div>
            <Slider
              value={[moodScore]}
              onValueChange={(values) => onMoodChange(values[0] ?? 5)}
              min={1}
              max={10}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Low</span>
              <span>High</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Word Count */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            Statistics
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Word Count</span>
            <span className="text-lg font-semibold">{wordCount}</span>
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Type</span>
            <Badge variant={noteType === "journal" ? "default" : "secondary"}>
              {noteType === "journal" ? "Journal" : "Note"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
