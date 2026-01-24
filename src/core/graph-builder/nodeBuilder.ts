/**
 * Node Builder Module
 *
 * This module handles the creation of graph nodes for endpoints and schemas.
 * It calculates reference counts and enriches nodes with metadata.
 */

import type {
  GraphNode,
  GraphEdge,
  EndpointNodeData,
  SchemaNodeData,
  Endpoint,
  Schema,
} from '@/types';
import type { Relationship } from '@/types/relationships';

/**
 * Reference count information for a schema.
 */
export interface RefCounts {
  incoming: number;
  outgoing: number;
}

/**
 * Calculates reference counts for schema nodes based on edges.
 */
export function calculateRefCounts(
  schemas: Schema[],
  edges: GraphEdge[]
): Map<string, RefCounts> {
  const counts = new Map<string, RefCounts>();

  // Initialize counts for all schemas (keyed by name to match edge source/target format)
  for (const schema of schemas) {
    counts.set(schema.name, { incoming: 0, outgoing: 0 });
  }

  // Count edges
  for (const edge of edges) {
    // Outgoing from source
    if (edge.source.startsWith('schema-')) {
      const schemaId = edge.source.replace('schema-', '');
      const count = counts.get(schemaId);
      if (count) {
        count.outgoing++;
      }
    }

    // Incoming to target
    if (edge.target.startsWith('schema-')) {
      const schemaId = edge.target.replace('schema-', '');
      const count = counts.get(schemaId);
      if (count) {
        count.incoming++;
      }
    }
  }

  return counts;
}

/**
 * Collects discriminator values that map to a specific schema.
 */
export function collectDiscriminatorValues(
  schemaName: string,
  relationships: Relationship[]
): string[] {
  const values: string[] = [];

  for (const rel of relationships) {
    if (
      rel.type === 'schema-discriminator' &&
      rel.target.name === schemaName &&
      rel.context.discriminatorValue
    ) {
      values.push(rel.context.discriminatorValue);
    }
  }

  return values;
}

/**
 * Determines the composition type of a schema if any.
 */
export function getCompositionType(
  schema: Schema
): 'allOf' | 'oneOf' | 'anyOf' | undefined {
  if (schema.allOf && schema.allOf.length > 0) {
    return 'allOf';
  }
  if (schema.oneOf && schema.oneOf.length > 0) {
    return 'oneOf';
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    return 'anyOf';
  }
  return undefined;
}

/**
 * Creates a graph node for an endpoint.
 */
export function createEndpointNode(endpoint: Endpoint): GraphNode {
  const nodeData: EndpointNodeData = {
    type: 'endpoint',
    endpoint,
    visible: true,
  };

  return {
    id: endpoint.id,
    type: 'endpoint',
    position: { x: 0, y: 0 }, // Will be set by Dagre
    data: nodeData,
  };
}

/**
 * Options for creating a schema node.
 */
export interface SchemaNodeOptions {
  schema: Schema;
  refCounts: RefCounts;
  discriminatorValues?: string[];
}

/**
 * Creates a graph node for a schema with enhanced metadata.
 */
export function createSchemaNode(options: SchemaNodeOptions): GraphNode {
  const { schema, refCounts, discriminatorValues } = options;

  const compositionType = getCompositionType(schema);

  const nodeData: SchemaNodeData = {
    type: 'schema',
    schema,
    visible: true,
    hasDiscriminator: !!schema.discriminator,
    discriminatorValues:
      discriminatorValues && discriminatorValues.length > 0
        ? discriminatorValues
        : undefined,
    compositionType,
    incomingRefCount: refCounts.incoming,
    outgoingRefCount: refCounts.outgoing,
  };

  return {
    id: `schema-${schema.name}`,
    type: 'schema',
    position: { x: 0, y: 0 }, // Will be set by Dagre
    data: nodeData,
  };
}

/**
 * Builds all endpoint nodes from a list of endpoints.
 */
export function buildEndpointNodes(endpoints: Endpoint[]): GraphNode[] {
  return endpoints.map(createEndpointNode);
}

/**
 * Options for building schema nodes.
 */
export interface BuildSchemaNodesOptions {
  schemas: Schema[];
  edges: GraphEdge[];
  relationships: Relationship[];
}

/**
 * Builds all schema nodes with reference counts and discriminator values.
 */
export function buildSchemaNodes(options: BuildSchemaNodesOptions): GraphNode[] {
  const { schemas, edges, relationships } = options;

  // Calculate reference counts from edges
  const refCounts = calculateRefCounts(schemas, edges);

  // Build nodes
  return schemas.map((schema) => {
    const counts = refCounts.get(schema.name) || { incoming: 0, outgoing: 0 };
    const discriminatorValues = collectDiscriminatorValues(schema.name, relationships);

    return createSchemaNode({
      schema,
      refCounts: counts,
      discriminatorValues,
    });
  });
}
