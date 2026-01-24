import { useEffect, useRef } from 'react';
import { useSpecStore } from '@/stores';
import { ParserWorkerClient } from '@/core/parser/workers/parserWorkerClient';
import { useDebounce } from '@/shared/hooks/useDebounce';

const PARSE_DEBOUNCE_MS = 500;

export function useSpecParser() {
  const { rawText, setParsedSpec, setLoading } = useSpecStore();
  const debouncedText = useDebounce(rawText, PARSE_DEBOUNCE_MS);
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const workerClient = ParserWorkerClient.getInstance();

    // Cancel any pending parse request
    if (requestIdRef.current) {
      workerClient.cancelPending(requestIdRef.current);
    }

    let cancelled = false;

    const doParse = async () => {
      setLoading(true);

      try {
        const result = await workerClient.parse(debouncedText);

        // Check if we were cancelled
        if (cancelled) return;

        setParsedSpec(result.spec, result.sourceMap, result.errors);
      } catch (error) {
        if (cancelled) return;

        setParsedSpec(null, null, [
          {
            message: `Unexpected error: ${(error as Error).message}`,
            severity: 'error',
          },
        ]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    doParse();

    return () => {
      cancelled = true;
      workerClient.cancelPending();
    };
  }, [debouncedText, setParsedSpec, setLoading]);
}
