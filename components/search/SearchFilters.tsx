"use client";

import {
  BookOpen,
  ChevronDown,
  FileText,
  Filter,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/components/ui/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface SearchFiltersState {
  noteType: "all" | "note" | "journal";
  tags: string[];
  moodRange: [number, number];
  searchMode: "hybrid" | "keyword" | "semantic";
}

interface SearchFiltersProps {
  filters: SearchFiltersState;
  onChange: (filters: SearchFiltersState) => void;
  availableTags?: Array<{ id: string; name: string; color: string }>;
  className?: string;
}

export const defaultFilters: SearchFiltersState = {
  noteType: "all",
  tags: [],
  moodRange: [1, 10],
  searchMode: "hybrid",
};

export function SearchFilters({
  filters,
  onChange,
  availableTags = [],
  className,
}: SearchFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Count active filters
  const activeFilterCount = [
    filters.noteType !== "all" ? 1 : 0,
    filters.tags.length > 0 ? 1 : 0,
    filters.moodRange[0] !== 1 || filters.moodRange[1] !== 10 ? 1 : 0,
    filters.searchMode !== "hybrid" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const handleNoteTypeChange = (value: string) => {
    if (value) {
      onChange({
        ...filters,
        noteType: value as SearchFiltersState["noteType"],
      });
    }
  };

  const handleSearchModeChange = (value: string) => {
    if (value) {
      onChange({
        ...filters,
        searchMode: value as SearchFiltersState["searchMode"],
      });
    }
  };

  const handleTagToggle = (tagName: string) => {
    const newTags = filters.tags.includes(tagName)
      ? filters.tags.filter((t) => t !== tagName)
      : [...filters.tags, tagName];
    onChange({ ...filters, tags: newTags });
  };

  const handleMoodChange = (value: number[]) => {
    if (value.length === 2) {
      // biome-ignore lint/style/noNonNullAssertion: value has atleast 2 elements
      onChange({ ...filters, moodRange: [value[0]!, value[1]!] });
    }
  };

  const clearFilters = () => {
    onChange(defaultFilters);
  };

  const hasActiveFilters = activeFilterCount > 0;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            {/* Note Type Filter */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Note Type
              </Label>
              <ToggleGroup
                type="single"
                value={filters.noteType}
                onValueChange={handleNoteTypeChange}
                variant="outline"
                className="justify-start"
              >
                <ToggleGroupItem value="all" className="text-xs">
                  All
                </ToggleGroupItem>
                <ToggleGroupItem value="note" className="text-xs">
                  <FileText className="h-3 w-3 mr-1" />
                  Notes
                </ToggleGroupItem>
                <ToggleGroupItem value="journal" className="text-xs">
                  <BookOpen className="h-3 w-3 mr-1" />
                  Journal
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Search Mode */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">
                Search Mode
              </Label>
              <ToggleGroup
                type="single"
                value={filters.searchMode}
                onValueChange={handleSearchModeChange}
                variant="outline"
                className="justify-start"
              >
                <ToggleGroupItem value="hybrid" className="text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Hybrid
                </ToggleGroupItem>
                <ToggleGroupItem value="keyword" className="text-xs">
                  Keyword
                </ToggleGroupItem>
                <ToggleGroupItem value="semantic" className="text-xs">
                  Semantic
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            {/* Mood Range Slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">
                  Mood Range
                </Label>
                <span className="text-xs text-muted-foreground">
                  {filters.moodRange[0]} - {filters.moodRange[1]}
                </span>
              </div>
              <Slider
                value={filters.moodRange}
                onValueChange={handleMoodChange}
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

            {/* Tags Filter */}
            {availableTags.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">
                  Tags
                </Label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {availableTags.map((tag) => (
                    <Badge
                      key={tag.id}
                      variant={
                        filters.tags.includes(tag.name) ? "default" : "outline"
                      }
                      className={cn(
                        "cursor-pointer text-xs transition-colors",
                        filters.tags.includes(tag.name) &&
                          "bg-primary text-primary-foreground",
                      )}
                      style={{
                        borderColor: filters.tags.includes(tag.name)
                          ? undefined
                          : tag.color,
                      }}
                      onClick={() => handleTagToggle(tag.name)}
                    >
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Clear Button */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full text-xs text-muted-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all filters
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Active filter badges */}
      {filters.noteType !== "all" && (
        <Badge variant="secondary" className="h-7 gap-1">
          {filters.noteType === "note" ? (
            <>
              <FileText className="h-3 w-3" /> Notes
            </>
          ) : (
            <>
              <BookOpen className="h-3 w-3" /> Journal
            </>
          )}
          <button
            onClick={() => onChange({ ...filters, noteType: "all" })}
            className="ml-1 hover:text-foreground"
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {filters.tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="h-7 gap-1">
          #{tag}
          <button
            onClick={() => handleTagToggle(tag)}
            className="ml-1 hover:text-foreground"
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {(filters.moodRange[0] !== 1 || filters.moodRange[1] !== 10) && (
        <Badge variant="secondary" className="h-7 gap-1">
          Mood: {filters.moodRange[0]}-{filters.moodRange[1]}
          <button
            onClick={() => onChange({ ...filters, moodRange: [1, 10] })}
            className="ml-1 hover:text-foreground"
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}

      {filters.searchMode !== "hybrid" && (
        <Badge variant="secondary" className="h-7 gap-1">
          {filters.searchMode === "semantic" && (
            <Sparkles className="h-3 w-3" />
          )}
          {filters.searchMode}
          <button
            onClick={() => onChange({ ...filters, searchMode: "hybrid" })}
            className="ml-1 hover:text-foreground"
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      )}
    </div>
  );
}
