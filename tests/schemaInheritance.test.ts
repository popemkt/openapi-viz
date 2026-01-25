import { describe, it, expect } from 'vitest';
import {
  analyzeSchemaInheritance,
  getCompositionSchemas,
  hasCompositions,
  getCompositionCounts,
  type InheritanceAnalysis,
} from '../src/utils/schemaInheritance';
import type { ParsedSpec, Schema, Relationship } from '../src/types';

/**
 * Helper to create a minimal ParsedSpec for testing
 */
function createMockSpec(
  schemas: Schema[],
  relationships: Relationship[]
): ParsedSpec {
  return {
    info: { title: 'Test API', version: '1.0.0' },
    endpoints: [],
    schemas,
    relationships,
    components: {
      schemas: new Map(schemas.map((s) => [s.name, s])),
      responses: new Map(),
      parameters: new Map(),
      requestBodies: new Map(),
      headers: new Map(),
      links: new Map(),
      callbacks: new Map(),
    },
  };
}

/**
 * Helper to create a schema
 */
function createSchema(name: string, type = 'object'): Schema {
  return {
    id: `schema-${name}`,
    name,
    type,
    isInline: false,
  };
}

/**
 * Helper to create a composition relationship
 */
function createRelationship(
  sourceSchemaName: string,
  targetSchemaName: string,
  type: 'schema-allOf' | 'schema-oneOf' | 'schema-anyOf'
): Relationship {
  return {
    id: `rel-${sourceSchemaName}-${targetSchemaName}-${type}`,
    type,
    source: {
      componentType: 'schema',
      name: sourceSchemaName,
    },
    target: {
      componentType: 'schema',
      name: targetSchemaName,
    },
    context: {},
    isCircular: false,
  };
}

