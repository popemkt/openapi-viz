/**
 * Legacy Support Module - Backward Compatibility Functions
 *
 * This module contains functions for backward compatibility with older
 * parsed specs that don't have the relationships array populated.
 * These functions extract edges directly from schemas and endpoints.
 */

import type { Schema, Endpoint, GraphEdge, EdgeType } from '@/types';
import { getEdgeConfig } from '@/constants/edgeTypes';

/**
 * Extracts a schema name from a $ref string.
 * Returns null if the ref doesn't point to a schema.
 *
 * @example
 * extractSchemaRef('#/components/schemas/User') // returns 'User'
 * extractSchemaRef('#/components/responses/Error') // returns null
 */
export function extractSchemaRef(ref: string | undefined): string | null {
  if (!ref) return null;
  const match = ref.match(/#\/components\/schemas\/(.+)/);
  return match ? match[1] : null;
}

/**
 * Gets all direct schema references from a schema.
 * Used when relationships are not populated (backward compatibility).
 *
 * This function traverses the schema structure to find all $ref pointers
 * to other schemas, including:
 * - Direct $ref
 * - Properties with $ref or array items with $ref
 * - Composition schemas (allOf, oneOf, anyOf)
 * - Array items
 * - Additional properties
 * - Negation (not)
 * - Tuple items (prefixItems)
 */
export function getDirectSchemaRefs(schema: Schema): string[] {
  const refs: string[] = [];
  const seen = new Set<string>();

  const addRef = (ref: string | null) => {
    if (ref && !seen.has(ref)) {
      seen.add(ref);
      refs.push(ref);
    }
  };

  // Check direct $ref
  addRef(extractSchemaRef(schema.$ref));

  // Check properties
  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      addRef(extractSchemaRef(prop.$ref));
      if (prop.items?.$ref) {
        addRef(extractSchemaRef(prop.items.$ref));
      }
    }
  }

  // Check composition
  for (const subSchema of schema.allOf || []) {
    addRef(extractSchemaRef(subSchema.$ref));
  }
  for (const subSchema of schema.oneOf || []) {
    addRef(extractSchemaRef(subSchema.$ref));
  }
  for (const subSchema of schema.anyOf || []) {
    addRef(extractSchemaRef(subSchema.$ref));
  }

  // Check array items
  if (schema.items?.$ref) {
    addRef(extractSchemaRef(schema.items.$ref));
  }

  // Check additionalProperties
  if (schema.additionalProperties && typeof schema.additionalProperties !== 'boolean') {
    addRef(extractSchemaRef(schema.additionalProperties.$ref));
  }

  // Check not
  if (schema.not?.$ref) {
    addRef(extractSchemaRef(schema.not.$ref));
  }

  // Check prefixItems (tuple types)
  if (schema.prefixItems) {
    for (const item of schema.prefixItems) {
      addRef(extractSchemaRef(item.$ref));
    }
  }

  return refs;
}

/**
 * Legacy circular detection using Tarjan's SCC algorithm.
 * Used when relationships array is empty.
 *
 * Returns a set of edge identifiers in the format "sourceName->targetName"
 * for edges that are part of a cycle.
 */
export function detectCircularEdgesLegacy(schemaMap: Map<string, Schema>): Set<string> {
  const circularEdges = new Set<string>();

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const [name, schema] of schemaMap) {
    const refs = getDirectSchemaRefs(schema).filter((r) => schemaMap.has(r));
    adjacency.set(name, refs);
  }

  // Tarjan's algorithm state
  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  function strongconnect(v: string) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    const neighbors = adjacency.get(v) || [];
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    if (lowlinks.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      if (scc.length > 1 || (scc.length === 1 && adjacency.get(scc[0])?.includes(scc[0]))) {
        sccs.push(scc);
      }
    }
  }

  for (const v of schemaMap.keys()) {
    if (!indices.has(v)) {
      strongconnect(v);
    }
  }

  // Mark edges within SCCs as circular
  for (const scc of sccs) {
    const sccSet = new Set(scc);
    for (const node of scc) {
      const neighbors = adjacency.get(node) || [];
      for (const neighbor of neighbors) {
        if (sccSet.has(neighbor)) {
          circularEdges.add(`${node}->${neighbor}`);
        }
      }
    }
  }

  return circularEdges;
}

/**
 * Legacy edge builder for schema-to-schema edges.
 * Used when relationships array is empty.
 */
