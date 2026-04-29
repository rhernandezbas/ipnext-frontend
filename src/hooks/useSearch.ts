import { useState, useEffect, useRef } from 'react';
import type { SearchResult } from '@/types/search';
import * as api from '@/api/search.api';

export function useSearch(debounceMs = 300) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await api.search(query);
        setResults(response.results);
        setShowResults(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, debounceMs]);

  function closeResults() {
    setShowResults(false);
  }

  return {
    query,
    setQuery,
    results,
    isLoading,
    showResults,
    closeResults,
  };
}
