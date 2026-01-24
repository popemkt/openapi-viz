import { useEffect, useRef } from 'react';
import { useSpecStore, useGraphStore } from '@/stores';
import { GraphWorkerClient } from '@/core/graph-builder/workers/graphWorkerClient';

export function useGraphBuilder() {
  const { parsedSpec } = useSpecStore();
  const { setNodes, setEdges } = useGraphStore();
  const requestIdRef = useRef<string | null>(null);

  useEffect(() => {
    const workerClient = GraphWorkerClient.getInstance();

    // Cancel any pending build request
    if (requestIdRef.current) {
      workerClient.cancelPending(requestIdRef.current);
    }

    if (!parsedSpec) {
      setNodes([]);
      setEdges([]);
      return;
    }

    let cancelled = false;

    const doBuild = async () => {
      try {
        // Build the graph and apply layout in the worker
        const { nodes, edges } = await workerClient.build(parsedSpec);

        // Check if we were cancelled
        if (cancelled) return;

        // Update store
        setNodes(nodes);
        setEdges(edges);
      } catch (error) {
        if (cancelled) return;

        console.error('Graph build error:', error);
        setNodes([]);
        setEdges([]);
      }
    };

    doBuild();

    return () => {
      cancelled = true;
      workerClient.cancelPending();
    };
  }, [parsedSpec, setNodes, setEdges]);
}
