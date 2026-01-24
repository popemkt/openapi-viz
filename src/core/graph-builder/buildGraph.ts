/**
 * Graph Builder - Relationship-Based Edge Generation
 *
 * This module builds the visualization graph from a parsed OpenAPI spec using
 * the relationship model. It converts semantic relationships into visual edges
 * with rich context for labels and styling.
 */

import type { ParsedSpec, GraphNode, GraphEdge, Schema } from '@/types';
import { detectCircularRelationships } from './circularDetection';
import { relationshipsToEdges } from './edgeBuilder';
import { buildEndpointNodes, buildSchemaNodes } from './nodeBuilder';
import {
  detectCircularEdgesLegacy,
  buildLegacyEndpointEdges,
  buildLegacySchemaEdges,
} from './legacySupport';

export interface GraphBuildResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// Re-export layout types and functions for backward compatibility
export { applyDagreLayout, DEFAULT_LAYOUT_OPTIONS } from './layout';
export type { LayoutOptions } from './layout';

/**
 * Builds the visualization graph from a parsed OpenAPI specification.
 *
 * This function:
 * 1. Creates nodes for all endpoints and schemas
 * 2. Uses the relationships array to create edges (or falls back to legacy extraction)
 * 3. Detects circular references and marks them
 * 4. Generates semantic labels for edges
 */
export function buildGraph(spec: ParsedSpec): GraphBuildResult {
  let edges: GraphEdge[] = [];

  // Build schema map for reference lookup
  // Key by schema.name since relationships reference schemas by name, not by UUID
  const schemaMap = new Map<string, Schema>();
  for (const schema of spec.schemas) {
    schemaMap.set(schema.name, schema);
  }

  // Build endpoint ID set
  const endpointIds = new Set<string>();
  for (const endpoint of spec.endpoints) {
    endpointIds.add(endpoint.id);
  }

  // Determine if we should use relationship-based or legacy edge generation
  const useRelationships = spec.relationships && spec.relationships.length > 0;

  if (useRelationships) {
    // Detect circular relationships
    const circularIds = detectCircularRelationships(spec.relationships);

    // Convert relationships to edges
    edges = relationshipsToEdges(
      spec.relationships,
      circularIds,
      schemaMap,
      endpointIds
    );
  } else {
    // Legacy mode: extract edges directly from schemas and endpoints
    const circularEdges = detectCircularEdgesLegacy(schemaMap);

    // Build endpoint-to-schema edges
    for (const endpoint of spec.endpoints) {
      edges.push(...buildLegacyEndpointEdges(endpoint, schemaMap));
    }

    // Build schema-to-schema edges
    for (const schema of spec.schemas) {
      edges.push(...buildLegacySchemaEdges(schema, circularEdges, schemaMap));
    }
  }

  // Create endpoint nodes
  const endpointNodes = buildEndpointNodes(spec.endpoints);

  // Create schema nodes with reference counts and discriminator values
  const schemaNodes = buildSchemaNodes({
    schemas: spec.schemas,
    edges,
    relationships: spec.relationships || [],
  });

  const nodes = [...endpointNodes, ...schemaNodes];

  return { nodes, edges };
}
