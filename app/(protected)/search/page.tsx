"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "@/auth/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, ArrowLeft, Search as SearchIcon } from "lucide-react";
import {
  SearchBar,
  SearchFilters,
  SearchResults,
  defaultFilters,
  type SearchFiltersState,
  type SearchResult,
} from "@/components/search";

interface HybridSearchResponse {
  results: SearchResult[];
  count: number;
  offset: number;
  limit: number;
  query: string;
  searchMode: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

export default function SearchPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  
  // Search state
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<SearchFiltersState>(defaultFilters);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  // Fetch available tags for filter
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          setAvailableTags(data);
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      }
    };
    fetchTags();
  }, []);

  // Global keyboard shortcut: Cmd+K / Ctrl+K to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        // Focus on search input
        const searchInput = document.querySelector<HTMLInputElement>(
          'input[type="text"]'
        );
        searchInput?.focus();
      }
      // Escape to go back
      if (e.key === "Escape" && !query) {
        router.back();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router, query]);

  // Perform search
  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFiltersState) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    setSelectedIndex(-1);

    try {
      const params = new URLSearchParams({
        q: searchQuery,
        limit: "20",
        searchMode: searchFilters.searchMode,
      });

      if (searchFilters.noteType !== "all") {
        params.set("noteType", searchFilters.noteType);
      }

      if (searchFilters.tags.length > 0) {
        params.set("tags", searchFilters.tags.join(","));
      }

      if (searchFilters.moodRange[0] !== 1) {
        params.set("minMood", searchFilters.moodRange[0].toString());
      }

      if (searchFilters.moodRange[1] !== 10) {
        params.set("maxMood", searchFilters.moodRange[1].toString());
      }

      const response = await fetch(`/api/search?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Search failed");
      }

      const data: HybridSearchResponse = await response.json();
      setResults(data.results);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Trigger search when query or filters change
  useEffect(() => {
    performSearch(query, filters);
  }, [query, filters, performSearch]);

  // Handle query change from search bar
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
  };

  // Handle filter change
  const handleFiltersChange = (newFilters: SearchFiltersState) => {
    setFilters(newFilters);
  };

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const user = session?.user;

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b bg-white dark:bg-zinc-950 sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Button>
            <div className="flex items-center gap-2">
              <SearchIcon className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-semibold">Search</h1>
            </div>
          </div>
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
                  variant="outline"
                  size="sm"
                  onClick={() => signOut({ fetchOptions: { onSuccess: () => router.push("/login") } })}
                >
                  <LogOut className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Sign out</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
          {/* Search Bar */}
          <div className="space-y-4">
            <SearchBar
              value={query}
              onChange={handleQueryChange}
              placeholder="Search notes by keywords or concepts..."
              autoFocus
              className="w-full"
            />

            {/* Filters */}
            <SearchFilters
              filters={filters}
              onChange={handleFiltersChange}
              availableTags={availableTags}
            />

            {/* Keyboard shortcut hint */}
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">
                {typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
                  ? "Cmd"
                  : "Ctrl"}
              </kbd>
              <span>+</span>
              <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-muted border border-border rounded">
                K
              </kbd>
              <span>to focus search</span>
            </div>
          </div>

          {/* Search Results */}
          <div className="mt-6">
            <SearchResults
              results={results}
              query={query}
              isLoading={isLoading}
              selectedIndex={selectedIndex}
              onSelectIndex={setSelectedIndex}
            />
          </div>
        </div>
      </main>

      {/* Footer hint */}
      {results.length > 0 && (
        <footer className="border-t bg-white dark:bg-zinc-950 py-3">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-semibold bg-muted border border-border rounded">
                  ↑
                </kbd>
                <kbd className="px-1.5 py-0.5 font-semibold bg-muted border border-border rounded">
                  ↓
                </kbd>
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-semibold bg-muted border border-border rounded">
                  Enter
                </kbd>
                Open note
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 font-semibold bg-muted border border-border rounded">
                  Esc
                </kbd>
                Go back
              </span>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
