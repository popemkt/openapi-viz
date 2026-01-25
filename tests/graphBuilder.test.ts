import { describe, it, expect } from 'vitest';
import { buildGraph } from '../src/core/graph-builder/buildGraph';
import type { ParsedSpec, Schema, Endpoint } from '../src/types';
import type { Relationship } from '../src/types/relationships';
import { createRelationship } from '../src/types/relationships';
import { createEmptyComponentRegistry } from '../src/types';

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

function createParsedSpec(
  endpoints: Endpoint[],
  schemas: Schema[],
  relationships: Relationship[] = []
): ParsedSpec {
  const components = createEmptyComponentRegistry();
  for (const schema of schemas) {
    components.schemas.set(schema.name, schema);
  }
  return {
    info: { title: 'Test', version: '1.0.0' },
    endpoints,
    schemas,
    tags: [],
    components,
    relationships,
  };
}

// Helper to create schema ref for relationships
function schemaRef(name: string) {
  return { componentType: 'schema' as const, name };
}

function endpointRef(id: string) {
  return { componentType: 'endpoint' as const, name: id };
}

describe('buildGraph - Legacy Mode (no relationships)', () => {
  it('creates nodes for endpoints and schemas', () => {
    const spec = createParsedSpec([createEndpoint('e1', '/users')], [createSchema('User')]);

    const { nodes } = buildGraph(spec);

    expect(nodes).toHaveLength(2);
    expect(nodes.find((n) => n.id === 'e1')).toBeDefined();
    expect(nodes.find((n) => n.id === 'schema-User')).toBeDefined();
  });

  it('detects self-referencing schemas (A -> A)', () => {
    const spec = createParsedSpec([], [createSchema('Node', ['Node'])]);

    const { edges } = buildGraph(spec);

    const selfRefEdge = edges.find((e) => e.source === 'schema-Node' && e.target === 'schema-Node');
    expect(selfRefEdge).toBeDefined();
    expect(selfRefEdge?.data?.edgeType).toBe('circular');
    expect(selfRefEdge?.animated).toBe(true);
  });

  it('detects two-level circular references (A -> B -> A)', () => {
    const spec = createParsedSpec([], [createSchema('A', ['B']), createSchema('B', ['A'])]);

    const { edges } = buildGraph(spec);

    // A -> B should be circular because it leads back to A
    const aToBEdge = edges.find((e) => e.source === 'schema-A' && e.target === 'schema-B');
    expect(aToBEdge).toBeDefined();
    expect(aToBEdge?.data?.edgeType).toBe('circular');

    // B -> A should be circular
    const bToAEdge = edges.find((e) => e.source === 'schema-B' && e.target === 'schema-A');
    expect(bToAEdge).toBeDefined();
    expect(bToAEdge?.data?.edgeType).toBe('circular');
  });

  it('detects three-level circular references (A -> B -> C -> A)', () => {
    const spec = createParsedSpec(
      [],
      [createSchema('A', ['B']), createSchema('B', ['C']), createSchema('C', ['A'])]
    );

    const { edges } = buildGraph(spec);

    // All edges in the cycle should be marked as circular
    const aToBEdge = edges.find((e) => e.source === 'schema-A' && e.target === 'schema-B');
    const bToCEdge = edges.find((e) => e.source === 'schema-B' && e.target === 'schema-C');
    const cToAEdge = edges.find((e) => e.source === 'schema-C' && e.target === 'schema-A');

    expect(aToBEdge?.data?.edgeType).toBe('circular');
    expect(bToCEdge?.data?.edgeType).toBe('circular');
    expect(cToAEdge?.data?.edgeType).toBe('circular');
  });

  it('does not mark non-circular refs as circular', () => {
    const spec = createParsedSpec([], [createSchema('User', ['Address']), createSchema('Address')]);

    const { edges } = buildGraph(spec);

    const userToAddressEdge = edges.find(
      (e) => e.source === 'schema-User' && e.target === 'schema-Address'
    );
    expect(userToAddressEdge).toBeDefined();
    expect(userToAddressEdge?.data?.edgeType).toBe('schema-ref');
    expect(userToAddressEdge?.animated).toBeFalsy();
  });

  it('handles diamond dependencies (A -> B, A -> C, B -> D, C -> D)', () => {
    const spec = createParsedSpec(
      [],
      [
        createSchema('A', ['B', 'C']),
        createSchema('B', ['D']),
        createSchema('C', ['D']),
        createSchema('D'),
      ]
    );

    const { edges } = buildGraph(spec);

    // None of these should be circular - they form a diamond, not a cycle
    const allEdges = edges.filter((e) => e.source.startsWith('schema-'));
    for (const edge of allEdges) {
      expect(edge.data?.edgeType).toBe('schema-ref');
    }
  });
});

