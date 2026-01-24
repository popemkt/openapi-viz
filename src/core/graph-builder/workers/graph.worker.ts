/**
 * Graph Builder Web Worker
 *
 * Performs graph building and layout off the main thread to prevent UI blocking
 * for large OpenAPI specifications. Uses the structured clone algorithm for
 * message passing, requiring serializable data types.
 */

import { buildGraph } from '../buildGraph';
import { applyDagreLayout } from '../layout';
import { deserializeParsedSpec } from '@/core/parser/workers/types';
import type { BuildGraphRequest, BuildGraphResponse } from './types';

/**
 * Handle incoming graph build requests.
 */
self.onmessage = (event: MessageEvent<BuildGraphRequest>) => {
  const request = event.data;

  if (request.type !== 'build') {
    return;
  }

  try {
    // Deserialize the spec from plain objects back to Map-based types
    const spec = deserializeParsedSpec(request.spec);

    // Build the graph (nodes and edges)
    const { nodes, edges } = buildGraph(spec);

    // Apply Dagre layout to position nodes
    const layoutedNodes = applyDagreLayout(nodes, edges, request.layoutOptions);

    const response: BuildGraphResponse = {
      type: 'success',
      id: request.id,
      result: {
        nodes: layoutedNodes,
        edges,
      },
    };

    self.postMessage(response);
  } catch (error) {
    const response: BuildGraphResponse = {
      type: 'error',
      id: request.id,
      error: error instanceof Error ? error.message : String(error),
    };

    self.postMessage(response);
  }
};
