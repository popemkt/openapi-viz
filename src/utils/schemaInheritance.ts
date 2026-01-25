/**
 * Utility functions for extracting and building schema inheritance hierarchies
 * from OpenAPI specifications with allOf/oneOf/anyOf compositions.
 */

import type { ParsedSpec, Schema, RelationshipType } from '@/types';

/**
 * Node in the inheritance tree
 */
export interface InheritanceNode {
  /** Schema name */
  name: string;
  /** Type of composition relationship (allOf, oneOf, anyOf) */
  compositionType?: 'allOf' | 'oneOf' | 'anyOf';
  /** Children schemas that inherit from or compose this schema */
  children: InheritanceNode[];
  /** Whether this is a root node (no parent) */
  isRoot: boolean;
  /** Whether this is a leaf node (no children) */
  isLeaf: boolean;
  /** Number of references from other schemas */
  referenceCount: number;
  /** The schema object if available */
  schema?: Schema;
}

/**
 * Inheritance hierarchy for a specific composition type
 */
export interface CompositionHierarchy {
  type: 'allOf' | 'oneOf' | 'anyOf';
  label: string;
  description: string;
  roots: InheritanceNode[];
}

/**
 * Complete inheritance analysis result
 */
export interface InheritanceAnalysis {
  /** Schemas using allOf (inheritance/extension pattern) */
  allOf: CompositionHierarchy;
  /** Schemas using oneOf (discriminated union / exactly one) */
  oneOf: CompositionHierarchy;
  /** Schemas using anyOf (non-exclusive union / one or more) */
  anyOf: CompositionHierarchy;
  /** Total number of schemas with composition */
  totalCompositions: number;
  /** Map of schema name to its relationships */
  schemaRelationships: Map<string, {
    parents: { name: string; type: RelationshipType }[];
    children: { name: string; type: RelationshipType }[];
  }>;
}

const COMPOSITION_TYPES: Array<'allOf' | 'oneOf' | 'anyOf'> = ['allOf', 'oneOf', 'anyOf'];

const COMPOSITION_LABELS: Record<'allOf' | 'oneOf' | 'anyOf', { label: string; description: string }> = {
  allOf: {
    label: 'Extends (allOf)',
    description: 'Schemas that extend other schemas using allOf composition (inheritance pattern)',
  },
  oneOf: {
    label: 'One Of (oneOf)',
    description: 'Schemas using oneOf composition (discriminated union - exactly one must match)',
  },
  anyOf: {
    label: 'Any Of (anyOf)',
    description: 'Schemas using anyOf composition (non-exclusive union - one or more may match)',
  },
};

/**
 * Analyzes schema inheritance and composition relationships
 */
