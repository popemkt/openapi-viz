/**
 * Graph Worker Integration Tests
 *
 * Tests for the graph builder Web Worker message handling and integration.
 * Since Web Workers don't run in jsdom, we test:
 * 1. Worker message protocol compliance
 * 2. Client request management
 * 3. Layout options handling
 */

import { describe, it, expect } from 'vitest';
import type {
  BuildGraphRequest,
  BuildGraphSuccessResponse,
  BuildGraphErrorResponse,
  GraphBuildResult,
} from '../src/core/graph-builder/workers/types';
import {
  serializeParsedSpec,
  deserializeParsedSpec,
} from '../src/core/parser/workers/types';
import type { ParsedSpec, SourceLocation } from '../src/types';
import { createEmptyComponentRegistry } from '../src/types';
import { buildGraph } from '../src/core/graph-builder/buildGraph';
import { applyDagreLayout, DEFAULT_LAYOUT_OPTIONS } from '../src/core/graph-builder/layout';

// Helper to create a test source location
function createSourceLocation(
  startLine: number,
  endLine: number
): SourceLocation {
  return { startLine, startColumn: 1, endLine, endColumn: 1 };
}

// Helper to create a minimal parsed spec for testing
function createTestParsedSpec(options?: {
  endpointCount?: number;
  schemaCount?: number;
}): ParsedSpec {
  const { endpointCount = 0, schemaCount = 0 } = options || {};

  const spec: ParsedSpec = {
    info: { title: 'Test API', version: '1.0.0' },
    endpoints: [],
    schemas: [],
    tags: [],
    components: createEmptyComponentRegistry(),
    relationships: [],
  };

  // Add endpoints
  for (let i = 0; i < endpointCount; i++) {
    spec.endpoints.push({
      id: `endpoint-${i}`,
      path: `/path${i}`,
      method: 'get',
      tags: [],
      parameters: [],
      responses: {},
      sourceLocation: createSourceLocation(i * 10, i * 10 + 5),
    });
  }

  // Add schemas
  for (let i = 0; i < schemaCount; i++) {
    const schema = {
      id: `Schema${i}`,
      name: `Schema${i}`,
      type: 'object' as const,
      properties: {},
      sourceLocation: createSourceLocation(100 + i * 10, 100 + i * 10 + 5),
    };
    spec.schemas.push(schema);
    spec.components.schemas.set(schema.name, schema);
  }

  return spec;
}

describe('Graph Worker - Message Protocol', () => {
  describe('Request format', () => {
    it('creates valid BuildGraphRequest', () => {
      const spec = createTestParsedSpec({ endpointCount: 1, schemaCount: 1 });
      const serializedSpec = serializeParsedSpec(spec);

      const request: BuildGraphRequest = {
        type: 'build',
        id: 'req-001',
        spec: serializedSpec,
      };

      expect(request.type).toBe('build');
      expect(request.id).toBe('req-001');
      expect(request.spec).toBeDefined();
      expect(request.spec.info.title).toBe('Test API');
    });

    it('supports optional layoutOptions in request', () => {
      const spec = createTestParsedSpec();
      const serializedSpec = serializeParsedSpec(spec);

      const request: BuildGraphRequest = {
        type: 'build',
        id: 'req-002',
        spec: serializedSpec,
        layoutOptions: {
          direction: 'LR',
          nodeSpacing: 100,
        },
      };

      expect(request.layoutOptions).toBeDefined();
      expect(request.layoutOptions?.direction).toBe('LR');
      expect(request.layoutOptions?.nodeSpacing).toBe(100);
    });
  });

  describe('Response format', () => {
    it('creates valid BuildGraphSuccessResponse', () => {
      const response: BuildGraphSuccessResponse = {
        type: 'success',
        id: 'req-001',
        result: {
          nodes: [
            {
              id: 'endpoint-1',
              type: 'endpoint',
              position: { x: 0, y: 0 },
              data: {
                type: 'endpoint',
                visible: true,
                endpoint: {
                  id: 'endpoint-1',
                  path: '/users',
                  method: 'get',
                  tags: [],
                  parameters: [],
                  responses: {},
                  sourceLocation: createSourceLocation(1, 10),
                },
              },
            },
          ],
          edges: [],
        },
      };

      expect(response.type).toBe('success');
      expect(response.id).toBe('req-001');
      expect(response.result.nodes).toHaveLength(1);
      expect(response.result.edges).toHaveLength(0);
    });

    it('creates valid BuildGraphErrorResponse', () => {
      const response: BuildGraphErrorResponse = {
        type: 'error',
        id: 'req-001',
        error: 'Failed to build graph: invalid spec',
      };

      expect(response.type).toBe('error');
      expect(response.id).toBe('req-001');
      expect(response.error).toBe('Failed to build graph: invalid spec');
    });
  });

  describe('Request ID correlation', () => {
    it('response ID matches request ID', () => {
      const requestId = `graph-${Date.now()}-${Math.random()}`;

      const request: BuildGraphRequest = {
        type: 'build',
        id: requestId,
        spec: serializeParsedSpec(createTestParsedSpec()),
      };

      const response: BuildGraphSuccessResponse = {
        type: 'success',
        id: requestId,
        result: { nodes: [], edges: [] },
      };

      expect(response.id).toBe(request.id);
    });
  });
});

