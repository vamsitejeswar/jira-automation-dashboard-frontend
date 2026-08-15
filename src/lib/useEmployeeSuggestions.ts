import { useEffect, useRef, useState } from "react";
import { getEmployeeSearchSuggestions } from "@/api";
import type { EmployeeSearchResult } from "@/api";

const DEFAULT_DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

// Shared by Overview's global search box and Employee Search's own search
// box -- both used to keep an identical copy of this debounce/request-id-
// guard logic, just under different variable names.
export function useEmployeeSuggestions(query: string, debounceMs = DEFAULT_DEBOUNCE_MS) {
  const [suggestions, setSuggestions] = useState<EmployeeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    if (query.trim().length <= MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      const thisRequest = ++requestId.current;
      setLoading(true);
      getEmployeeSearchSuggestions(query.trim())
        .then((res) => {
          if (requestId.current !== thisRequest) return;
          setSuggestions(res.results);
        })
        .catch(() => {
          if (requestId.current !== thisRequest) return;
          setSuggestions([]);
        })
        .finally(() => {
          if (requestId.current !== thisRequest) return;
          setLoading(false);
        });
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return { suggestions, loading };
}
