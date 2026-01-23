/**
 * Graph Builder - Relationship-Based Edge Generation
 *
 * This module builds the visualization graph from a parsed OpenAPI spec using
 * the relationship model. It converts semantic relationships into visual edges
 * with rich context for labels and styling.
 */

import dagre from 'dagre';
import type {
  ParsedSpec,
  GraphNode,
  GraphEdge,
  EndpointNodeData,
  SchemaNodeData,
  EdgeType,
  Schema,
  GraphEdgeData,
} from '@/types';
import type { Relationship, RelationshipType } from '@/types/relationships';
import {
  RELATIONSHIP_TO_EDGE_TYPE,
  relationshipContextToEdgeContext,
  createSemanticEdgeLabel,
  getEdgeConfig,
} from '@/constants/edgeTypes';

export interface GraphBuildResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface LayoutOptions {
  direction: 'LR' | 'TB';
  nodeWidth: number;
  nodeHeight: number;
  rankSpacing: number;
  nodeSpacing: number;
}

const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  direction: 'LR',
  nodeWidth: 200,
  nodeHeight: 120,
  rankSpacing: 100,
  nodeSpacing: 50,
};

/**
 * Detects all relationships that are part of a circular reference chain.
 * Uses Tarjan's algorithm to find strongly connected components (SCCs).
 * Returns a set of relationship IDs that form cycles.
 */
function detectCircularRelationships(relationships: Relationship[]): Set<string> {
  const circularIds = new Set<string>();

  // Build adjacency list from schema-to-schema relationships only
  // (endpoint relationships cannot form cycles)
  const schemaRelationships = relationships.filter(
    (r) => r.source.componentType === 'schema' && r.target.componentType === 'schema'
  );

  // Build adjacency list: source schema -> [target schemas]
  const adjacency = new Map<string, Set<string>>();
  // Track which relationships connect each pair for marking
  const edgeRelationships = new Map<string, Relationship[]>();

  for (const rel of schemaRelationships) {
    const source = rel.source.name;
    const target = rel.target.name;

    if (!adjacency.has(source)) {
      adjacency.set(source, new Set());
    }
    adjacency.get(source)!.add(target);

    const edgeKey = `${source}->${target}`;
    if (!edgeRelationships.has(edgeKey)) {
      edgeRelationships.set(edgeKey, []);
    }
    edgeRelationships.get(edgeKey)!.push(rel);
  }

  // Get all unique schema names
  const allSchemas = new Set<string>();
  for (const rel of schemaRelationships) {
    allSchemas.add(rel.source.name);
    allSchemas.add(rel.target.name);
  }

  // Tarjan's algorithm
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

    const neighbors = adjacency.get(v) || new Set();
    for (const w of neighbors) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v)!, lowlinks.get(w)!));
      } else if (onStack.has(w)) {
        lowlinks.set(v, Math.min(lowlinks.get(v)!, indices.get(w)!));
      }
    }

    // If v is a root node, pop the stack and generate an SCC
    if (lowlinks.get(v) === indices.get(v)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);

      // Check if SCC forms a cycle (size > 1, or self-loop)
      if (scc.length > 1) {
        sccs.push(scc);
      } else if (scc.length === 1) {
        // Check for self-loop
        const node = scc[0];
        if (adjacency.get(node)?.has(node)) {
          sccs.push(scc);
        }
      }
    }
  }

  for (const v of allSchemas) {
    if (!indices.has(v)) {
      strongconnect(v);
    }
  }

  // Mark all relationships that stay within an SCC as circular
  for (const scc of sccs) {
    const sccSet = new Set(scc);
    for (const node of scc) {
      const neighbors = adjacency.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (sccSet.has(neighbor)) {
          // Mark all relationships on this edge as circular
          const edgeKey = `${node}->${neighbor}`;
          const rels = edgeRelationships.get(edgeKey) || [];
          for (const rel of rels) {
            circularIds.add(rel.id);
          }
        }
      }
    }
  }

  return circularIds;
}

