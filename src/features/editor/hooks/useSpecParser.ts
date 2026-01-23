import { useEffect, useRef } from 'react';
import { useSpecStore } from '@/stores';
import { parseSpec } from '@/core/parser';
import { useDebounce } from '@/shared/hooks/useDebounce';

const PARSE_DEBOUNCE_MS = 500;

export function useSpecParser() {
  const { rawText, setParsedSpec, setLoading } = useSpecStore();
  const debouncedText = useDebounce(rawText, PARSE_DEBOUNCE_MS);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Abort any in-progress parsing
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const doParse = async () => {
      setLoading(true);

      try {
        const result = await parseSpec(debouncedText);

        // Check if we were aborted
        if (abortController.signal.aborted) return;

        setParsedSpec(result.spec, result.sourceMap, result.errors);
      } catch (error) {
        if (abortController.signal.aborted) return;

        setParsedSpec(null, null, [
          {
            message: `Unexpected error: ${(error as Error).message}`,
            severity: 'error',
          },
        ]);
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    doParse();

    return () => {
      abortController.abort();
    };
  }, [debouncedText, setParsedSpec, setLoading]);
}
