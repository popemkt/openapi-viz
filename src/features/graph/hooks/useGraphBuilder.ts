import { useEffect } from 'react';
import { useSpecStore, useGraphStore } from '@/stores';
import { buildGraph, applyDagreLayout } from '@/core/graph-builder';

export function useGraphBuilder() {
  const { parsedSpec } = useSpecStore();
  const { setNodes, setEdges } = useGraphStore();

  useEffect(() => {
    if (!parsedSpec) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Build the graph from parsed spec
    const { nodes, edges } = buildGraph(parsedSpec);

    // Apply Dagre layout
    const layoutedNodes = applyDagreLayout(nodes, edges);

    // Update store
    setNodes(layoutedNodes);
    setEdges(edges);
  }, [parsedSpec, setNodes, setEdges]);
}