/**
 * Converts a relationship type to an edge type.
 * Handles the circular override case.
 */
function getEdgeTypeForRelationship(
  relType: RelationshipType,
  isCircular: boolean
): EdgeType {
  if (isCircular) {
    return 'circular';
  }
  return RELATIONSHIP_TO_EDGE_TYPE[relType];
}

/**
 * Converts relationships to graph edges with semantic labels and styling.
 */
function relationshipsToEdges(
  relationships: Relationship[],
  circularIds: Set<string>,
  schemaMap: Map<string, Schema>,
  endpointIds: Set<string>
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();

  for (const rel of relationships) {
    const isCircular = circularIds.has(rel.id);
    const edgeType = getEdgeTypeForRelationship(rel.type, isCircular);

    // Determine source and target node IDs
    let sourceId: string;
    let targetId: string;

    if (rel.source.componentType === 'endpoint') {
      sourceId = rel.source.name;
      // Verify endpoint exists
      if (!endpointIds.has(sourceId)) continue;
    } else {
      sourceId = `schema-${rel.source.name}`;
      // Verify schema exists
      if (!schemaMap.has(rel.source.name)) continue;
    }

    if (rel.target.componentType === 'endpoint') {
      targetId = rel.target.name;
      if (!endpointIds.has(targetId)) continue;
    } else {
      targetId = `schema-${rel.target.name}`;
      // Verify schema exists
      if (!schemaMap.has(rel.target.name)) continue;
    }

    // Create unique edge ID to avoid duplicates
    const edgeKey = `${sourceId}-${targetId}-${edgeType}-${JSON.stringify(rel.context)}`;
    if (seenEdges.has(edgeKey)) continue;
    seenEdges.add(edgeKey);

    // Convert relationship context to edge semantic context
    const semanticContext = relationshipContextToEdgeContext(rel.context);

    // Generate labels
    const conciseLabel = createSemanticEdgeLabel(edgeType, semanticContext, false);
    const verboseLabel = createSemanticEdgeLabel(edgeType, semanticContext, true);

    // Get edge styling configuration
    const config = getEdgeConfig(edgeType);

    const edgeData: GraphEdgeData = {
      edgeType,
      label: conciseLabel,
      conciseLabel,
      verboseLabel,
      semanticContext,
    };

    const edge: GraphEdge = {
      id: `${sourceId}-${targetId}-${edgeType}-${rel.id}`,
      source: sourceId,
      target: targetId,
      data: edgeData,
      style: {
        stroke: config.color,
        strokeWidth: config.strokeWidth,
        strokeDasharray: config.dashed ? '5,5' : undefined,
      },
      label: conciseLabel,
      labelStyle: { fontSize: 10, fill: config.color },
      labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
      animated: config.animated || isCircular,
      markerEnd: { type: config.markerEnd === 'arrowclosed' ? 'arrowclosed' : 'arrow' },
    };

    edges.push(edge);
  }

  return edges;
}

/**
 * Legacy function for backward compatibility.
 * Extracts schema references from a schema for cycle detection.
 */
