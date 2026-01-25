/**
 * Orphan Detection Module
 *
 * Detects schemas that are never referenced by any endpoint or other schema.
 * These "orphaned" components represent potential technical debt in the API spec.
 */

import type { Relationship } from '@/types/relationships';

/**
 * Detects orphaned schemas - schemas with zero incoming references.
 *
 * A schema is considered orphaned if:
 * - No endpoint references it (request body, response, parameter)
 * - No other schema references it (property, composition, array items, etc.)
 *
 * @param schemaNames - List of all schema names in the spec
 * @param relationships - All relationships extracted from the spec
 * @returns Set of orphaned schema names
 */
export function detectOrphanedSchemas(
  schemaNames: string[],
  relationships: Relationship[]
): Set<string> {
  // Build a set of all schemas that are referenced (targets of relationships)
  const referencedSchemas = new Set<string>();

  for (const rel of relationships) {
    // Only count references to schema components
    if (rel.target.componentType === 'schema') {
      referencedSchemas.add(rel.target.name);
    }
  }

  // Find schemas that are never referenced
  const orphanedSchemas = new Set<string>();
  for (const name of schemaNames) {
    if (!referencedSchemas.has(name)) {
      orphanedSchemas.add(name);
    }
  }

  return orphanedSchemas;
}