describe('buildGraph - Relationship-Based Mode', () => {
  describe('Schema-to-Schema edges', () => {
    it('creates property edges with semantic labels', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'homeAddress',
          required: true,
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('User'), createSchema('Address')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const edge = edges.find((e) => e.source === 'schema-User' && e.target === 'schema-Address');
      expect(edge).toBeDefined();
      expect(edge?.data?.edgeType).toBe('property');
      expect(edge?.data?.conciseLabel).toBe('.homeAddress');
      expect(edge?.data?.verboseLabel).toBe('property: homeAddress (required)');
      expect(edge?.data?.semanticContext?.propertyName).toBe('homeAddress');
      expect(edge?.data?.semanticContext?.required).toBe(true);
    });

    it('creates array-items edges', () => {
      const relationships = [
        createRelationship('schema-array-items', schemaRef('OrderList'), schemaRef('Order'), {
          isArray: true,
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('OrderList'), createSchema('Order')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const edge = edges.find(
        (e) => e.source === 'schema-OrderList' && e.target === 'schema-Order'
      );
      expect(edge).toBeDefined();
      expect(edge?.data?.edgeType).toBe('array-items');
      expect(edge?.data?.conciseLabel).toBe('[]');
    });

    it('creates allOf composition edges', () => {
      const relationships = [
        createRelationship('schema-allOf', schemaRef('Employee'), schemaRef('Person'), {}),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('Employee'), createSchema('Person')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const edge = edges.find(
        (e) => e.source === 'schema-Employee' && e.target === 'schema-Person'
      );
      expect(edge).toBeDefined();
      expect(edge?.data?.edgeType).toBe('allOf');
      expect(edge?.data?.conciseLabel).toBe('extends');
      expect(edge?.style?.strokeDasharray).toBeUndefined(); // allOf is solid
    });

    it('creates oneOf composition edges (dashed)', () => {
      const relationships = [
        createRelationship('schema-oneOf', schemaRef('Pet'), schemaRef('Dog'), {}),
      ];

      const spec = createParsedSpec([], [createSchema('Pet'), createSchema('Dog')], relationships);

      const { edges } = buildGraph(spec);

      const edge = edges.find((e) => e.source === 'schema-Pet' && e.target === 'schema-Dog');
      expect(edge).toBeDefined();
      expect(edge?.data?.edgeType).toBe('oneOf');
      expect(edge?.style?.strokeDasharray).toBe('5,5'); // oneOf is dashed
    });

    it('creates anyOf composition edges (dashed)', () => {
      const relationships = [
        createRelationship('schema-anyOf', schemaRef('Response'), schemaRef('Error'), {}),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('Response'), createSchema('Error')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const edge = edges.find((e) => e.source === 'schema-Response' && e.target === 'schema-Error');
      expect(edge).toBeDefined();
      expect(edge?.data?.edgeType).toBe('anyOf');
      expect(edge?.style?.strokeDasharray).toBe('5,5'); // anyOf is dashed
    });

    it('creates discriminator edges with value context', () => {
      const relationships = [
        createRelationship('schema-discriminator', schemaRef('Pet'), schemaRef('Dog'), {
          discriminatorValue: 'dog',
        }),
        createRelationship('schema-discriminator', schemaRef('Pet'), schemaRef('Cat'), {
          discriminatorValue: 'cat',
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('Pet'), createSchema('Dog'), createSchema('Cat')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const dogEdge = edges.find(
        (e) =>
          e.source === 'schema-Pet' &&
          e.target === 'schema-Dog' &&
          e.data?.edgeType === 'discriminator'
      );
      const catEdge = edges.find(
        (e) =>
          e.source === 'schema-Pet' &&
          e.target === 'schema-Cat' &&
          e.data?.edgeType === 'discriminator'
      );

      expect(dogEdge).toBeDefined();
      expect(dogEdge?.data?.conciseLabel).toBe('=dog');
      expect(dogEdge?.data?.verboseLabel).toBe('discriminator: dog');

      expect(catEdge).toBeDefined();
      expect(catEdge?.data?.conciseLabel).toBe('=cat');
    });

    it('creates additionalProperties edges', () => {
      const relationships = [
        createRelationship(
          'schema-additional-props',
          schemaRef('Dictionary'),
          schemaRef('Value'),
          {}
        ),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('Dictionary'), createSchema('Value')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const edge = edges.find(
        (e) => e.source === 'schema-Dictionary' && e.target === 'schema-Value'
      );
      expect(edge).toBeDefined();
      expect(edge?.data?.edgeType).toBe('additional-props');
      expect(edge?.data?.conciseLabel).toBe('[*]');
      expect(edge?.style?.strokeDasharray).toBe('5,5'); // additionalProperties is dashed
    });

    it('creates not schema edges', () => {
      const relationships = [
        createRelationship('schema-not', schemaRef('NotEmpty'), schemaRef('Empty'), {}),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('NotEmpty'), createSchema('Empty')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const edge = edges.find((e) => e.source === 'schema-NotEmpty' && e.target === 'schema-Empty');
      expect(edge).toBeDefined();
      expect(edge?.data?.edgeType).toBe('not');
      expect(edge?.data?.conciseLabel).toBe('not');
    });

    it('creates tuple-item edges with index', () => {
      const relationships = [
        createRelationship('schema-tuple-item', schemaRef('Point'), schemaRef('Coordinate'), {
          tupleIndex: 0,
        }),
        createRelationship('schema-tuple-item', schemaRef('Point'), schemaRef('Coordinate'), {
          tupleIndex: 1,
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('Point'), createSchema('Coordinate')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const tupleEdges = edges.filter(
        (e) => e.source === 'schema-Point' && e.data?.edgeType === 'tuple-item'
      );
      expect(tupleEdges).toHaveLength(2);
      expect(tupleEdges.some((e) => e.data?.conciseLabel === '[0]')).toBe(true);
      expect(tupleEdges.some((e) => e.data?.conciseLabel === '[1]')).toBe(true);
    });
  });

  describe('Endpoint-to-Schema edges', () => {
    it('creates request body edges', () => {
      const relationships = [
        createRelationship(
          'endpoint-request-body',
          endpointRef('post-/users'),
          schemaRef('CreateUserRequest'),
          { mediaType: 'application/json' }
        ),
      ];

      const spec = createParsedSpec(
        [createEndpoint('post-/users', '/users', 'post')],
        [createSchema('CreateUserRequest')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const edge = edges.find(
        (e) => e.source === 'post-/users' && e.target === 'schema-CreateUserRequest'
      );
      expect(edge).toBeDefined();
      expect(edge?.data?.edgeType).toBe('request-body');
      expect(edge?.data?.conciseLabel).toBe('body');
      expect(edge?.data?.semanticContext?.mediaType).toBe('application/json');
    });

    it('creates response edges with status code', () => {
      const relationships = [
        createRelationship('endpoint-response', endpointRef('get-/users'), schemaRef('UserList'), {
          statusCode: '200',
          mediaType: 'application/json',
        }),
        createRelationship('endpoint-response', endpointRef('get-/users'), schemaRef('Error'), {
          statusCode: '400',
          mediaType: 'application/json',
        }),
      ];

      const spec = createParsedSpec(
        [createEndpoint('get-/users', '/users')],
        [createSchema('UserList'), createSchema('Error')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const okEdge = edges.find((e) => e.source === 'get-/users' && e.target === 'schema-UserList');
      expect(okEdge).toBeDefined();
      expect(okEdge?.data?.edgeType).toBe('response');
      expect(okEdge?.data?.conciseLabel).toBe('200');
      expect(okEdge?.data?.verboseLabel).toBe('200 response (application/json)');

      const errorEdge = edges.find((e) => e.source === 'get-/users' && e.target === 'schema-Error');
      expect(errorEdge).toBeDefined();
      expect(errorEdge?.data?.conciseLabel).toBe('400');
    });

    it('creates parameter edges with location', () => {
      const relationships = [
        createRelationship(
          'endpoint-parameter',
          endpointRef('get-/users/{id}'),
          schemaRef('UserId'),
          { parameterName: 'id', parameterLocation: 'path' }
        ),
        createRelationship(
          'endpoint-parameter',
          endpointRef('get-/users/{id}'),
          schemaRef('Pagination'),
          { parameterName: 'page', parameterLocation: 'query' }
        ),
      ];

      const spec = createParsedSpec(
        [createEndpoint('get-/users/{id}', '/users/{id}')],
        [createSchema('UserId'), createSchema('Pagination')],
        relationships
      );

      const { edges } = buildGraph(spec);

      const pathParamEdge = edges.find(
        (e) => e.source === 'get-/users/{id}' && e.target === 'schema-UserId'
      );
      expect(pathParamEdge).toBeDefined();
      expect(pathParamEdge?.data?.edgeType).toBe('parameter');
      expect(pathParamEdge?.data?.conciseLabel).toBe('id');
      expect(pathParamEdge?.data?.verboseLabel).toBe('path param: id');

      const queryParamEdge = edges.find(
        (e) => e.source === 'get-/users/{id}' && e.target === 'schema-Pagination'
      );
      expect(queryParamEdge).toBeDefined();
      expect(queryParamEdge?.data?.verboseLabel).toBe('query param: page');
    });
  });

  describe('Circular reference detection', () => {
    it('detects self-referencing relationships', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('Node'), schemaRef('Node'), {
          propertyName: 'parent',
        }),
      ];

      const spec = createParsedSpec([], [createSchema('Node')], relationships);

      const { edges } = buildGraph(spec);

      const selfRefEdge = edges.find(
        (e) => e.source === 'schema-Node' && e.target === 'schema-Node'
      );
      expect(selfRefEdge).toBeDefined();
      expect(selfRefEdge?.data?.edgeType).toBe('circular');
      expect(selfRefEdge?.animated).toBe(true);
    });

    it('detects two-level circular relationships', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('A'), schemaRef('B'), {
          propertyName: 'b',
        }),
        createRelationship('schema-property', schemaRef('B'), schemaRef('A'), {
          propertyName: 'a',
        }),
      ];

      const spec = createParsedSpec([], [createSchema('A'), createSchema('B')], relationships);

      const { edges } = buildGraph(spec);

      const aToBEdge = edges.find((e) => e.source === 'schema-A' && e.target === 'schema-B');
      const bToAEdge = edges.find((e) => e.source === 'schema-B' && e.target === 'schema-A');

      expect(aToBEdge?.data?.edgeType).toBe('circular');
      expect(bToAEdge?.data?.edgeType).toBe('circular');
    });

    it('detects circular references across different relationship types', () => {
      const relationships = [
        createRelationship('schema-allOf', schemaRef('A'), schemaRef('B'), {}),
        createRelationship('schema-property', schemaRef('B'), schemaRef('C'), {
          propertyName: 'c',
        }),
        createRelationship('schema-oneOf', schemaRef('C'), schemaRef('A'), {}),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('A'), createSchema('B'), createSchema('C')],
        relationships
      );

      const { edges } = buildGraph(spec);

      // All edges in the cycle should be marked as circular
      for (const edge of edges) {
        expect(edge.data?.edgeType).toBe('circular');
        expect(edge.animated).toBe(true);
      }
    });

    it('does not mark non-circular relationships as circular', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'address',
        }),
        createRelationship('schema-property', schemaRef('Address'), schemaRef('Country'), {
          propertyName: 'country',
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('User'), createSchema('Address'), createSchema('Country')],
        relationships
      );

      const { edges } = buildGraph(spec);

      for (const edge of edges) {
        expect(edge.data?.edgeType).toBe('property');
        expect(edge.animated).toBeFalsy();
      }
    });

    it('endpoint relationships are not considered for circular detection', () => {
      // Even if an endpoint creates a logical loop, it should not be marked circular
      // because endpoints don't participate in schema inheritance/composition cycles
      const relationships = [
        createRelationship('endpoint-response', endpointRef('get-/users'), schemaRef('User'), {
          statusCode: '200',
        }),
        createRelationship('schema-property', schemaRef('User'), schemaRef('User'), {
          propertyName: 'manager',
        }),
      ];

      const spec = createParsedSpec(
        [createEndpoint('get-/users', '/users')],
        [createSchema('User')],
        relationships
      );

      const { edges } = buildGraph(spec);

      // The endpoint-response edge should NOT be circular
      const endpointEdge = edges.find((e) => e.source === 'get-/users');
      expect(endpointEdge?.data?.edgeType).toBe('response');
      expect(endpointEdge?.animated).toBeFalsy();

      // But the self-referencing schema edge IS circular
      const schemaEdge = edges.find(
        (e) => e.source === 'schema-User' && e.target === 'schema-User'
      );
      expect(schemaEdge?.data?.edgeType).toBe('circular');
    });
  });

  describe('Node data enrichment', () => {
    it('populates discriminatorValues for target schemas', () => {
      const petSchema = createSchema('Pet');
      const dogSchema = createSchema('Dog');
      const catSchema = createSchema('Cat');

      const relationships = [
        createRelationship('schema-discriminator', schemaRef('Pet'), schemaRef('Dog'), {
          discriminatorValue: 'dog',
        }),
        createRelationship('schema-discriminator', schemaRef('Pet'), schemaRef('Cat'), {
          discriminatorValue: 'cat',
        }),
      ];

      const spec = createParsedSpec([], [petSchema, dogSchema, catSchema], relationships);

      const { nodes } = buildGraph(spec);

      const dogNode = nodes.find((n) => n.id === 'schema-Dog');
      const catNode = nodes.find((n) => n.id === 'schema-Cat');

      expect(dogNode?.data.type).toBe('schema');
      if (dogNode?.data.type === 'schema') {
        expect(dogNode.data.discriminatorValues).toEqual(['dog']);
      }

      expect(catNode?.data.type).toBe('schema');
      if (catNode?.data.type === 'schema') {
        expect(catNode.data.discriminatorValues).toEqual(['cat']);
      }
    });

    it('calculates reference counts correctly', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'home',
        }),
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'work',
        }),
        createRelationship('schema-property', schemaRef('Company'), schemaRef('Address'), {
          propertyName: 'headquarters',
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('User'), createSchema('Company'), createSchema('Address')],
        relationships
      );

      const { nodes } = buildGraph(spec);

      const addressNode = nodes.find((n) => n.id === 'schema-Address');
      expect(addressNode?.data.type).toBe('schema');
      if (addressNode?.data.type === 'schema') {
        expect(addressNode.data.incomingRefCount).toBe(3);
        expect(addressNode.data.outgoingRefCount).toBe(0);
      }

      const userNode = nodes.find((n) => n.id === 'schema-User');
      if (userNode?.data.type === 'schema') {
        expect(userNode.data.incomingRefCount).toBe(0);
        expect(userNode.data.outgoingRefCount).toBe(2);
      }
    });

    it('sets hasDiscriminator flag from schema', () => {
      const petSchema: Schema = {
        ...createSchema('Pet'),
        discriminator: { propertyName: 'petType', mapping: { dog: 'Dog' } },
      };

      const spec = createParsedSpec([], [petSchema], []);

      const { nodes } = buildGraph(spec);

      const petNode = nodes.find((n) => n.id === 'schema-Pet');
      expect(petNode?.data.type).toBe('schema');
      if (petNode?.data.type === 'schema') {
        expect(petNode.data.hasDiscriminator).toBe(true);
      }
    });

    it('sets compositionType from schema', () => {
      const allOfSchema: Schema = {
        ...createSchema('Employee'),
        allOf: [{ ...createSchema('Person') }],
      };
      const oneOfSchema: Schema = {
        ...createSchema('Pet'),
        oneOf: [{ ...createSchema('Dog') }],
      };
      const anyOfSchema: Schema = {
        ...createSchema('Response'),
        anyOf: [{ ...createSchema('Success') }],
      };

      const spec = createParsedSpec([], [allOfSchema, oneOfSchema, anyOfSchema], []);

      const { nodes } = buildGraph(spec);

      const employeeNode = nodes.find((n) => n.id === 'schema-Employee');
      if (employeeNode?.data.type === 'schema') {
        expect(employeeNode.data.compositionType).toBe('allOf');
      }

      const petNode = nodes.find((n) => n.id === 'schema-Pet');
      if (petNode?.data.type === 'schema') {
        expect(petNode.data.compositionType).toBe('oneOf');
      }

      const responseNode = nodes.find((n) => n.id === 'schema-Response');
      if (responseNode?.data.type === 'schema') {
        expect(responseNode.data.compositionType).toBe('anyOf');
      }
    });
  });

  describe('Edge deduplication', () => {
    it('deduplicates identical relationships', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'address',
        }),
        // Duplicate with same context
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'address',
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('User'), createSchema('Address')],
        relationships
      );

      const { edges } = buildGraph(spec);

      // Should only have one edge despite two relationships
      const userToAddressEdges = edges.filter(
        (e) => e.source === 'schema-User' && e.target === 'schema-Address'
      );
      expect(userToAddressEdges).toHaveLength(1);
    });

    it('keeps relationships with different contexts', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'homeAddress',
        }),
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'workAddress',
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('User'), createSchema('Address')],
        relationships
      );

      const { edges } = buildGraph(spec);

      // Should have two edges with different property names
      const userToAddressEdges = edges.filter(
        (e) => e.source === 'schema-User' && e.target === 'schema-Address'
      );
      expect(userToAddressEdges).toHaveLength(2);
      expect(
        userToAddressEdges.some((e) => e.data?.semanticContext?.propertyName === 'homeAddress')
      ).toBe(true);
      expect(
        userToAddressEdges.some((e) => e.data?.semanticContext?.propertyName === 'workAddress')
      ).toBe(true);
    });
  });

  describe('Filtering invalid references', () => {
    it('skips relationships to non-existent schemas', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('User'), schemaRef('NonExistent'), {
          propertyName: 'missing',
        }),
      ];

      const spec = createParsedSpec([], [createSchema('User')], relationships);

      const { edges } = buildGraph(spec);

      expect(edges).toHaveLength(0);
    });

    it('skips relationships from non-existent endpoints', () => {
      const relationships = [
        createRelationship('endpoint-response', endpointRef('non-existent'), schemaRef('User'), {
          statusCode: '200',
        }),
      ];

      const spec = createParsedSpec([], [createSchema('User')], relationships);

      const { edges } = buildGraph(spec);

      expect(edges).toHaveLength(0);
    });
  });

  describe('Orphaned schema detection', () => {
    it('marks schemas with no incoming references as orphaned', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('User'), schemaRef('Address'), {
          propertyName: 'address',
        }),
      ];

      const spec = createParsedSpec(
        [],
        [createSchema('User'), createSchema('Address'), createSchema('Orphaned')],
        relationships
      );

      const { nodes } = buildGraph(spec);

      // User has no incoming refs -> orphaned
      const userNode = nodes.find((n) => n.id === 'schema-User');
      if (userNode?.data.type === 'schema') {
        expect(userNode.data.isOrphaned).toBe(true);
      }

      // Address has incoming ref from User -> not orphaned
      const addressNode = nodes.find((n) => n.id === 'schema-Address');
      if (addressNode?.data.type === 'schema') {
        expect(addressNode.data.isOrphaned).toBe(false);
      }

      // Orphaned has no refs at all -> orphaned
      const orphanedNode = nodes.find((n) => n.id === 'schema-Orphaned');
      if (orphanedNode?.data.type === 'schema') {
        expect(orphanedNode.data.isOrphaned).toBe(true);
      }
    });

    it('marks schemas referenced by endpoints as not orphaned', () => {
      const relationships = [
        createRelationship('endpoint-response', endpointRef('get-/users'), schemaRef('User'), {
          statusCode: '200',
        }),
      ];

      const spec = createParsedSpec(
        [createEndpoint('get-/users', '/users')],
        [createSchema('User'), createSchema('Orphaned')],
        relationships
      );

      const { nodes } = buildGraph(spec);

      // User is referenced by endpoint -> not orphaned
      const userNode = nodes.find((n) => n.id === 'schema-User');
      if (userNode?.data.type === 'schema') {
        expect(userNode.data.isOrphaned).toBe(false);
      }

      // Orphaned is never referenced -> orphaned
      const orphanedNode = nodes.find((n) => n.id === 'schema-Orphaned');
      if (orphanedNode?.data.type === 'schema') {
        expect(orphanedNode.data.isOrphaned).toBe(true);
      }
    });

    it('handles self-referencing schemas correctly', () => {
      const relationships = [
        createRelationship('schema-property', schemaRef('Node'), schemaRef('Node'), {
          propertyName: 'parent',
        }),
      ];

      const spec = createParsedSpec([], [createSchema('Node')], relationships);

      const { nodes } = buildGraph(spec);

      // Node references itself, so it has incoming refs -> not orphaned
      const nodeNode = nodes.find((n) => n.id === 'schema-Node');
      if (nodeNode?.data.type === 'schema') {
        expect(nodeNode.data.isOrphaned).toBe(false);
      }
    });

    it('marks all schemas as orphaned when no relationships exist', () => {
      const spec = createParsedSpec(
        [],
        [createSchema('A'), createSchema('B'), createSchema('C')],
        []
      );

      const { nodes } = buildGraph(spec);

      for (const node of nodes) {
        if (node.data.type === 'schema') {
          expect(node.data.isOrphaned).toBe(true);
        }
      }
    });
  });
});