function extractSchemaRef(ref: string | undefined): string | null {
  if (!ref) return null;
  const match = ref.match(/#\/components\/schemas\/(.+)/);
  return match ? match[1] : null;
}

/**
 * Legacy function: Gets direct schema refs from a schema.
 * Used when relationships are not populated (backward compatibility).
 */
function getDirectSchemaRefs(schema: Schema): string[] {
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
 * Legacy circular detection for backward compatibility.
 * Used when relationships array is empty.
 */
function detectCircularEdgesLegacy(schemaMap: Map<string, Schema>): Set<string> {
  const circularEdges = new Set<string>();

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const [name, schema] of schemaMap) {
    const refs = getDirectSchemaRefs(schema).filter((r) => schemaMap.has(r));
    adjacency.set(name, refs);
  }

  // Tarjan's algorithm
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
 * Legacy edge builder for backward compatibility.
 * Used when relationships array is empty.
 */
function buildLegacySchemaEdges(
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
function buildLegacyEndpointEdges(
  endpoint: import('@/types').Endpoint,
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

/**
 * Calculates reference counts for schema nodes.
 */
function calculateRefCounts(
  schemas: Schema[],
  edges: GraphEdge[]
): Map<string, { incoming: number; outgoing: number }> {
  const counts = new Map<string, { incoming: number; outgoing: number }>();

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
 * Builds the visualization graph from a parsed OpenAPI specification.
 *
 * This function:
 * 1. Creates nodes for all endpoints and schemas
 * 2. Uses the relationships array to create edges (or falls back to legacy extraction)
 * 3. Detects circular references and marks them
 * 4. Generates semantic labels for edges
 */
export function buildGraph(spec: ParsedSpec): GraphBuildResult {
  const nodes: GraphNode[] = [];
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
    edges = relationshipsToEdges(spec.relationships, circularIds, schemaMap, endpointIds);
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

  // Calculate reference counts for schema node data
  const refCounts = calculateRefCounts(spec.schemas, edges);

  // Create endpoint nodes
  for (const endpoint of spec.endpoints) {
    const nodeData: EndpointNodeData = {
      type: 'endpoint',
      endpoint,
      visible: true,
    };

    nodes.push({
      id: endpoint.id,
      type: 'endpoint',
      position: { x: 0, y: 0 }, // Will be set by Dagre
      data: nodeData,
    });
  }

  // Create schema nodes with enhanced data
  for (const schema of spec.schemas) {
    // Determine composition type
    let compositionType: 'allOf' | 'oneOf' | 'anyOf' | undefined;
    if (schema.allOf && schema.allOf.length > 0) {
      compositionType = 'allOf';
    } else if (schema.oneOf && schema.oneOf.length > 0) {
      compositionType = 'oneOf';
    } else if (schema.anyOf && schema.anyOf.length > 0) {
      compositionType = 'anyOf';
    }

    // Collect discriminator values that map to this schema
    const discriminatorValues: string[] = [];
    if (useRelationships) {
      for (const rel of spec.relationships) {
        if (
          rel.type === 'schema-discriminator' &&
          rel.target.name === schema.name &&
          rel.context.discriminatorValue
        ) {
          discriminatorValues.push(rel.context.discriminatorValue);
        }
      }
    }

    const counts = refCounts.get(schema.name) || { incoming: 0, outgoing: 0 };

    const nodeData: SchemaNodeData = {
      type: 'schema',
      schema,
      visible: true,
      hasDiscriminator: !!schema.discriminator,
      discriminatorValues: discriminatorValues.length > 0 ? discriminatorValues : undefined,
      compositionType,
      incomingRefCount: counts.incoming,
      outgoingRefCount: counts.outgoing,
    };

    nodes.push({
      id: `schema-${schema.name}`,
      type: 'schema',
      position: { x: 0, y: 0 }, // Will be set by Dagre
      data: nodeData,
    });
  }

  return { nodes, edges };
}

/**
 * Applies Dagre layout algorithm to position nodes.
 */
export function applyDagreLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: Partial<LayoutOptions> = {}
): GraphNode[] {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const dagreGraph = new dagre.graphlib.Graph();

  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({
    rankdir: opts.direction,
    ranksep: opts.rankSpacing,
    nodesep: opts.nodeSpacing,
  });

  // Add nodes to Dagre graph
  for (const node of nodes) {
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    });
  }

  // Add edges to Dagre graph
  for (const edge of edges) {
    dagreGraph.setEdge(edge.source, edge.target);
  }

  // Run layout algorithm
  dagre.layout(dagreGraph);

  // Apply positions back to nodes
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - opts.nodeWidth / 2,
        y: nodeWithPosition.y - opts.nodeHeight / 2,
      },
    };
  });
}