describe('analyzeSchemaInheritance', () => {
  describe('with null spec', () => {
    it('returns empty analysis when parsedSpec is null', () => {
      const result = analyzeSchemaInheritance(null);

      expect(result.allOf.roots).toHaveLength(0);
      expect(result.oneOf.roots).toHaveLength(0);
      expect(result.anyOf.roots).toHaveLength(0);
      expect(result.totalCompositions).toBe(0);
      expect(result.schemaRelationships.size).toBe(0);
    });
  });

  describe('with spec without compositions', () => {
    it('returns empty analysis for spec with no composition relationships', () => {
      const schemas = [createSchema('User'), createSchema('Address')];
      const relationships: Relationship[] = []; // No composition relationships
      const spec = createMockSpec(schemas, relationships);

      const result = analyzeSchemaInheritance(spec);

      expect(result.allOf.roots).toHaveLength(0);
      expect(result.oneOf.roots).toHaveLength(0);
      expect(result.anyOf.roots).toHaveLength(0);
      expect(result.totalCompositions).toBe(0);
    });
  });

  describe('allOf composition', () => {
    it('identifies parent-child hierarchy from allOf relationships', () => {
      // Scenario: Dog and Cat both extend Animal using allOf
      const schemas = [
        createSchema('Animal'),
        createSchema('Dog'),
        createSchema('Cat'),
      ];
      const relationships = [
        createRelationship('Dog', 'Animal', 'schema-allOf'),
        createRelationship('Cat', 'Animal', 'schema-allOf'),
      ];
      const spec = createMockSpec(schemas, relationships);

      const result = analyzeSchemaInheritance(spec);

      expect(result.allOf.roots).toHaveLength(1);
      expect(result.allOf.roots[0].name).toBe('Animal');
      expect(result.allOf.roots[0].children).toHaveLength(2);
      expect(result.allOf.roots[0].children.map((c) => c.name)).toContain('Dog');
      expect(result.allOf.roots[0].children.map((c) => c.name)).toContain('Cat');
    });

    it('identifies root schemas correctly (those with no parents)', () => {
      const schemas = [
        createSchema('Base'),
        createSchema('Derived'),
        createSchema('LeafSchema'),
      ];
      const relationships = [
        createRelationship('Derived', 'Base', 'schema-allOf'),
        createRelationship('LeafSchema', 'Derived', 'schema-allOf'),
      ];
      const spec = createMockSpec(schemas, relationships);

      const result = analyzeSchemaInheritance(spec);

      // Only Base should be a root (it has no parents)
      expect(result.allOf.roots).toHaveLength(1);
      expect(result.allOf.roots[0].name).toBe('Base');
      expect(result.allOf.roots[0].isRoot).toBe(true);
    });

    it('builds multi-level inheritance tree correctly', () => {
      // Base -> Derived -> Leaf
      const schemas = [
        createSchema('Base'),
        createSchema('Derived'),
        createSchema('Leaf'),
      ];
      const relationships = [
        createRelationship('Derived', 'Base', 'schema-allOf'),
        createRelationship('Leaf', 'Derived', 'schema-allOf'),
      ];
      const spec = createMockSpec(schemas, relationships);

      const result = analyzeSchemaInheritance(spec);

      expect(result.allOf.roots).toHaveLength(1);
      const baseNode = result.allOf.roots[0];
      expect(baseNode.name).toBe('Base');
      expect(baseNode.children).toHaveLength(1);

      const derivedNode = baseNode.children[0];
      expect(derivedNode.name).toBe('Derived');
      expect(derivedNode.children).toHaveLength(1);

      const leafNode = derivedNode.children[0];
      expect(leafNode.name).toBe('Leaf');
      expect(leafNode.children).toHaveLength(0);
      expect(leafNode.isLeaf).toBe(true);
    });
  });

  describe('oneOf composition', () => {
    it('identifies oneOf relationships', () => {
      // Pet is oneOf Dog or Cat
      const schemas = [
        createSchema('Pet'),
        createSchema('Dog'),
        createSchema('Cat'),
      ];
      const relationships = [
        createRelationship('Pet', 'Dog', 'schema-oneOf'),
        createRelationship('Pet', 'Cat', 'schema-oneOf'),
      ];
      const spec = createMockSpec(schemas, relationships);

      const result = analyzeSchemaInheritance(spec);

      // Dog and Cat are roots (they are referenced by Pet)
      expect(result.oneOf.roots).toHaveLength(2);
      const rootNames = result.oneOf.roots.map((r) => r.name);
      expect(rootNames).toContain('Dog');
      expect(rootNames).toContain('Cat');
    });

    it('has correct label and description for oneOf', () => {
      const spec = createMockSpec([], []);
      const result = analyzeSchemaInheritance(spec);

      expect(result.oneOf.type).toBe('oneOf');
      expect(result.oneOf.label).toBe('One Of (oneOf)');
      expect(result.oneOf.description).toContain('discriminated union');
    });
  });

  describe('anyOf composition', () => {
    it('identifies anyOf relationships', () => {
      const schemas = [
        createSchema('Mixed'),
        createSchema('TypeA'),
        createSchema('TypeB'),
      ];
      const relationships = [
        createRelationship('Mixed', 'TypeA', 'schema-anyOf'),
        createRelationship('Mixed', 'TypeB', 'schema-anyOf'),
      ];
      const spec = createMockSpec(schemas, relationships);

      const result = analyzeSchemaInheritance(spec);

      expect(result.anyOf.roots).toHaveLength(2);
      const rootNames = result.anyOf.roots.map((r) => r.name);
      expect(rootNames).toContain('TypeA');
      expect(rootNames).toContain('TypeB');
    });

    it('has correct label and description for anyOf', () => {
      const spec = createMockSpec([], []);
      const result = analyzeSchemaInheritance(spec);

      expect(result.anyOf.type).toBe('anyOf');
      expect(result.anyOf.label).toBe('Any Of (anyOf)');
      expect(result.anyOf.description).toContain('non-exclusive union');
    });
  });

  describe('schemaRelationships map', () => {
    it('tracks parent-child relationships for schemas', () => {
      const schemas = [
        createSchema('Parent'),
        createSchema('Child'),
      ];
      const relationships = [
        createRelationship('Child', 'Parent', 'schema-allOf'),
      ];
      const spec = createMockSpec(schemas, relationships);

      const result = analyzeSchemaInheritance(spec);

      // Child should have Parent as a parent
      const childRels = result.schemaRelationships.get('Child');
      expect(childRels).toBeDefined();
      expect(childRels!.parents).toHaveLength(1);
      expect(childRels!.parents[0].name).toBe('Parent');
      expect(childRels!.parents[0].type).toBe('schema-allOf');

      // Parent should have Child as a child
      const parentRels = result.schemaRelationships.get('Parent');
      expect(parentRels).toBeDefined();
      expect(parentRels!.children).toHaveLength(1);
      expect(parentRels!.children[0].name).toBe('Child');
    });
  });

  describe('circular reference handling', () => {
    it('handles circular references without infinite loop', () => {
      // Schema A references B, B references A
      const schemas = [createSchema('SchemaA'), createSchema('SchemaB')];
      const relationships = [
        createRelationship('SchemaA', 'SchemaB', 'schema-allOf'),
        createRelationship('SchemaB', 'SchemaA', 'schema-allOf'),
      ];
      const spec = createMockSpec(schemas, relationships);

      // Should not hang or throw
      const result = analyzeSchemaInheritance(spec);

      // Both would be roots since they both have children
      // But the circular nodes should be truncated
      expect(result.allOf.roots.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('non-schema relationships', () => {
    it('ignores relationships that are not between schemas', () => {
      const schemas = [createSchema('User')];
      const relationships: Relationship[] = [
        {
          id: 'endpoint-rel',
          type: 'schema-allOf',
          source: {
            componentType: 'endpoint', // Not a schema
            name: 'get-users',
          },
          target: {
            componentType: 'schema',
            name: 'User',
          },
          context: {},
          isCircular: false,
        },
      ];
      const spec = createMockSpec(schemas, relationships);

      const result = analyzeSchemaInheritance(spec);

      expect(result.allOf.roots).toHaveLength(0);
    });
  });

  describe('sorting', () => {
    it('sorts root nodes alphabetically', () => {
      const schemas = [
        createSchema('Zebra'),
        createSchema('Alpha'),
        createSchema('Middle'),
      ];
      const relationships = [
        createRelationship('Child1', 'Zebra', 'schema-allOf'),
        createRelationship('Child2', 'Alpha', 'schema-allOf'),
        createRelationship('Child3', 'Middle', 'schema-allOf'),
      ];
      const spec = createMockSpec(
        [...schemas, createSchema('Child1'), createSchema('Child2'), createSchema('Child3')],
        relationships
      );

      const result = analyzeSchemaInheritance(spec);

      const rootNames = result.allOf.roots.map((r) => r.name);
      expect(rootNames).toEqual(['Alpha', 'Middle', 'Zebra']);
    });
  });
});

describe('getCompositionSchemas', () => {
  it('returns empty array for analysis with no compositions', () => {
    const analysis: InheritanceAnalysis = {
      allOf: { type: 'allOf', label: '', description: '', roots: [] },
      oneOf: { type: 'oneOf', label: '', description: '', roots: [] },
      anyOf: { type: 'anyOf', label: '', description: '', roots: [] },
      totalCompositions: 0,
      schemaRelationships: new Map(),
    };

    const result = getCompositionSchemas(analysis);

    expect(result).toEqual([]);
  });

  it('returns all unique schema names from compositions', () => {
    const schemas = [
      createSchema('Base'),
      createSchema('Derived1'),
      createSchema('Derived2'),
    ];
    const relationships = [
      createRelationship('Derived1', 'Base', 'schema-allOf'),
      createRelationship('Derived2', 'Base', 'schema-allOf'),
    ];
    const spec = createMockSpec(schemas, relationships);
    const analysis = analyzeSchemaInheritance(spec);

    const result = getCompositionSchemas(analysis);

    expect(result).toContain('Base');
    expect(result).toContain('Derived1');
    expect(result).toContain('Derived2');
    expect(result).toHaveLength(3);
  });

  it('returns sorted schema names', () => {
    const schemas = [
      createSchema('Zebra'),
      createSchema('Alpha'),
    ];
    const relationships = [
      createRelationship('Alpha', 'Zebra', 'schema-allOf'),
    ];
    const spec = createMockSpec(schemas, relationships);
    const analysis = analyzeSchemaInheritance(spec);

    const result = getCompositionSchemas(analysis);

    expect(result).toEqual(['Alpha', 'Zebra']);
  });
});

describe('hasCompositions', () => {
  it('returns false when no compositions exist', () => {
    const analysis: InheritanceAnalysis = {
      allOf: { type: 'allOf', label: '', description: '', roots: [] },
      oneOf: { type: 'oneOf', label: '', description: '', roots: [] },
      anyOf: { type: 'anyOf', label: '', description: '', roots: [] },
      totalCompositions: 0,
      schemaRelationships: new Map(),
    };

    expect(hasCompositions(analysis)).toBe(false);
  });

  it('returns true when allOf compositions exist', () => {
    const analysis: InheritanceAnalysis = {
      allOf: {
        type: 'allOf',
        label: '',
        description: '',
        roots: [{ name: 'Test', children: [], isRoot: true, isLeaf: true, referenceCount: 0 }],
      },
      oneOf: { type: 'oneOf', label: '', description: '', roots: [] },
      anyOf: { type: 'anyOf', label: '', description: '', roots: [] },
      totalCompositions: 1,
      schemaRelationships: new Map(),
    };

    expect(hasCompositions(analysis)).toBe(true);
  });

  it('returns true when oneOf compositions exist', () => {
    const analysis: InheritanceAnalysis = {
      allOf: { type: 'allOf', label: '', description: '', roots: [] },
      oneOf: {
        type: 'oneOf',
        label: '',
        description: '',
        roots: [{ name: 'Test', children: [], isRoot: true, isLeaf: true, referenceCount: 0 }],
      },
      anyOf: { type: 'anyOf', label: '', description: '', roots: [] },
      totalCompositions: 1,
      schemaRelationships: new Map(),
    };

    expect(hasCompositions(analysis)).toBe(true);
  });

  it('returns true when anyOf compositions exist', () => {
    const analysis: InheritanceAnalysis = {
      allOf: { type: 'allOf', label: '', description: '', roots: [] },
      oneOf: { type: 'oneOf', label: '', description: '', roots: [] },
      anyOf: {
        type: 'anyOf',
        label: '',
        description: '',
        roots: [{ name: 'Test', children: [], isRoot: true, isLeaf: true, referenceCount: 0 }],
      },
      totalCompositions: 1,
      schemaRelationships: new Map(),
    };

    expect(hasCompositions(analysis)).toBe(true);
  });
});

describe('getCompositionCounts', () => {
  it('returns zero counts for empty analysis', () => {
    const analysis: InheritanceAnalysis = {
      allOf: { type: 'allOf', label: '', description: '', roots: [] },
      oneOf: { type: 'oneOf', label: '', description: '', roots: [] },
      anyOf: { type: 'anyOf', label: '', description: '', roots: [] },
      totalCompositions: 0,
      schemaRelationships: new Map(),
    };

    const result = getCompositionCounts(analysis);

    expect(result.allOf).toBe(0);
    expect(result.oneOf).toBe(0);
    expect(result.anyOf).toBe(0);
    expect(result.total).toBe(0);
  });

  it('counts all nodes including children', () => {
    // Create analysis with a tree: Base -> Derived1, Derived2
    const analysis: InheritanceAnalysis = {
      allOf: {
        type: 'allOf',
        label: '',
        description: '',
        roots: [
          {
            name: 'Base',
            children: [
              { name: 'Derived1', children: [], isRoot: false, isLeaf: true, referenceCount: 0 },
              { name: 'Derived2', children: [], isRoot: false, isLeaf: true, referenceCount: 0 },
            ],
            isRoot: true,
            isLeaf: false,
            referenceCount: 2,
          },
        ],
      },
      oneOf: { type: 'oneOf', label: '', description: '', roots: [] },
      anyOf: { type: 'anyOf', label: '', description: '', roots: [] },
      totalCompositions: 1,
      schemaRelationships: new Map(),
    };

    const result = getCompositionCounts(analysis);

    // 1 root + 2 children = 3 nodes
    expect(result.allOf).toBe(3);
    expect(result.oneOf).toBe(0);
    expect(result.anyOf).toBe(0);
    expect(result.total).toBe(3);
  });

  it('counts nodes across all composition types', () => {
    const analysis: InheritanceAnalysis = {
      allOf: {
        type: 'allOf',
        label: '',
        description: '',
        roots: [{ name: 'AllOfRoot', children: [], isRoot: true, isLeaf: true, referenceCount: 0 }],
      },
      oneOf: {
        type: 'oneOf',
        label: '',
        description: '',
        roots: [
          { name: 'OneOfRoot1', children: [], isRoot: true, isLeaf: true, referenceCount: 0 },
          { name: 'OneOfRoot2', children: [], isRoot: true, isLeaf: true, referenceCount: 0 },
        ],
      },
      anyOf: {
        type: 'anyOf',
        label: '',
        description: '',
        roots: [
          {
            name: 'AnyOfRoot',
            children: [
              { name: 'AnyOfChild', children: [], isRoot: false, isLeaf: true, referenceCount: 0 },
            ],
            isRoot: true,
            isLeaf: false,
            referenceCount: 1,
          },
        ],
      },
      totalCompositions: 4,
      schemaRelationships: new Map(),
    };

    const result = getCompositionCounts(analysis);

    expect(result.allOf).toBe(1);
    expect(result.oneOf).toBe(2);
    expect(result.anyOf).toBe(2); // 1 root + 1 child
    expect(result.total).toBe(5);
  });
});

describe('InheritanceNode properties', () => {
  it('sets isLeaf correctly for nodes without children', () => {
    const schemas = [createSchema('Parent'), createSchema('Child')];
    const relationships = [createRelationship('Child', 'Parent', 'schema-allOf')];
    const spec = createMockSpec(schemas, relationships);

    const result = analyzeSchemaInheritance(spec);

    const parentNode = result.allOf.roots[0];
    expect(parentNode.isLeaf).toBe(false);

    const childNode = parentNode.children[0];
    expect(childNode.isLeaf).toBe(true);
  });

  it('sets referenceCount correctly', () => {
    const schemas = [
      createSchema('Base'),
      createSchema('Child1'),
      createSchema('Child2'),
      createSchema('Child3'),
    ];
    const relationships = [
      createRelationship('Child1', 'Base', 'schema-allOf'),
      createRelationship('Child2', 'Base', 'schema-allOf'),
      createRelationship('Child3', 'Base', 'schema-allOf'),
    ];
    const spec = createMockSpec(schemas, relationships);

    const result = analyzeSchemaInheritance(spec);

    const baseNode = result.allOf.roots[0];
    expect(baseNode.referenceCount).toBe(3);
  });

  it('includes schema reference when available', () => {
    const schema = createSchema('MySchema');
    const schemas = [schema, createSchema('Child')];
    const relationships = [createRelationship('Child', 'MySchema', 'schema-allOf')];
    const spec = createMockSpec(schemas, relationships);

    const result = analyzeSchemaInheritance(spec);

    const node = result.allOf.roots[0];
    expect(node.schema).toBeDefined();
    expect(node.schema?.name).toBe('MySchema');
  });

  it('sets compositionType on nodes', () => {
    const schemas = [createSchema('Parent'), createSchema('Child')];
    const relationships = [createRelationship('Child', 'Parent', 'schema-allOf')];
    const spec = createMockSpec(schemas, relationships);

    const result = analyzeSchemaInheritance(spec);

    const parentNode = result.allOf.roots[0];
    expect(parentNode.compositionType).toBe('allOf');
  });
});
