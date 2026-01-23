import { describe, it, expect } from 'vitest';
import { buildGraph } from '../src/core/graph-builder/buildGraph';
import type { ParsedSpec, Schema, Endpoint } from '../src/types';

function createSchema(name: string, refs: string[] = []): Schema {
  const properties: Schema['properties'] = {};
  for (const ref of refs) {
    properties[`${ref}Ref`] = {
      name: `${ref}Ref`,
      type: 'object',
      required: false,
      $ref: `#/components/schemas/${ref}`,
    };
  }

  return {
    id: name,
    name,
    type: 'object',
    properties,
    sourceLocation: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
  };
}

function createEndpoint(id: string, path: string, method: Endpoint['method'] = 'get'): Endpoint {
  return {
    id,
    path,
    method,
    tags: [],
    parameters: [],
    responses: {},
    sourceLocation: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
  };
}

describe('buildGraph', () => {
  it('creates nodes for endpoints and schemas', () => {
    const spec: ParsedSpec = {
      info: { title: 'Test', version: '1.0.0' },
      endpoints: [createEndpoint('e1', '/users')],
      schemas: [createSchema('User')],
      tags: [],
    };

    const { nodes } = buildGraph(spec);

    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.id === 'e1')).toBeDefined();
    expect(nodes.find((n) => n.id === 'schema-User')).toBeDefined();
  });

  it('detects self-referencing schemas (A -> A)', () => {
    const spec: ParsedSpec = {
      info: { title: 'Test', version: '1.0.0' },
      endpoints: [],
      schemas: [createSchema('Node', ['Node'])],
      tags: [],
    };

    const { edges } = buildGraph(spec);

    const selfRefEdge = edges.find(
      (e) => e.source === 'schema-Node' && e.target === 'schema-Node'
    );
    expect(selfRefEdge).toBeDefined();
    expect(selfRefEdge?.data?.edgeType).toBe('circular');
    expect(selfRefEdge?.animated).toBe(true);
  });

  it('detects two-level circular references (A -> B -> A)', () => {
    const spec: ParsedSpec = {
      info: { title: 'Test', version: '1.0.0' },
      endpoints: [],
      schemas: [
        createSchema('A', ['B']),
        createSchema('B', ['A']),
      ],
      tags: [],
    };

    const { edges } = buildGraph(spec);

    // A -> B should be circular because it leads back to A
    const aToBEdge = edges.find(
      (e) => e.source === 'schema-A' && e.target === 'schema-B'
    );
    expect(aToBEdge).toBeDefined();
    expect(aToBEdge?.data?.edgeType).toBe('circular');

    // B -> A should be circular
    const bToAEdge = edges.find(
      (e) => e.source === 'schema-B' && e.target === 'schema-A'
    );
    expect(bToAEdge).toBeDefined();
    expect(bToAEdge?.data?.edgeType).toBe('circular');
  });

  it('detects three-level circular references (A -> B -> C -> A)', () => {
    const spec: ParsedSpec = {
      info: { title: 'Test', version: '1.0.0' },
      endpoints: [],
      schemas: [
        createSchema('A', ['B']),
        createSchema('B', ['C']),
        createSchema('C', ['A']),
      ],
      tags: [],
    };

    const { edges } = buildGraph(spec);

    // All edges in the cycle should be marked as circular
    const aToBEdge = edges.find(
      (e) => e.source === 'schema-A' && e.target === 'schema-B'
    );
    const bToCEdge = edges.find(
      (e) => e.source === 'schema-B' && e.target === 'schema-C'
    );
    const cToAEdge = edges.find(
      (e) => e.source === 'schema-C' && e.target === 'schema-A'
    );

    expect(aToBEdge?.data?.edgeType).toBe('circular');
    expect(bToCEdge?.data?.edgeType).toBe('circular');
    expect(cToAEdge?.data?.edgeType).toBe('circular');
  });

  it('does not mark non-circular refs as circular', () => {
    const spec: ParsedSpec = {
      info: { title: 'Test', version: '1.0.0' },
      endpoints: [],
      schemas: [
        createSchema('User', ['Address']),
        createSchema('Address'),
      ],
      tags: [],
    };

    const { edges } = buildGraph(spec);

    const userToAddressEdge = edges.find(
      (e) => e.source === 'schema-User' && e.target === 'schema-Address'
    );
    expect(userToAddressEdge).toBeDefined();
    expect(userToAddressEdge?.data?.edgeType).toBe('schema-ref');
    expect(userToAddressEdge?.animated).toBeFalsy();
  });

  it('handles diamond dependencies (A -> B, A -> C, B -> D, C -> D)', () => {
    const spec: ParsedSpec = {
      info: { title: 'Test', version: '1.0.0' },
      endpoints: [],
      schemas: [
        createSchema('A', ['B', 'C']),
        createSchema('B', ['D']),
        createSchema('C', ['D']),
        createSchema('D'),
      ],
      tags: [],
    };

    const { edges } = buildGraph(spec);

    // None of these should be circular - they form a diamond, not a cycle
    const allEdges = edges.filter((e) => e.source.startsWith('schema-'));
    for (const edge of allEdges) {
      expect(edge.data?.edgeType).toBe('schema-ref');
    }
  });
});
