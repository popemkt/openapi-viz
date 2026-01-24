/**
 * Graph visualization type definitions
 *
 * Enhanced to support:
 * - Rich semantic edge types with context
 * - Toggleable edge label verbosity
 * - All relationship types from OpenAPI spec
 */

import type { Node, Edge } from '@xyflow/react';
import type { Endpoint, Schema } from './openapi';

/**
 * Node types in the graph.
 * Currently focused on endpoints and schemas per user requirements.
 */
export type GraphNodeType = 'endpoint' | 'schema';

/**
 * Extended node data for endpoints
 */
export interface EndpointNodeData extends Record<string, unknown> {
  type: 'endpoint';
  endpoint: Endpoint;
  visible: boolean;
  /** Whether the node is dimmed (shown but de-emphasized in highlight filter mode) */
  dimmed?: boolean;
}

/**
 * Extended node data for schemas
 */
export interface SchemaNodeData extends Record<string, unknown> {
  type: 'schema';
  schema: Schema;
  visible: boolean;
  /** Whether the node is dimmed (shown but de-emphasized in highlight filter mode) */
  dimmed?: boolean;

  /**
   * Whether this schema has a discriminator (polymorphism).
   */
  hasDiscriminator: boolean;

  /**
   * If this schema is a target of discriminator mappings,
   * the values that map to it.
   */
  discriminatorValues?: string[];

  /**
   * If this schema uses composition, the type of composition.
   */
  compositionType?: 'allOf' | 'oneOf' | 'anyOf';

  /**
   * Count of incoming references to this schema.
   */
  incomingRefCount: number;

  /**
   * Count of outgoing references from this schema.
   */
  outgoingRefCount: number;
}

export type GraphNodeData = EndpointNodeData | SchemaNodeData;

/**
 * Graph node with our custom data
 */
export type GraphNode = Node<GraphNodeData>;

/**
 * Edge types representing the semantic relationship between nodes.
 *
 * Organized by source type:
 * - endpoint-*: Edges from endpoints
 * - schema-*: Edges between schemas
 * - circular: Special type for cycle visualization
 */
export type EdgeType =
  // Endpoint -> Schema edges
  | 'request-body'       // Request body uses schema
  | 'response'           // Response body uses schema
  | 'parameter'          // Parameter uses schema

  // Schema -> Schema composition edges
  | 'allOf'              // Inheritance/extension
  | 'oneOf'              // Exclusive alternatives
  | 'anyOf'              // Non-exclusive alternatives
  | 'not'                // Negation

  // Schema -> Schema structural edges
  | 'property'           // Named property references schema
  | 'additional-props'   // additionalProperties references schema
  | 'array-items'        // Array items reference schema
  | 'tuple-item'         // Tuple position references schema

  // Schema -> Schema polymorphism edges
  | 'discriminator'      // Discriminator mapping

  // Legacy type for backward compatibility
  | 'schema-ref'         // Generic schema reference (deprecated, use 'property')

  // Special type
  | 'circular';          // Marks edges that are part of a cycle

/**
 * Semantic context for an edge, providing human-readable details.
 */
export interface EdgeSemanticContext {
  /**
   * For property edges: the property name.
   */
  propertyName?: string;

  /**
   * For response edges: the HTTP status code.
   */
  statusCode?: string;

  /**
   * For request/response: the media type.
   */
  mediaType?: string;

  /**
   * For parameter edges: the parameter name and location.
   */
  parameterName?: string;
  parameterLocation?: 'query' | 'path' | 'header' | 'cookie';

  /**
   * For discriminator edges: the discriminator value.
   */
  discriminatorValue?: string;

  /**
   * For tuple-item edges: the position index.
   */
  tupleIndex?: number;

  /**
   * Whether the reference is in an array context.
   */
  isArray?: boolean;

  /**
   * Whether the property/parameter is required.
   */
  required?: boolean;
}

/**
 * Extended edge data with semantic context.
 */
export interface GraphEdgeData extends Record<string, unknown> {
  edgeType: EdgeType;

  /**
   * Display label (depends on verbosity mode).
   */
  label?: string;

  /**
   * Concise label for compact mode.
   */
  conciseLabel?: string;

  /**
   * Verbose label with full context.
   */
  verboseLabel?: string;

  /**
   * Semantic context for generating labels and tooltips.
   */
  semanticContext?: EdgeSemanticContext;

  /** Whether the edge is dimmed (shown but de-emphasized in highlight filter mode) */
  dimmed?: boolean;
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

/**
 * Edge label verbosity mode.
 */
export type EdgeLabelMode = 'concise' | 'verbose';

/**
 * Configuration for graph display.
 */
export interface GraphDisplayConfig {
  /**
   * Edge label verbosity mode.
   */
  edgeLabelMode: EdgeLabelMode;

  /**
   * Whether to show edge labels at all.
   */
  showEdgeLabels: boolean;

  /**
   * Whether to animate circular edges.
   */
  animateCircular: boolean;
}

/**
 * Default graph display configuration.
 */
export const DEFAULT_GRAPH_DISPLAY_CONFIG: GraphDisplayConfig = {
  edgeLabelMode: 'concise',
  showEdgeLabels: true,
  animateCircular: true,
};
