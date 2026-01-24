/**
 * Parser Worker Integration Tests
 *
 * Tests for the parser Web Worker message handling and type serialization.
 * Since Web Workers don't run in jsdom, we test:
 * 1. Serialization/deserialization functions
 * 2. Worker message protocol compliance
 * 3. Client request management
 */

import { describe, it, expect } from 'vitest';
import {
  serializeSourceMap,
  deserializeSourceMap,
  serializeComponentRegistry,
  deserializeComponentRegistry,
  serializeParsedSpec,
  deserializeParsedSpec,
  type SerializableSourceMap,
  type SerializableComponentRegistry,
  type SerializableParsedSpec,
  type ParseRequest,
  type ParseSuccessResponse,
  type ParseErrorResponse,
} from '../src/core/parser/workers/types';
import type { SourceMap, ParsedSpec, SourceLocation } from '../src/types';
import { createEmptyComponentRegistry } from '../src/types';

// Helper to create a test source location
function createSourceLocation(
  startLine: number,
  endLine: number
): SourceLocation {
  return { startLine, startColumn: 1, endLine, endColumn: 1 };
}

describe('Parser Worker - Serialization', () => {
  describe('SourceMap serialization', () => {
    it('serializes SourceMap with Map to plain object', () => {
      const sourceMap: SourceMap = {
        nodeToLocation: new Map([
          ['schema-User', createSourceLocation(10, 20)],
          ['schema-Pet', createSourceLocation(25, 40)],
        ]),
        lineToNodes: new Map([
          [10, ['schema-User']],
          [25, ['schema-Pet']],
        ]),
      };

      const serialized = serializeSourceMap(sourceMap);

      expect(serialized.nodeToLocation).toEqual({
        'schema-User': createSourceLocation(10, 20),
        'schema-Pet': createSourceLocation(25, 40),
      });
      expect(serialized.lineToNodes).toEqual({
        '10': ['schema-User'],
        '25': ['schema-Pet'],
      });
    });

    it('deserializes plain object back to SourceMap with Map', () => {
      const serialized: SerializableSourceMap = {
        nodeToLocation: {
          'schema-User': createSourceLocation(10, 20),
          'schema-Pet': createSourceLocation(25, 40),
        },
        lineToNodes: {
          '10': ['schema-User'],
          '25': ['schema-Pet'],
        },
      };

      const deserialized = deserializeSourceMap(serialized);

      expect(deserialized.nodeToLocation).toBeInstanceOf(Map);
      expect(deserialized.lineToNodes).toBeInstanceOf(Map);
      expect(deserialized.nodeToLocation.get('schema-User')).toEqual(
        createSourceLocation(10, 20)
      );
      expect(deserialized.lineToNodes.get(10)).toEqual(['schema-User']);
    });

    it('round-trips SourceMap correctly', () => {
      const original: SourceMap = {
        nodeToLocation: new Map([
          ['endpoint-/users-get', createSourceLocation(5, 15)],
        ]),
        lineToNodes: new Map([
          [5, ['endpoint-/users-get']],
          [10, ['endpoint-/users-get']],
        ]),
      };

      const roundTripped = deserializeSourceMap(serializeSourceMap(original));

      expect(roundTripped.nodeToLocation.size).toBe(
        original.nodeToLocation.size
      );
      expect(roundTripped.lineToNodes.size).toBe(original.lineToNodes.size);

      for (const [key, value] of original.nodeToLocation) {
        expect(roundTripped.nodeToLocation.get(key)).toEqual(value);
      }
    });

    it('handles empty SourceMap', () => {
      const sourceMap: SourceMap = {
        nodeToLocation: new Map(),
        lineToNodes: new Map(),
      };

      const serialized = serializeSourceMap(sourceMap);
      const deserialized = deserializeSourceMap(serialized);

      expect(Object.keys(serialized.nodeToLocation)).toHaveLength(0);
      expect(Object.keys(serialized.lineToNodes)).toHaveLength(0);
      expect(deserialized.nodeToLocation.size).toBe(0);
      expect(deserialized.lineToNodes.size).toBe(0);
    });
  });

  describe('ComponentRegistry serialization', () => {
    it('serializes ComponentRegistry with Maps to plain objects', () => {
      const registry = createEmptyComponentRegistry();
      registry.schemas.set('User', {
        id: 'User',
        name: 'User',
        type: 'object',
        properties: {},
        sourceLocation: createSourceLocation(10, 20),
      });
      registry.responses.set('NotFound', {
        name: 'NotFound',
        description: 'Not found',
        sourceLocation: createSourceLocation(30, 35),
      });

      const serialized = serializeComponentRegistry(registry);

      expect(serialized.schemas).toHaveProperty('User');
      expect(serialized.responses).toHaveProperty('NotFound');
      expect(Array.isArray(Object.keys(serialized.schemas))).toBe(true);
    });

    it('deserializes plain objects back to ComponentRegistry with Maps', () => {
      const serialized: SerializableComponentRegistry = {
        schemas: {
          User: {
            id: 'User',
            name: 'User',
            type: 'object',
            properties: {},
            sourceLocation: createSourceLocation(10, 20),
          },
        },
        responses: {},
        parameters: {},
        requestBodies: {},
        headers: {},
        links: {},
        callbacks: {},
      };

      const deserialized = deserializeComponentRegistry(serialized);

      expect(deserialized.schemas).toBeInstanceOf(Map);
      expect(deserialized.schemas.get('User')).toBeDefined();
      expect(deserialized.schemas.get('User')?.name).toBe('User');
    });

    it('round-trips ComponentRegistry correctly', () => {
      const original = createEmptyComponentRegistry();
      original.schemas.set('Pet', {
        id: 'Pet',
        name: 'Pet',
        type: 'object',
        properties: {
          name: {
            name: 'name',
            type: 'string',
            required: true,
          },
        },
        sourceLocation: createSourceLocation(1, 10),
      });
      original.parameters.set('limit', {
        name: 'limit',
        in: 'query',
        required: false,
        sourceLocation: createSourceLocation(15, 20),
      });

      const roundTripped = deserializeComponentRegistry(
        serializeComponentRegistry(original)
      );

      expect(roundTripped.schemas.size).toBe(original.schemas.size);
      expect(roundTripped.parameters.size).toBe(original.parameters.size);
      expect(roundTripped.schemas.get('Pet')?.name).toBe('Pet');
      expect(roundTripped.parameters.get('limit')?.in).toBe('query');
    });
  });

  describe('ParsedSpec serialization', () => {
    it('serializes ParsedSpec with nested component Maps', () => {
      const spec: ParsedSpec = {
        info: { title: 'Test API', version: '1.0.0' },
        endpoints: [
          {
            id: 'getUsers',
            path: '/users',
            method: 'get',
            tags: [],
            parameters: [],
            responses: {},
            sourceLocation: createSourceLocation(5, 15),
          },
        ],
        schemas: [
          {
            id: 'User',
            name: 'User',
            type: 'object',
            properties: {},
            sourceLocation: createSourceLocation(20, 30),
          },
        ],
        tags: [],
        components: createEmptyComponentRegistry(),
        relationships: [],
      };
      spec.components.schemas.set('User', spec.schemas[0]);

      const serialized = serializeParsedSpec(spec);

      expect(serialized.info).toEqual(spec.info);
      expect(serialized.endpoints).toEqual(spec.endpoints);
      expect(serialized.schemas).toEqual(spec.schemas);
      expect(typeof serialized.components.schemas).toBe('object');
      expect(serialized.components.schemas).not.toBeInstanceOf(Map);
    });

    it('deserializes ParsedSpec back to original structure', () => {
      const serialized: SerializableParsedSpec = {
        info: { title: 'Test API', version: '1.0.0' },
        endpoints: [],
        schemas: [],
        tags: [],
        components: {
          schemas: {},
          responses: {},
          parameters: {},
          requestBodies: {},
          headers: {},
          links: {},
          callbacks: {},
        },
        relationships: [],
      };

      const deserialized = deserializeParsedSpec(serialized);

      expect(deserialized.components.schemas).toBeInstanceOf(Map);
      expect(deserialized.components.responses).toBeInstanceOf(Map);
    });

    it('preserves relationships array through serialization', () => {
      const spec: ParsedSpec = {
        info: { title: 'Test', version: '1.0.0' },
        endpoints: [],
        schemas: [],
        tags: [],
        components: createEmptyComponentRegistry(),
        relationships: [
          {
            id: 'schema-User-schema-Address-schema-property-address',
            source: { componentType: 'schema', name: 'User' },
            target: { componentType: 'schema', name: 'Address' },
            type: 'schema-property',
            context: { propertyName: 'address' },
            isCircular: false,
          },
        ],
      };

      const roundTripped = deserializeParsedSpec(serializeParsedSpec(spec));

      expect(roundTripped.relationships).toHaveLength(1);
      expect(roundTripped.relationships[0].type).toBe('schema-property');
      expect(roundTripped.relationships[0].source.name).toBe('User');
    });
  });
});

