/**
 * Circular Reference Detection Module
 *
 * This module uses Tarjan's algorithm to detect strongly connected components (SCCs)
 * in schema-to-schema relationships, identifying circular reference chains.
 */

import type { Relationship } from '@/types/relationships';

/**
 * Detects all relationships that are part of a circular reference chain.
 * Uses Tarjan's algorithm to find strongly connected components (SCCs).
 * Returns a set of relationship IDs that form cycles.
 */
export function detectCircularRelationships(relationships: Relationship[]): Set<string> {
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

  // Tarjan's algorithm state
  let index = 0;
  const indices = new Map<string, number>();
  const lowlinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  /**
   * Tarjan's strongconnect algorithm - finds strongly connected components.
   * A strongly connected component is a maximal set of vertices such that
   * there is a path from each vertex to every other vertex.
   */
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