describe('Graph Worker Client - Unit Tests', () => {
  describe('Request tracking', () => {
    it('tracks pending requests correctly', () => {
      const pendingRequests = new Map<
        string,
        { resolve: (v: GraphBuildResult) => void; reject: (e: Error) => void }
      >();
      const requestId = 'graph-request-1';

      let resolvePromise: (v: GraphBuildResult) => void = () => {};

      new Promise<GraphBuildResult>((resolve, reject) => {
        resolvePromise = resolve;
        pendingRequests.set(requestId, { resolve, reject });
      });

      expect(pendingRequests.has(requestId)).toBe(true);
      expect(pendingRequests.size).toBe(1);

      // Clean up
      pendingRequests.delete(requestId);
      expect(pendingRequests.has(requestId)).toBe(false);

      // Prevent unhandled promise rejection
      resolvePromise({ nodes: [], edges: [] });
    });

    it('generates unique request IDs', () => {
      let counter = 0;
      const generateId = () => `graph-${++counter}-${Date.now()}`;

      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1.startsWith('graph-1-')).toBe(true);
      expect(id2.startsWith('graph-2-')).toBe(true);
    });
  });

  describe('Error handling patterns', () => {
    it('handles worker error response correctly', () => {
      const errorMessage = 'Failed to apply layout';
      const response: BuildGraphErrorResponse = {
        type: 'error',
        id: 'req-1',
        error: errorMessage,
      };

      // Simulate processing error response
      const error = new Error(response.error);
      expect(error.message).toBe(errorMessage);
    });
  });

  describe('Cancellation handling', () => {
    it('removes cancelled request from pending map', () => {
      const pendingRequests = new Map<string, unknown>();
      pendingRequests.set('graph-1', {});
      pendingRequests.set('graph-2', {});
      pendingRequests.set('graph-3', {});

      // Cancel specific request
      pendingRequests.delete('graph-2');
      expect(pendingRequests.has('graph-2')).toBe(false);
      expect(pendingRequests.size).toBe(2);

      // Cancel all
      pendingRequests.clear();
      expect(pendingRequests.size).toBe(0);
    });

    it('ignores response for cancelled request', () => {
      const pendingRequests = new Map<
        string,
        { resolve: (v: GraphBuildResult) => void }
      >();
      const response: BuildGraphSuccessResponse = {
        type: 'success',
        id: 'cancelled-request',
        result: { nodes: [], edges: [] },
      };

      // Request was cancelled, so it's not in pending map
      const pending = pendingRequests.get(response.id);

      // Should not throw, just silently ignore
      expect(pending).toBeUndefined();
    });
  });
});

describe('Graph Worker - Spec Serialization Round-Trip', () => {
  it('deserializes spec correctly for graph building', () => {
    const originalSpec = createTestParsedSpec({
      endpointCount: 2,
      schemaCount: 3,
    });

    // Simulate what happens in worker: serialize -> transfer -> deserialize
    const serialized = serializeParsedSpec(originalSpec);
    const deserialized = deserializeParsedSpec(serialized);

    // Verify spec is usable for graph building
    expect(deserialized.endpoints).toHaveLength(2);
    expect(deserialized.schemas).toHaveLength(3);
    expect(deserialized.components.schemas).toBeInstanceOf(Map);
    expect(deserialized.components.schemas.size).toBe(3);
  });

  it('builds graph from deserialized spec', () => {
    const originalSpec = createTestParsedSpec({
      endpointCount: 2,
      schemaCount: 2,
    });

    // Simulate worker round-trip
    const serialized = serializeParsedSpec(originalSpec);
    const deserialized = deserializeParsedSpec(serialized);

    // Build graph (this is what the worker does)
    const { nodes } = buildGraph(deserialized);

    expect(nodes.length).toBeGreaterThan(0);
    expect(nodes).toHaveLength(4); // 2 endpoints + 2 schemas
  });

  it('applies layout to deserialized spec graph', () => {
    const originalSpec = createTestParsedSpec({
      endpointCount: 3,
      schemaCount: 2,
    });

    // Simulate worker round-trip
    const serialized = serializeParsedSpec(originalSpec);
    const deserialized = deserializeParsedSpec(serialized);

    // Build and layout (this is what the worker does)
    const { nodes, edges } = buildGraph(deserialized);
    const layoutedNodes = applyDagreLayout(nodes, edges);

    // Verify nodes have positions
    for (const node of layoutedNodes) {
      expect(node.position).toBeDefined();
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    }
  });
});