export function analyzeSchemaInheritance(parsedSpec: ParsedSpec | null): InheritanceAnalysis {
  const result: InheritanceAnalysis = {
    allOf: {
      type: 'allOf',
      ...COMPOSITION_LABELS.allOf,
      roots: [],
    },
    oneOf: {
      type: 'oneOf',
      ...COMPOSITION_LABELS.oneOf,
      roots: [],
    },
    anyOf: {
      type: 'anyOf',
      ...COMPOSITION_LABELS.anyOf,
      roots: [],
    },
    totalCompositions: 0,
    schemaRelationships: new Map(),
  };

  if (!parsedSpec) {
    return result;
  }

  const { schemas, relationships } = parsedSpec;
  const schemaMap = new Map<string, Schema>();

  // Build schema lookup map
  for (const schema of schemas) {
    schemaMap.set(schema.name, schema);
  }

  // Build relationship maps for each composition type
  const compositionRelationships: Record<'allOf' | 'oneOf' | 'anyOf', Map<string, Set<string>>> = {
    allOf: new Map(),
    oneOf: new Map(),
    anyOf: new Map(),
  };

  // Also track reverse relationships (child -> parents)
  const reverseRelationships: Record<'allOf' | 'oneOf' | 'anyOf', Map<string, Set<string>>> = {
    allOf: new Map(),
    oneOf: new Map(),
    anyOf: new Map(),
  };

  // Process relationships to build parent-child maps
  for (const rel of relationships) {
    if (rel.source.componentType !== 'schema' || rel.target.componentType !== 'schema') {
      continue;
    }

    const relType = rel.type as RelationshipType;
    let compositionType: 'allOf' | 'oneOf' | 'anyOf' | null = null;

    if (relType === 'schema-allOf') {
      compositionType = 'allOf';
    } else if (relType === 'schema-oneOf') {
      compositionType = 'oneOf';
    } else if (relType === 'schema-anyOf') {
      compositionType = 'anyOf';
    }

    if (compositionType) {
      // source schema "extends" or "uses" target schema
      const sourceName = rel.source.name;
      const targetName = rel.target.name;

      // Forward: target -> children (schemas that use this target)
      if (!compositionRelationships[compositionType].has(targetName)) {
        compositionRelationships[compositionType].set(targetName, new Set());
      }
      compositionRelationships[compositionType].get(targetName)!.add(sourceName);

      // Reverse: source -> parents (schemas that this source extends)
      if (!reverseRelationships[compositionType].has(sourceName)) {
        reverseRelationships[compositionType].set(sourceName, new Set());
      }
      reverseRelationships[compositionType].get(sourceName)!.add(targetName);

      // Update schema relationships map
      if (!result.schemaRelationships.has(sourceName)) {
        result.schemaRelationships.set(sourceName, { parents: [], children: [] });
      }
      if (!result.schemaRelationships.has(targetName)) {
        result.schemaRelationships.set(targetName, { parents: [], children: [] });
      }
      result.schemaRelationships.get(sourceName)!.parents.push({ name: targetName, type: relType });
      result.schemaRelationships.get(targetName)!.children.push({ name: sourceName, type: relType });
    }
  }

  // Build tree structures for each composition type
  for (const compositionType of COMPOSITION_TYPES) {
    const forwardMap = compositionRelationships[compositionType];
    const reverseMap = reverseRelationships[compositionType];

    // Find root schemas (those that are targets but not sources, i.e., have children but no parents)
    const allTargets = new Set(forwardMap.keys());

    const roots = new Set<string>();

    // Root schemas are those that have children but no parents in this composition type
    for (const target of allTargets) {
      if (!reverseMap.has(target)) {
        roots.add(target);
      }
    }

    // Build tree nodes
    const buildNode = (
      name: string,
      visited: Set<string> = new Set()
    ): InheritanceNode => {
      // Prevent infinite loops from circular references
      if (visited.has(name)) {
        return {
          name,
          compositionType,
          children: [],
          isRoot: false,
          isLeaf: true,
          referenceCount: 0,
          schema: schemaMap.get(name),
        };
      }

      visited.add(name);
      const children = forwardMap.get(name) || new Set<string>();
      const childNodes: InheritanceNode[] = [];

      for (const childName of children) {
        childNodes.push(buildNode(childName, new Set(visited)));
      }

      return {
        name,
        compositionType,
        children: childNodes,
        isRoot: !reverseMap.has(name),
        isLeaf: children.size === 0,
        referenceCount: children.size,
        schema: schemaMap.get(name),
      };
    };

    // Build root nodes
    const rootNodes: InheritanceNode[] = [];
    for (const rootName of roots) {
      rootNodes.push(buildNode(rootName));
    }

    // Sort by name for consistent ordering
    rootNodes.sort((a, b) => a.name.localeCompare(b.name));

    result[compositionType].roots = rootNodes;
    result.totalCompositions += rootNodes.length;
  }

  return result;
}

/**
 * Gets a flat list of all schemas involved in compositions
 */
export function getCompositionSchemas(analysis: InheritanceAnalysis): string[] {
  const schemas = new Set<string>();

  const collectSchemas = (nodes: InheritanceNode[]) => {
    for (const node of nodes) {
      schemas.add(node.name);
      collectSchemas(node.children);
    }
  };

  for (const type of COMPOSITION_TYPES) {
    collectSchemas(analysis[type].roots);
  }

  return Array.from(schemas).sort();
}

/**
 * Checks if any compositions exist in the spec
 */
export function hasCompositions(analysis: InheritanceAnalysis): boolean {
  return (
    analysis.allOf.roots.length > 0 ||
    analysis.oneOf.roots.length > 0 ||
    analysis.anyOf.roots.length > 0
  );
}

/**
 * Gets the count of each composition type
 */
export function getCompositionCounts(analysis: InheritanceAnalysis): {
  allOf: number;
  oneOf: number;
  anyOf: number;
  total: number;
} {
  const countNodes = (nodes: InheritanceNode[]): number => {
    let count = nodes.length;
    for (const node of nodes) {
      count += countNodes(node.children);
    }
    return count;
  };

  const allOf = countNodes(analysis.allOf.roots);
  const oneOf = countNodes(analysis.oneOf.roots);
  const anyOf = countNodes(analysis.anyOf.roots);

  return {
    allOf,
    oneOf,
    anyOf,
    total: allOf + oneOf + anyOf,
  };
}
