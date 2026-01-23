/**
 * Graph visualization type definitions
 */

import type { Node, Edge } from '@xyflow/react';
import type { Endpoint, Schema } from './openapi';

/**
 * Node types in the graph
 */
export type GraphNodeType = 'endpoint' | 'schema';

/**
 * Extended node data for endpoints
 */
export interface EndpointNodeData extends Record<string, unknown> {
  type: 'endpoint';
  endpoint: Endpoint;
  visible: boolean;
}

/**
 * Extended node data for schemas
 */
export interface SchemaNodeData extends Record<string, unknown> {
  type: 'schema';
  schema: Schema;
  visible: boolean;
}

export type GraphNodeData = EndpointNodeData | SchemaNodeData;

/**
 * Graph node with our custom data
 */
export type GraphNode = Node<GraphNodeData>;

/**
 * Edge types
 */
export type EdgeType =
  | 'request-body'
  | 'response'
  | 'parameter'
  | 'schema-ref'
  | 'circular'
  | 'allOf'
  | 'oneOf'
  | 'anyOf'
  | 'array-items';

/**
 * Extended edge data
 */
export interface GraphEdgeData extends Record<string, unknown> {
  edgeType: EdgeType;
  label?: string;
}

export type GraphEdge = Edge<GraphEdgeData>;

/**
 * Graph layout state
 */
export interface LayoutState {
  positions: Record<string, { x: number; y: number }>;
  zoom: number;
  pan: { x: number; y: number };
}