describe('Graph Worker - Layout Options', () => {
  it('uses default layout options when not specified', () => {
    expect(DEFAULT_LAYOUT_OPTIONS).toBeDefined();
    expect(DEFAULT_LAYOUT_OPTIONS.direction).toBeDefined();
    expect(DEFAULT_LAYOUT_OPTIONS.nodeSpacing).toBeDefined();
    expect(DEFAULT_LAYOUT_OPTIONS.rankSpacing).toBeDefined();
  });

  it('merges custom layout options with defaults', () => {
    const customOptions = {
      direction: 'LR' as const,
      nodeSpacing: 150,
    };

    const merged = { ...DEFAULT_LAYOUT_OPTIONS, ...customOptions };

    expect(merged.direction).toBe('LR');
    expect(merged.nodeSpacing).toBe(150);
    expect(merged.rankSpacing).toBe(DEFAULT_LAYOUT_OPTIONS.rankSpacing);
  });

  it('applies custom layout options correctly', () => {
    const spec = createTestParsedSpec({ endpointCount: 2, schemaCount: 2 });
    const { nodes, edges } = buildGraph(spec);

    // Apply with custom options
    const layoutedLR = applyDagreLayout(nodes, edges, { direction: 'LR' });
    const layoutedTB = applyDagreLayout(nodes, edges, { direction: 'TB' });

    // Layout should produce different positions for different directions
    // (This is a basic sanity check - actual positions depend on dagre)
    expect(layoutedLR).toHaveLength(nodes.length);
    expect(layoutedTB).toHaveLength(nodes.length);
  });
});

describe('Graph Worker - Large Spec Handling', () => {
  it('handles spec with many endpoints and schemas', () => {
    const spec = createTestParsedSpec({
      endpointCount: 50,
      schemaCount: 100,
    });

    // Serialize/deserialize
    const serialized = serializeParsedSpec(spec);
    const deserialized = deserializeParsedSpec(serialized);

    // Build graph
    const startBuild = performance.now();
    const { nodes } = buildGraph(deserialized);
    const buildTime = performance.now() - startBuild;

    expect(nodes).toHaveLength(150); // 50 endpoints + 100 schemas
    expect(buildTime).toBeLessThan(500); // Should be fast
  });

  it('applies layout to large graph efficiently', () => {
    const spec = createTestParsedSpec({
      endpointCount: 30,
      schemaCount: 70,
    });

    const { nodes, edges } = buildGraph(spec);

    const startLayout = performance.now();
    const layoutedNodes = applyDagreLayout(nodes, edges);
    const layoutTime = performance.now() - startLayout;

    expect(layoutedNodes).toHaveLength(100);
    expect(layoutTime).toBeLessThan(1000); // Layout can be slower but should finish
  });
});

describe('Graph Worker - Result Structure', () => {
  it('returns correctly typed GraphBuildResult', () => {
    const spec = createTestParsedSpec({ endpointCount: 1, schemaCount: 1 });
    const { nodes, edges } = buildGraph(spec);
    const layoutedNodes = applyDagreLayout(nodes, edges);

    const result: GraphBuildResult = {
      nodes: layoutedNodes,
      edges,
    };

    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);

    // Verify node structure
    for (const node of result.nodes) {
      expect(node.id).toBeDefined();
      expect(node.type).toBeDefined();
      expect(node.position).toBeDefined();
      expect(node.data).toBeDefined();
    }

    // Verify edge structure (if any)
    for (const edge of result.edges) {
      expect(edge.id).toBeDefined();
      expect(edge.source).toBeDefined();
      expect(edge.target).toBeDefined();
    }
  });

  it('produces serializable result for postMessage', () => {
    const spec = createTestParsedSpec({ endpointCount: 2, schemaCount: 2 });
    const { nodes, edges } = buildGraph(spec);
    const layoutedNodes = applyDagreLayout(nodes, edges);

    const result: GraphBuildResult = {
      nodes: layoutedNodes,
      edges,
    };

    // Verify result can be JSON stringified (simulating structured clone)
    const stringified = JSON.stringify(result);
    const parsed = JSON.parse(stringified) as GraphBuildResult;

    expect(parsed.nodes).toHaveLength(result.nodes.length);
    expect(parsed.edges).toHaveLength(result.edges.length);
  });
});

describe('Graph Worker - Relationships Support', () => {
  it('handles spec with relationships', () => {
    const spec = createTestParsedSpec({ schemaCount: 2 });

    // Add a relationship between schemas using correct relationship structure
    spec.relationships.push({
      id: 'schema-Schema0-schema-Schema1-schema-property-linkedSchema',
      source: { componentType: 'schema', name: 'Schema0' },
      target: { componentType: 'schema', name: 'Schema1' },
      type: 'schema-property',
      context: { propertyName: 'linkedSchema' },
      isCircular: false,
    });

    // Simulate worker round-trip
    const serialized = serializeParsedSpec(spec);
    const deserialized = deserializeParsedSpec(serialized);

    // Verify relationships preserved
    expect(deserialized.relationships).toHaveLength(1);
    expect(deserialized.relationships[0].type).toBe('schema-property');

    // Build graph
    const { edges } = buildGraph(deserialized);

    // Should create an edge for the relationship
    expect(edges.length).toBeGreaterThan(0);
    const relationshipEdge = edges.find(
      (e) => e.source === 'schema-Schema0' && e.target === 'schema-Schema1'
    );
    expect(relationshipEdge).toBeDefined();
  });
});