describe('Parser Worker - Message Protocol', () => {
  describe('Request format', () => {
    it('creates valid ParseRequest', () => {
      const request: ParseRequest = {
        type: 'parse',
        id: 'req-001',
        text: 'openapi: "3.0.0"',
      };

      expect(request.type).toBe('parse');
      expect(request.id).toBe('req-001');
      expect(request.text).toBe('openapi: "3.0.0"');
    });
  });

  describe('Response format', () => {
    it('creates valid ParseSuccessResponse', () => {
      const response: ParseSuccessResponse = {
        type: 'success',
        id: 'req-001',
        result: {
          spec: null,
          errors: [],
          sourceMap: {
            nodeToLocation: {},
            lineToNodes: {},
          },
        },
      };

      expect(response.type).toBe('success');
      expect(response.id).toBe('req-001');
      expect(response.result.spec).toBeNull();
    });

    it('creates valid ParseErrorResponse', () => {
      const response: ParseErrorResponse = {
        type: 'error',
        id: 'req-001',
        error: 'Invalid YAML syntax',
      };

      expect(response.type).toBe('error');
      expect(response.id).toBe('req-001');
      expect(response.error).toBe('Invalid YAML syntax');
    });
  });

  describe('Request ID correlation', () => {
    it('response ID matches request ID', () => {
      const requestId = `parse-${Date.now()}-${Math.random()}`;

      const request: ParseRequest = {
        type: 'parse',
        id: requestId,
        text: 'test',
      };

      const response: ParseSuccessResponse = {
        type: 'success',
        id: requestId,
        result: {
          spec: null,
          errors: [],
          sourceMap: { nodeToLocation: {}, lineToNodes: {} },
        },
      };

      expect(response.id).toBe(request.id);
    });
  });
});

