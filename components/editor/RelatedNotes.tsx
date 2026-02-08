'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Link2, LinkIcon, Unlink, ExternalLink, Sparkles, RefreshCw, FileText, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/api/client';

interface RelatedNote {
  id: string;
  title: string;
  preview: string;
  noteType: 'note' | 'journal';
  similarity: number;
  createdAt: string;
  updatedAt: string;
  isLinked: boolean;
}

interface RelatedNotesProps {
  noteId: string;
  content?: string;
  debounceMs?: number;
}

export function RelatedNotes({ noteId, content, debounceMs = 30000 }: RelatedNotesProps) {
  const [relatedNotes, setRelatedNotes] = useState<RelatedNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasEmbedding, setHasEmbedding] = useState(false);
  const [isLinking, setIsLinking] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track last content that was used for refresh
  const lastContentRef = useRef<string>('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch related notes on initial load (using stored embedding)
  const fetchRelatedNotes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.notes[":id"].related.$get({
        param: { id: noteId },
        query: { limit: "5" },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch related notes');
      }

      const data = await response.json();
      setRelatedNotes(data.related || []);
      setHasEmbedding(data.hasEmbedding ?? false);
    } catch (error) {
      console.error('Error fetching related notes:', error);
      // Don't show error toast on initial load - might just be no embedding yet
    } finally {
      setIsLoading(false);
    }
  }, [noteId]);

  // Refresh related notes based on current content
  const refreshFromContent = useCallback(async (contentToAnalyze: string) => {
    if (!contentToAnalyze || contentToAnalyze.trim().length < 50) {
      return; // Not enough content
    }

    try {
      setIsRefreshing(true);
      const response = await api.notes[":id"].related.$post({
        param: { id: noteId },
        query: { limit: "5" },
        json: { content: contentToAnalyze },
      });

      if (!response.ok) {
        throw new Error('Failed to refresh related notes');
      }

      const data = await response.json();
      setRelatedNotes(data.related || []);
      setHasEmbedding(data.hasEmbedding ?? true);
      lastContentRef.current = contentToAnalyze;
    } catch (error) {
      console.error('Error refreshing related notes:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [noteId]);

  // Initial fetch
  useEffect(() => {
    fetchRelatedNotes();
  }, [fetchRelatedNotes]);

  // Debounced content-based refresh
  useEffect(() => {
    if (!content || content === lastContentRef.current) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      refreshFromContent(content);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, debounceMs, refreshFromContent]);

  // Create a link between notes
  const handleLink = async (targetNoteId: string) => {
    try {
      setIsLinking(targetNoteId);
      const response = await api.notes[":id"].link.$post({
        param: { id: noteId },
        json: {
          targetNoteId,
          linkType: 'manual',
          strength: 1.0,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          toast.info('Notes are already linked');
        } else {
          throw new Error(error.error || 'Failed to link notes');
        }
        return;
      }

      // Update local state
      setRelatedNotes((prev) =>
        prev.map((note) =>
          note.id === targetNoteId ? { ...note, isLinked: true } : note
        )
      );
      toast.success('Notes linked successfully');
    } catch (error) {
      console.error('Error linking notes:', error);
      toast.error('Failed to link notes');
    } finally {
      setIsLinking(null);
    }
  };

  // Remove a link between notes
  const handleUnlink = async (targetNoteId: string) => {
    try {
      setIsLinking(targetNoteId);
      const response = await api.notes[":id"].link.$delete({
        param: { id: noteId },
        query: { targetNoteId },
      });

      if (!response.ok) {
        throw new Error('Failed to unlink notes');
      }

      // Update local state
      setRelatedNotes((prev) =>
        prev.map((note) =>
          note.id === targetNoteId ? { ...note, isLinked: false } : note
        )
      );
      toast.success('Link removed');
    } catch (error) {
      console.error('Error unlinking notes:', error);
      toast.error('Failed to remove link');
    } finally {
      setIsLinking(null);
    }
  };

  // Manual refresh
  const handleManualRefresh = () => {
    if (content && content.trim().length >= 50) {
      refreshFromContent(content);
    } else {
      fetchRelatedNotes();
    }
  };

  // Get similarity badge color
  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 80) return 'bg-emerald-500';
    if (similarity >= 60) return 'bg-green-500';
    if (similarity >= 40) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-amber-500" />
            Related Notes
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleManualRefresh}
                  disabled={isLoading || isRefreshing}
                >
                  <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Refresh suggestions</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <CardDescription>AI-suggested connections</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          // Loading skeleton
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : relatedNotes.length === 0 ? (
          // Empty state
          <div className="text-center py-4">
            <Link2 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              {hasEmbedding
                ? 'No related notes found yet'
                : 'Keep writing to discover connections'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Related notes will appear as you add more content
            </p>
          </div>
        ) : (
          // Related notes list
          <div className="space-y-3">
            {relatedNotes.map((note) => (
              <div
                key={note.id}
                className="group p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {note.noteType === 'journal' ? (
                      <BookOpen className="h-4 w-4 text-orange-500 flex-shrink-0" />
                    ) : (
                      <FileText className="h-4 w-4 text-blue-500 flex-shrink-0" />
                    )}
                    <span className="font-medium text-sm truncate">
                      {note.title}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`text-xs text-white flex-shrink-0 ${getSimilarityColor(note.similarity)}`}
                  >
                    {note.similarity}%
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                  {note.preview}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              note.isLinked
                                ? handleUnlink(note.id)
                                : handleLink(note.id)
                            }
                            disabled={isLinking === note.id}
                          >
                            {note.isLinked ? (
                              <Unlink className="h-3 w-3 text-muted-foreground" />
                            ) : (
                              <LinkIcon className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{note.isLinked ? 'Remove link' : 'Link notes'}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {note.isLinked && (
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Linked
                      </span>
                    )}
                  </div>

                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link href={`/notes/${note.id}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Open note</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            ))}
          </div>
        )}

        {isRefreshing && relatedNotes.length > 0 && (
          <div className="text-center pt-2">
            <span className="text-xs text-muted-foreground">
              Updating suggestions...
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
