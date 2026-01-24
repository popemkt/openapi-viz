/**
 * Types for the graph builder Web Worker communication protocol.
 *
 * Web Workers use the structured clone algorithm for message passing,
 * which does not support Map objects. This module provides serializable
 * versions of graph builder types.
 */

import type { GraphNode, GraphEdge } from '@/types';
import type { LayoutOptions } from '../layout';
import type { SerializableParsedSpec } from '@/core/parser/workers/types';

/**
 * Graph build result from the worker.
 * Uses the same structure as the main thread result since
 * GraphNode and GraphEdge are already serializable.
 */
export interface GraphBuildResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Request message sent to the graph builder worker.
 */
export interface BuildGraphRequest {
  type: 'build';
  id: string;
  spec: SerializableParsedSpec;
  layoutOptions?: Partial<LayoutOptions>;
}

/**
 * Successful response from the graph builder worker.
 */
export interface BuildGraphSuccessResponse {
  type: 'success';
  id: string;
  result: GraphBuildResult;
}

/**
 * Error response from the graph builder worker.
 */
export interface BuildGraphErrorResponse {
  type: 'error';
  id: string;
  error: string;
}

/**
 * Union type for all worker responses.
 */
export type BuildGraphResponse = BuildGraphSuccessResponse | BuildGraphErrorResponse;