export function buildLegacySchemaEdges(
  schema: Schema,
  circularEdges: Set<string>,
  schemaMap: Map<string, Schema>
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const refs = getDirectSchemaRefs(schema);

  for (const refName of refs) {
    if (!schemaMap.has(refName)) continue;

    const isCircular = circularEdges.has(`${schema.name}->${refName}`);
    const edgeType: EdgeType = isCircular ? 'circular' : 'schema-ref';
    const config = getEdgeConfig(edgeType);
    const label = isCircular ? 'circular ref' : 'references';

    edges.push({
      id: `schema-${schema.name}-${refName}-${edgeType}`,
      source: `schema-${schema.name}`,
      target: `schema-${refName}`,
      data: {
        edgeType,
        label,
        conciseLabel: label,
        verboseLabel: label,
      },
      style: {
        stroke: config.color,
        strokeWidth: config.strokeWidth,
        strokeDasharray: config.dashed ? '5,5' : undefined,
      },
      label,
      labelStyle: { fontSize: 10, fill: config.color },
      labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
      animated: isCircular,
    });
  }

  return edges;
}

/**
 * Legacy edge builder for endpoint-to-schema edges.
 * Used when relationships array is empty.
 */
export function buildLegacyEndpointEdges(
  endpoint: Endpoint,
  schemaMap: Map<string, Schema>
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const visited = new Set<string>();

  // Check request body
  if (endpoint.requestBody?.content) {
    for (const [mediaType, media] of Object.entries(endpoint.requestBody.content)) {
      const schemaName = extractSchemaRef(media.schema?.$ref);
      if (schemaName && schemaMap.has(schemaName) && !visited.has(schemaName)) {
        visited.add(schemaName);
        const config = getEdgeConfig('request-body');
        const label = `request (${mediaType.split('/')[1] || mediaType})`;
        edges.push({
          id: `${endpoint.id}-${schemaName}-request-body`,
          source: endpoint.id,
          target: `schema-${schemaName}`,
          data: {
            edgeType: 'request-body',
            label,
            conciseLabel: 'body',
            verboseLabel: `request body (${mediaType})`,
            semanticContext: { mediaType },
          },
          style: { stroke: config.color, strokeWidth: config.strokeWidth },
          label,
          labelStyle: { fontSize: 10, fill: config.color },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        });
      }
    }
  }

  // Check responses
  for (const [statusCode, response] of Object.entries(endpoint.responses)) {
    if (response.content) {
      for (const [mediaType, media] of Object.entries(response.content)) {
        const schemaName = extractSchemaRef(media.schema?.$ref);
        if (schemaName && schemaMap.has(schemaName) && !visited.has(`${statusCode}-${schemaName}`)) {
          visited.add(`${statusCode}-${schemaName}`);
          const config = getEdgeConfig('response');
          const label = `${statusCode} response`;
          edges.push({
            id: `${endpoint.id}-${schemaName}-response-${statusCode}`,
            source: endpoint.id,
            target: `schema-${schemaName}`,
            data: {
              edgeType: 'response',
              label,
              conciseLabel: statusCode,
              verboseLabel: `${statusCode} response (${mediaType})`,
              semanticContext: { statusCode, mediaType },
            },
            style: { stroke: config.color, strokeWidth: config.strokeWidth },
            label,
            labelStyle: { fontSize: 10, fill: config.color },
            labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
          });
        }
      }
    }
  }

  // Check parameters
  for (const param of endpoint.parameters) {
    if (param.schema?.$ref) {
      const schemaName = extractSchemaRef(param.schema.$ref);
      if (schemaName && schemaMap.has(schemaName) && !visited.has(`param-${schemaName}`)) {
        visited.add(`param-${schemaName}`);
        const config = getEdgeConfig('parameter');
        const label = `param: ${param.name}`;
        edges.push({
          id: `${endpoint.id}-${schemaName}-parameter-${param.name}`,
          source: endpoint.id,
          target: `schema-${schemaName}`,
          data: {
            edgeType: 'parameter',
            label,
            conciseLabel: param.name,
            verboseLabel: `${param.in} param: ${param.name}`,
            semanticContext: {
              parameterName: param.name,
              parameterLocation: param.in,
            },
          },
          style: {
            stroke: config.color,
            strokeWidth: config.strokeWidth,
            strokeDasharray: config.dashed ? '5,5' : undefined,
          },
          label,
          labelStyle: { fontSize: 10, fill: config.color },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        });
      }
    }
  }

  return edges;
}
