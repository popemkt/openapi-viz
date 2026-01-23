import dagre from 'dagre';
import type {
  ParsedSpec,
  GraphNode,
  GraphEdge,
  EndpointNodeData,
  SchemaNodeData,
  EdgeType,
  Endpoint,
  Schema,
} from '@/types';
import { EDGE_COLORS, EDGE_LABELS } from '@/constants';

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

function extractSchemaRef(ref: string | undefined): string | null {
  if (!ref) return null;
  const match = ref.match(/#\/components\/schemas\/(.+)/);
  return match ? match[1] : null;
}

function findSchemaRefsInEndpoint(endpoint: Endpoint): Array<{ schemaName: string; edgeType: EdgeType; label: string }> {
  const refs: Array<{ schemaName: string; edgeType: EdgeType; label: string }> = [];
  const visited = new Set<string>();

  // Check request body
  if (endpoint.requestBody?.content) {
    for (const [mediaType, media] of Object.entries(endpoint.requestBody.content)) {
      const schemaName = extractSchemaRef(media.schema?.$ref);
      if (schemaName && !visited.has(schemaName)) {
        visited.add(schemaName);
        refs.push({ schemaName, edgeType: 'request-body', label: `request (${mediaType.split('/')[1] || mediaType})` });
      }
    }
  }

  // Check responses
  for (const [statusCode, response] of Object.entries(endpoint.responses)) {
    if (response.content) {
      for (const [, media] of Object.entries(response.content)) {
        const schemaName = extractSchemaRef(media.schema?.$ref);
        if (schemaName && !visited.has(`${statusCode}-${schemaName}`)) {
          visited.add(`${statusCode}-${schemaName}`);
          refs.push({ schemaName, edgeType: 'response', label: `${statusCode} response` });
        }
      }
    }
  }

  // Check parameters
  for (const param of endpoint.parameters) {
    if (param.schema?.$ref) {
      const schemaName = extractSchemaRef(param.schema.$ref);
      if (schemaName && !visited.has(`param-${schemaName}`)) {
        visited.add(`param-${schemaName}`);
        refs.push({ schemaName, edgeType: 'parameter', label: `param: ${param.name}` });
      }
    }
  }

  return refs;
}

/**
 * Detects all edges that are part of a circular reference in the schema graph.
 * Returns a set of edge keys in the format "source->target" that form cycles.
 */
function detectCircularEdges(allSchemas: Map<string, Schema>): Set<string> {
  const circularEdges = new Set<string>();

  // Build adjacency list
  const adjacency = new Map<string, string[]>();
  for (const [name, schema] of allSchemas) {
    const refs = getDirectSchemaRefs(schema).filter((r) => allSchemas.has(r));
    adjacency.set(name, refs);
  }

  // Use Tarjan's algorithm to find all strongly connected components (SCCs)
  // Edges within an SCC form cycles
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

    // If v is a root node, pop the stack and generate an SCC
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

  for (const v of allSchemas.keys()) {
    if (!indices.has(v)) {
      strongconnect(v);
    }
  }

  // Mark all edges that stay within an SCC as circular
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
 * Represents a schema reference with its edge type
 */
interface SchemaRefInfo {
  schemaName: string;
  edgeType: EdgeType;
}

/**
 * Gets all direct schema references from a schema (non-recursive).
 * Returns both the schema name and the appropriate edge type.
 */
function getDirectSchemaRefs(schema: Schema): string[] {
  // For backward compatibility with detectCircularEdges, return just names
  return getDirectSchemaRefsWithType(schema).map((ref) => ref.schemaName);
}

/**
 * Gets all direct schema references from a schema with their edge types.
 */
function getDirectSchemaRefsWithType(schema: Schema): SchemaRefInfo[] {
  const refs: SchemaRefInfo[] = [];
  const seen = new Set<string>();

  const addRef = (schemaName: string, edgeType: EdgeType) => {
    const key = `${schemaName}-${edgeType}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ schemaName, edgeType });
    }
  };

  // Check direct $ref
  if (schema.$ref) {
    const refName = extractSchemaRef(schema.$ref);
    if (refName) addRef(refName, 'schema-ref');
  }

  // Check properties
  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      if (prop.$ref) {
        const refName = extractSchemaRef(prop.$ref);
        if (refName) addRef(refName, 'schema-ref');
      }
      // Check items in arrays (property is an array type)
      if (prop.items?.$ref) {
        const refName = extractSchemaRef(prop.items.$ref);
        if (refName) addRef(refName, 'array-items');
      }
    }
  }

  // Check allOf
  if (schema.allOf) {
    for (const subSchema of schema.allOf) {
      if (subSchema.$ref) {
        const refName = extractSchemaRef(subSchema.$ref);
        if (refName) addRef(refName, 'allOf');
      }
    }
  }

  // Check oneOf
  if (schema.oneOf) {
    for (const subSchema of schema.oneOf) {
      if (subSchema.$ref) {
        const refName = extractSchemaRef(subSchema.$ref);
        if (refName) addRef(refName, 'oneOf');
      }
    }
  }

  // Check anyOf
  if (schema.anyOf) {
    for (const subSchema of schema.anyOf) {
      if (subSchema.$ref) {
        const refName = extractSchemaRef(subSchema.$ref);
        if (refName) addRef(refName, 'anyOf');
      }
    }
  }

  // Check array items at schema level
  if (schema.items?.$ref) {
    const refName = extractSchemaRef(schema.items.$ref);
    if (refName) addRef(refName, 'array-items');
  }

  return refs;
}

function findSchemaRefsInSchema(
  schema: Schema,
  circularEdges: Set<string>
): Array<{ schemaName: string; edgeType: EdgeType; isCircular: boolean }> {
  const directRefs = getDirectSchemaRefsWithType(schema);

  return directRefs.map((ref) => ({
    schemaName: ref.schemaName,
    edgeType: ref.edgeType,
    isCircular: circularEdges.has(`${schema.id}->${ref.schemaName}`),
  }));
}

export function buildGraph(spec: ParsedSpec): GraphBuildResult {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const schemaMap = new Map<string, Schema>();

  // Build schema map for reference lookup
  for (const schema of spec.schemas) {
    schemaMap.set(schema.id, schema);
  }

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

    // Create edges from endpoints to schemas
    const schemaRefs = findSchemaRefsInEndpoint(endpoint);
    for (const { schemaName, edgeType, label } of schemaRefs) {
      if (schemaMap.has(schemaName)) {
        edges.push({
          id: `${endpoint.id}-${schemaName}-${edgeType}`,
          source: endpoint.id,
          target: `schema-${schemaName}`,
          data: { edgeType, label },
          style: { stroke: EDGE_COLORS[edgeType] },
          label,
          labelStyle: { fontSize: 10, fill: EDGE_COLORS[edgeType] },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        });
      }
    }
  }

  // Pre-compute all circular edges in the schema graph
  const circularEdges = detectCircularEdges(schemaMap);

  // Create schema nodes
  for (const schema of spec.schemas) {
    const nodeData: SchemaNodeData = {
      type: 'schema',
      schema,
      visible: true,
    };

    nodes.push({
      id: `schema-${schema.id}`,
      type: 'schema',
      position: { x: 0, y: 0 }, // Will be set by Dagre
      data: nodeData,
    });

    // Create edges between schemas (with circular reference handling)
    const schemaRefs = findSchemaRefsInSchema(schema, circularEdges);
    for (const { schemaName, edgeType: baseEdgeType, isCircular } of schemaRefs) {
      if (schemaMap.has(schemaName)) {
        // Circular references override the base edge type
        const edgeType: EdgeType = isCircular ? 'circular' : baseEdgeType;
        const label = EDGE_LABELS[edgeType];

        // Determine edge styling based on type
        // - circular: dashed + animated
        // - oneOf/anyOf: dashed (represents alternative/optional)
        // - allOf: solid (represents required composition)
        // - array-items: solid
        // - schema-ref: solid
        const isDashed = isCircular || edgeType === 'oneOf' || edgeType === 'anyOf';

        edges.push({
          id: `schema-${schema.id}-${schemaName}-${edgeType}`,
          source: `schema-${schema.id}`,
          target: `schema-${schemaName}`,
          data: { edgeType, label },
          style: {
            stroke: EDGE_COLORS[edgeType],
            strokeDasharray: isDashed ? '5,5' : undefined,
          },
          label,
          labelStyle: { fontSize: 10, fill: EDGE_COLORS[edgeType] },
          labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
          animated: isCircular,
        });
      }
    }
  }

  return { nodes, edges };
}

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
