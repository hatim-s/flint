import { useCallback, useEffect, useState } from "react";
import { api } from "@/api/client";
import type { Person } from "@/db/schema/people";

interface UsePeopleOptions {
  search?: string;
}

interface UsePeopleReturn {
  people: Person[];
  loading: boolean;
  error: Error | null;
  createPerson: (data: {
    name: string;
    email?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<Person>;
  deletePerson: (personId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch and manage user's people/contacts
 */
export function usePeople(options: UsePeopleOptions = {}): UsePeopleReturn {
  const { search } = options;
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPeople = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search?.trim()) {
        params.append("search", search.trim());
      }

      const response = await api.people.$get({
        query: Object.fromEntries(params.entries()),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch people");
      }

      const data = await response.json();
      setPeople(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPeople();
  }, [fetchPeople]);

  const createPerson = useCallback(
    async (data: {
      name: string;
      email?: string;
      metadata?: Record<string, unknown>;
    }): Promise<Person> => {
      const response = await api.people.$post({
        json: data,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create person");
      }

      const person = await response.json();

      // Update local state
      setPeople((prev) => {
        // Check if person already exists (might be returned existing)
        const exists = prev.some((p) => p.id === person.id);
        if (exists) {
          return prev;
        }
        return [...prev, person].sort((a, b) => a.name.localeCompare(b.name));
      });

      return person;
    },
    [],
  );

  const deletePerson = useCallback(async (personId: string): Promise<void> => {
    const response = await api.people.$delete({
      query: { id: personId },
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete person");
    }

    // Update local state
    setPeople((prev) => prev.filter((p) => p.id !== personId));
  }, []);

  const refetch = useCallback(async () => {
    await fetchPeople();
  }, [fetchPeople]);

  return {
    people,
    loading,
    error,
    createPerson,
    deletePerson,
    refetch,
  };
}