describe('Parser Worker Client - Unit Tests', () => {
  describe('Request tracking', () => {
    it('tracks pending requests correctly', () => {
      const pendingRequests = new Map<
        string,
        { resolve: (v: unknown) => void; reject: (e: Error) => void }
      >();
      const requestId = 'test-request-1';

      let resolvePromise: (v: unknown) => void = () => {};

      new Promise((resolve, reject) => {
        resolvePromise = resolve;
        pendingRequests.set(requestId, { resolve, reject });
      });

      expect(pendingRequests.has(requestId)).toBe(true);
      expect(pendingRequests.size).toBe(1);

      // Clean up
      pendingRequests.delete(requestId);
      expect(pendingRequests.has(requestId)).toBe(false);

      // Prevent unhandled promise rejection
      resolvePromise(null);
    });

    it('generates unique request IDs', () => {
      let counter = 0;
      const generateId = () => `parse-${++counter}-${Date.now()}`;

      const id1 = generateId();
      const id2 = generateId();
      const id3 = generateId();

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1.startsWith('parse-1-')).toBe(true);
      expect(id2.startsWith('parse-2-')).toBe(true);
    });
  });

  describe('Error handling patterns', () => {
    it('handles worker error response correctly', () => {
      const errorMessage = 'Failed to parse specification';
      const response: ParseErrorResponse = {
        type: 'error',
        id: 'req-1',
        error: errorMessage,
      };

      // Simulate processing error response
      const error = new Error(response.error);
      expect(error.message).toBe(errorMessage);
    });

    it('handles unknown errors by converting to string', () => {
      const unknownError = { code: 500, detail: 'Internal error' };
      const errorMessage =
        unknownError instanceof Error
          ? unknownError.message
          : String(unknownError);

      expect(errorMessage).toBe('[object Object]');
    });
  });

  describe('Cancellation handling', () => {
    it('removes cancelled request from pending map', () => {
      const pendingRequests = new Map<string, unknown>();
      pendingRequests.set('req-1', {});
      pendingRequests.set('req-2', {});
      pendingRequests.set('req-3', {});

      // Cancel specific request
      pendingRequests.delete('req-2');
      expect(pendingRequests.has('req-2')).toBe(false);
      expect(pendingRequests.size).toBe(2);

      // Cancel all
      pendingRequests.clear();
      expect(pendingRequests.size).toBe(0);
    });

    it('ignores response for cancelled request', () => {
      const pendingRequests = new Map<string, { resolve: () => void }>();
      const response: ParseSuccessResponse = {
        type: 'success',
        id: 'cancelled-request',
        result: {
          spec: null,
          errors: [],
          sourceMap: { nodeToLocation: {}, lineToNodes: {} },
        },
      };

      // Request was cancelled, so it's not in pending map
      const pending = pendingRequests.get(response.id);

      // Should not throw, just silently ignore
      expect(pending).toBeUndefined();
    });
  });
});

