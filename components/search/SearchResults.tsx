'use client';

import { useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, BookOpen, Clock, Sparkles, ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/components/ui/lib/utils';

interface SearchResult {
  id: string;
  title: string;
  content: string;
  contentPlain: string | null;
  noteType: 'note' | 'journal';
  moodScore: number | null;
  createdAt: string;
  updatedAt: string;
  score: number;
  keywordRank?: number;
  semanticScore?: number;
}

interface SearchResultsProps {
  results: SearchResult[];
  query: string;
  isLoading: boolean;
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
  className?: string;
}

// Highlight matching text
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const words = query.trim().toLowerCase().split(/\s+/);
  const regex = new RegExp(`(${words.map(w => escapeRegExp(w)).join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = words.some(w => part.toLowerCase() === w.toLowerCase());
    return isMatch ? (
      <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    );
  });
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get preview text around match
function getPreview(content: string, query: string, maxLength: number = 200): string {
  const plainContent = content.replace(/[#*_`~\[\]]/g, '');

  if (!query.trim()) {
    return plainContent.slice(0, maxLength) + (plainContent.length > maxLength ? '...' : '');
  }

  const words = query.trim().toLowerCase().split(/\s+/);
  const lowerContent = plainContent.toLowerCase();

  // Find the first match position
  let firstMatchIndex = -1;
  for (const word of words) {
    const index = lowerContent.indexOf(word);
    if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
      firstMatchIndex = index;
    }
  }

  if (firstMatchIndex === -1) {
    return plainContent.slice(0, maxLength) + (plainContent.length > maxLength ? '...' : '');
  }

  // Get context around the match
  const start = Math.max(0, firstMatchIndex - 50);
  const end = Math.min(plainContent.length, firstMatchIndex + maxLength - 50);
  let preview = plainContent.slice(start, end);

  if (start > 0) preview = '...' + preview;
  if (end < plainContent.length) preview = preview + '...';

  return preview;
}

// Format relative time
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

// Score badge color
function getScoreColor(score: number): string {
  if (score >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
  if (score >= 0.6) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
  if (score >= 0.4) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
  return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
}

function SearchResults({
  results,
  query,
  isLoading,
  selectedIndex,
  onSelectIndex,
  className,
}: SearchResultsProps) {
  const router = useRouter();
  const resultsRef = useRef<HTMLDivElement>(null);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsRef.current) {
      const item = resultsRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      item?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [selectedIndex]);

  // Keyboard navigation handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (results.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          onSelectIndex(Math.min(selectedIndex + 1, results.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          onSelectIndex(Math.max(selectedIndex - 1, 0));
          break;
        case 'Enter':
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            e.preventDefault();
            const result = results[selectedIndex];
            if (result) {
              router.push(`/notes/${result.id}`);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [results, selectedIndex, onSelectIndex, router]);

  const handleResultClick = useCallback((id: string) => {
    router.push(`/notes/${id}`);
  }, [router]);

  if (isLoading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-16" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (results.length === 0 && query) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <div className="rounded-full bg-muted p-4 mb-4">
          <Sparkles className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">No results found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          We couldn't find any notes matching "{query}". Try different keywords or adjust your filters.
        </p>
        <div className="mt-4 text-xs text-muted-foreground space-y-1">
          <p>Suggestions:</p>
          <ul className="list-disc list-inside">
            <li>Use fewer or different keywords</li>
            <li>Check your spelling</li>
            <li>Try semantic search for concept matching</li>
          </ul>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-2">Start searching</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Type a query above to search through your notes. We'll use AI to find semantically similar content.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Results count and keyboard hint */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <ArrowUp className="h-3 w-3" />
            <ArrowDown className="h-3 w-3" />
            navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" />
            open
          </span>
        </div>
      </div>

      {/* Results list */}
      <div ref={resultsRef} className="space-y-2">
        {results.map((result, index) => (
          <Card
            key={result.id}
            data-index={index}
            onClick={() => handleResultClick(result.id)}
            onMouseEnter={() => onSelectIndex(index)}
            className={cn(
              'cursor-pointer transition-colors hover:bg-accent/50',
              selectedIndex === index && 'ring-2 ring-primary bg-accent/50'
            )}
          >
            <CardContent className="p-4">
              <div className="space-y-2">
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <h4 className="font-medium text-sm leading-tight flex-1 line-clamp-1">
                    {highlightText(result.title, query)}
                  </h4>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', getScoreColor(result.score))}
                    >
                      {Math.round(result.score * 100)}% match
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {result.noteType === 'journal' ? (
                        <>
                          <BookOpen className="h-3 w-3 mr-1" />
                          Journal
                        </>
                      ) : (
                        <>
                          <FileText className="h-3 w-3 mr-1" />
                          Note
                        </>
                      )}
                    </Badge>
                  </div>
                </div>

                {/* Preview text */}
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {highlightText(getPreview(result.contentPlain || result.content, query), query)}
                </p>

                {/* Footer row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatRelativeTime(result.updatedAt)}
                  </span>
                  {result.moodScore && (
                    <span>Mood: {result.moodScore}/10</span>
                  )}
                  {result.semanticScore !== undefined && result.keywordRank !== undefined && (
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Semantic: {Math.round(result.semanticScore * 100)}%
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Loading skeleton component
function SearchResultsSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export { SearchResults, SearchResultsSkeleton };
export type { SearchResult };
