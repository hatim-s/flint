import { useState, useEffect, useCallback } from 'react';
import { Tag } from '@/db/schema/tags';
import { api } from '@/api/client';

/**
 * Hook to fetch and manage user's tags
 */
export function useTags(searchQuery?: string) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const response = await api.tags.$get({
        query: Object.fromEntries(params.entries()),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch tags');
      }

      const data = await response.json();
      setTags(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setTags([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  /**
   * Create a new tag
   */
  const createTag = useCallback(async (name: string, color = '#6366f1'): Promise<Tag | null> => {
    try {
      const response = await api.tags.$post({
        json: { name, color },
      });

      if (!response.ok) {
        throw new Error('Failed to create tag');
      }

      const newTag = await response.json();

      // Add to local state if it's a new tag (status 201) or update if existing (status 200)
      setTags((prevTags) => {
        const exists = prevTags.some((t) => t.id === newTag.id);
        if (exists) return prevTags;
        return [...prevTags, newTag].sort((a, b) => a.name.localeCompare(b.name));
      });

      return newTag;
    } catch (err) {
      console.error('Error creating tag:', err);
      return null;
    }
  }, []);

  /**
   * Delete a tag
   */
  const deleteTag = useCallback(async (tagId: string): Promise<boolean> => {
    try {
      const response = await api.tags.$delete({
        query: { id: tagId },
      });

      if (!response.ok) {
        throw new Error('Failed to delete tag');
      }

      // Remove from local state
      setTags((prevTags) => prevTags.filter((t) => t.id !== tagId));
      return true;
    } catch (err) {
      console.error('Error deleting tag:', err);
      return false;
    }
  }, []);

  return {
    tags,
    isLoading,
    error,
    refetch: fetchTags,
    createTag,
    deleteTag,
  };
}