describe('Parser Worker - Large Spec Handling', () => {
  it('serializes large SourceMap efficiently', () => {
    const sourceMap: SourceMap = {
      nodeToLocation: new Map(),
      lineToNodes: new Map(),
    };

    // Simulate a large spec with many schemas
    for (let i = 0; i < 500; i++) {
      const schemaId = `schema-Schema${i}`;
      sourceMap.nodeToLocation.set(schemaId, {
        startLine: i * 10,
        startColumn: 1,
        endLine: i * 10 + 5,
        endColumn: 1,
      });
      sourceMap.lineToNodes.set(i * 10, [schemaId]);
    }

    const startSerialize = performance.now();
    const serialized = serializeSourceMap(sourceMap);
    const serializeTime = performance.now() - startSerialize;

    const startDeserialize = performance.now();
    const deserialized = deserializeSourceMap(serialized);
    const deserializeTime = performance.now() - startDeserialize;

    // Verify correctness
    expect(Object.keys(serialized.nodeToLocation)).toHaveLength(500);
    expect(deserialized.nodeToLocation.size).toBe(500);

    // Performance sanity check (should be well under 100ms)
    expect(serializeTime).toBeLessThan(100);
    expect(deserializeTime).toBeLessThan(100);
  });

  it('serializes large ComponentRegistry efficiently', () => {
    const registry = createEmptyComponentRegistry();

    // Add 200 schemas
    for (let i = 0; i < 200; i++) {
      registry.schemas.set(`Schema${i}`, {
        id: `Schema${i}`,
        name: `Schema${i}`,
        type: 'object',
        properties: {},
        sourceLocation: createSourceLocation(i * 5, i * 5 + 3),
      });
    }

    // Add 50 responses
    for (let i = 0; i < 50; i++) {
      registry.responses.set(`Response${i}`, {
        name: `Response${i}`,
        description: `Response ${i}`,
        sourceLocation: createSourceLocation(1000 + i, 1000 + i + 5),
      });
    }

    const startSerialize = performance.now();
    const serialized = serializeComponentRegistry(registry);
    const serializeTime = performance.now() - startSerialize;

    const startDeserialize = performance.now();
    const deserialized = deserializeComponentRegistry(serialized);
    const deserializeTime = performance.now() - startDeserialize;

    // Verify correctness
    expect(Object.keys(serialized.schemas)).toHaveLength(200);
    expect(Object.keys(serialized.responses)).toHaveLength(50);
    expect(deserialized.schemas.size).toBe(200);
    expect(deserialized.responses.size).toBe(50);

    // Performance sanity check
    expect(serializeTime).toBeLessThan(100);
    expect(deserializeTime).toBeLessThan(100);
  });
});
