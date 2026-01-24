/**
 * Relationship Collector Module
 *
 * This module is responsible for collecting all relationships between
 * OpenAPI components (schemas, endpoints, etc.). It traverses the parsed
 * specification and creates Relationship objects that capture how
 * components reference each other.
 *
 * Relationship types handled:
 * - Schema-to-schema: property refs, composition (allOf/oneOf/anyOf),
 *   array items, tuple items, additionalProperties, discriminator mappings
 * - Endpoint-to-schema: request bodies, responses, parameters
 * - Component-to-schema: response components, parameter components, etc.
 */

import type {
  Endpoint,
  Schema,
  ComponentRegistry,
  Relationship,
} from '@/types';
import {
  createRelationship,
  type ComponentRef,
  type RelationshipContext,
} from '@/types/relationships';
import { extractRefName } from './extractors';

// =============================================================================
// Component Reference Creators
// =============================================================================

/**
 * Creates a ComponentRef for a schema.
 */
export function createSchemaRef(schemaName: string, path?: string): ComponentRef {
  return { componentType: 'schema', name: schemaName, path };
}

/**
 * Creates a ComponentRef for an endpoint.
 */
export function createEndpointRef(endpointId: string, path?: string): ComponentRef {
  return { componentType: 'endpoint', name: endpointId, path };
}

/**
 * Alias for extractRefName for use in relationship collection.
 * Returns null if the reference is not to a schema component.
 *
 * @example
 * extractSchemaRefName('#/components/schemas/Pet') // 'Pet'
 * extractSchemaRefName('#/components/responses/Error') // null
 */
export const extractSchemaRefName = extractRefName;

// =============================================================================
// Schema Relationship Collection
// =============================================================================

/**
 * Collects relationships from a single schema.
 * This handles:
 * - Property references (schema-property)
 * - additionalProperties references (schema-additional-props)
 * - Array items references (schema-array-items)
 * - Tuple item references (schema-tuple-item)
 * - Composition references (schema-allOf, schema-oneOf, schema-anyOf)
 * - Not schema references (schema-not)
 * - Discriminator mappings (schema-discriminator)
 */
export function collectSchemaRelationships(schema: Schema, relationships: Relationship[]): void {
  const sourceRef = createSchemaRef(schema.name);

  // 1. Property references
  if (schema.properties) {
    for (const [propName, prop] of Object.entries(schema.properties)) {
      // Direct $ref on property
      if (prop.$ref) {
        const targetName = extractSchemaRefName(prop.$ref);
        if (targetName) {
          const context: RelationshipContext = {
            propertyName: propName,
            required: prop.required,
          };
          relationships.push(createRelationship('schema-property', sourceRef, createSchemaRef(targetName), context));
        }
      }

      // Array items in property
      if (prop.items?.$ref) {
        const targetName = extractSchemaRefName(prop.items.$ref);
        if (targetName) {
          const context: RelationshipContext = {
            propertyName: propName,
            isArray: true,
            required: prop.required,
          };
          relationships.push(createRelationship('schema-array-items', sourceRef, createSchemaRef(targetName), context));
        }
      }

      // Nested composition in property (oneOf/anyOf/allOf)
      if (prop.oneOf) {
        collectCompositionRelationships(schema.name, prop.oneOf, 'schema-oneOf', relationships, propName);
      }
      if (prop.anyOf) {
        collectCompositionRelationships(schema.name, prop.anyOf, 'schema-anyOf', relationships, propName);
      }
      if (prop.allOf) {
        collectCompositionRelationships(schema.name, prop.allOf, 'schema-allOf', relationships, propName);
      }

      // Recursively collect from nested items schema
      if (prop.items && !prop.items.$ref) {
        collectSchemaRelationships(prop.items, relationships);
      }
    }
  }

  // 2. additionalProperties reference
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    const addProps = schema.additionalProperties;
    if (addProps.$ref) {
      const targetName = extractSchemaRefName(addProps.$ref);
      if (targetName) {
        relationships.push(createRelationship('schema-additional-props', sourceRef, createSchemaRef(targetName), {}));
      }
    }
    // Recursively collect from additionalProperties schema if it's not a ref
    if (!addProps.$ref) {
      collectSchemaRelationships(addProps, relationships);
    }
  }

  // 3. Array items reference (top-level)
  if (schema.items) {
    if (schema.items.$ref) {
      const targetName = extractSchemaRefName(schema.items.$ref);
      if (targetName) {
        const context: RelationshipContext = { isArray: true };
        relationships.push(createRelationship('schema-array-items', sourceRef, createSchemaRef(targetName), context));
      }
    }
    // Recursively collect from items schema if it's not a ref
    if (!schema.items.$ref) {
      collectSchemaRelationships(schema.items, relationships);
    }
  }

  // 4. Tuple items (prefixItems)
  if (schema.prefixItems) {
    schema.prefixItems.forEach((tupleItem, index) => {
      if (tupleItem.$ref) {
        const targetName = extractSchemaRefName(tupleItem.$ref);
        if (targetName) {
          const context: RelationshipContext = { tupleIndex: index };
          relationships.push(createRelationship('schema-tuple-item', sourceRef, createSchemaRef(targetName), context));
        }
      }
      // Recursively collect from tuple item schema if it's not a ref
      if (!tupleItem.$ref) {
        collectSchemaRelationships(tupleItem, relationships);
      }
    });
  }

  // 5. Composition (allOf, oneOf, anyOf)
  if (schema.allOf) {
    collectCompositionRelationships(schema.name, schema.allOf, 'schema-allOf', relationships);
  }
  if (schema.oneOf) {
    collectCompositionRelationships(schema.name, schema.oneOf, 'schema-oneOf', relationships);
  }
  if (schema.anyOf) {
    collectCompositionRelationships(schema.name, schema.anyOf, 'schema-anyOf', relationships);
  }

  // 6. Not schema
  if (schema.not) {
    if (schema.not.$ref) {
      const targetName = extractSchemaRefName(schema.not.$ref);
      if (targetName) {
        relationships.push(createRelationship('schema-not', sourceRef, createSchemaRef(targetName), {}));
      }
    }
    // Recursively collect from not schema if it's not a ref
    if (!schema.not.$ref) {
      collectSchemaRelationships(schema.not, relationships);
    }
  }

  // 7. Discriminator mappings
  if (schema.discriminator?.mapping) {
    for (const [discriminatorValue, ref] of Object.entries(schema.discriminator.mapping)) {
      const targetName = extractSchemaRefName(ref);
      if (targetName) {
        const context: RelationshipContext = { discriminatorValue };
        relationships.push(createRelationship('schema-discriminator', sourceRef, createSchemaRef(targetName), context));
      }
    }
  }
}

/**
 * Helper to collect composition relationships (allOf, oneOf, anyOf).
 */
export function collectCompositionRelationships(
  sourceName: string,
  compositions: Schema[],
  type: 'schema-allOf' | 'schema-oneOf' | 'schema-anyOf',
  relationships: Relationship[],
  propertyName?: string
): void {
  const sourceRef = createSchemaRef(sourceName);

  for (const subSchema of compositions) {
    if (subSchema.$ref) {
      const targetName = extractSchemaRefName(subSchema.$ref);
      if (targetName) {
        const context: RelationshipContext = propertyName ? { propertyName } : {};
        relationships.push(createRelationship(type, sourceRef, createSchemaRef(targetName), context));
      }
    }
    // Recursively collect from sub-schema if it's not a ref
    if (!subSchema.$ref) {
      collectSchemaRelationships(subSchema, relationships);
    }
  }
}

// =============================================================================
// Component Schema Reference Extraction
// =============================================================================

/**
 * Extracts all component schema references from an inline schema.
 * This traverses the schema to find all $refs to component schemas.
 * Used for creating endpoint-to-schema edges when the response/request body
 * is an inline schema (e.g., array of refs, object with ref properties).
 */
export function extractComponentSchemaRefs(schema: Schema, refs: Set<string> = new Set()): Set<string> {
  // Direct $ref
  if (schema.$ref) {
    const refName = extractSchemaRefName(schema.$ref);
    if (refName) refs.add(refName);
  }

  // Array items
  if (schema.items?.$ref) {
    const refName = extractSchemaRefName(schema.items.$ref);
    if (refName) refs.add(refName);
  } else if (schema.items && !schema.items.$ref) {
    extractComponentSchemaRefs(schema.items, refs);
  }

  // Properties
  if (schema.properties) {
    for (const prop of Object.values(schema.properties)) {
      if (prop.$ref) {
        const refName = extractSchemaRefName(prop.$ref);
        if (refName) refs.add(refName);
      }
      if (prop.items?.$ref) {
        const refName = extractSchemaRefName(prop.items.$ref);
        if (refName) refs.add(refName);
      }
      // Nested composition in properties
      for (const compositionSchemas of [prop.allOf, prop.oneOf, prop.anyOf]) {
        if (compositionSchemas) {
          for (const sub of compositionSchemas) {
            if (sub.$ref) {
              const refName = extractSchemaRefName(sub.$ref);
              if (refName) refs.add(refName);
            }
          }
        }
      }
    }
  }

  // Composition (allOf, oneOf, anyOf)
  for (const compositionSchemas of [schema.allOf, schema.oneOf, schema.anyOf]) {
    if (compositionSchemas) {
      for (const sub of compositionSchemas) {
        if (sub.$ref) {
          const refName = extractSchemaRefName(sub.$ref);
          if (refName) refs.add(refName);
        } else {
          extractComponentSchemaRefs(sub, refs);
        }
      }
    }
  }

  // Additional properties
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    if (schema.additionalProperties.$ref) {
      const refName = extractSchemaRefName(schema.additionalProperties.$ref);
      if (refName) refs.add(refName);
    } else {
      extractComponentSchemaRefs(schema.additionalProperties, refs);
    }
  }

  // Prefix items (tuples)
  if (schema.prefixItems) {
    for (const item of schema.prefixItems) {
      if (item.$ref) {
        const refName = extractSchemaRefName(item.$ref);
        if (refName) refs.add(refName);
      } else {
        extractComponentSchemaRefs(item, refs);
      }
    }
  }

  return refs;
}

// =============================================================================
// Endpoint Relationship Collection
// =============================================================================

/**
 * Collects relationships from endpoints to schemas.
 * This handles:
 * - Request body → schema (endpoint-request-body)
 * - Response → schema (endpoint-response) with status code context
 * - Parameter → schema (endpoint-parameter) with location context
 *
 * For inline schemas (arrays, objects with refs), it creates endpoint-to-schema
 * relationships for all component schemas referenced within.
 */
export function collectEndpointRelationships(endpoint: Endpoint, relationships: Relationship[]): void {
  const sourceRef = createEndpointRef(endpoint.id);

  // 1. Request body → schema
  if (endpoint.requestBody?.content) {
    for (const [mediaType, mediaContent] of Object.entries(endpoint.requestBody.content)) {
      if (mediaContent.schema) {
        if (mediaContent.schema.$ref) {
          // Direct $ref - create single relationship
          const targetName = extractSchemaRefName(mediaContent.schema.$ref);
          if (targetName) {
            const context: RelationshipContext = { mediaType };
            relationships.push(createRelationship('endpoint-request-body', sourceRef, createSchemaRef(targetName), context));
          }
        } else {
          // Inline schema - extract all component schema refs and create relationships
          const refs = extractComponentSchemaRefs(mediaContent.schema);
          for (const targetName of refs) {
            const context: RelationshipContext = { mediaType, isArray: !!mediaContent.schema.items };
            relationships.push(createRelationship('endpoint-request-body', sourceRef, createSchemaRef(targetName), context));
          }
          // Also collect schema-to-schema relationships for the inline schema
          collectSchemaRelationships(mediaContent.schema, relationships);
        }
      }
    }
  }

  // 2. Response → schema (with status code)
  for (const [statusCode, response] of Object.entries(endpoint.responses)) {
    if (response.content) {
      for (const [mediaType, mediaContent] of Object.entries(response.content)) {
        if (mediaContent.schema) {
          if (mediaContent.schema.$ref) {
            // Direct $ref - create single relationship
            const targetName = extractSchemaRefName(mediaContent.schema.$ref);
            if (targetName) {
              const context: RelationshipContext = { statusCode, mediaType };
              relationships.push(createRelationship('endpoint-response', sourceRef, createSchemaRef(targetName), context));
            }
          } else {
            // Inline schema - extract all component schema refs and create relationships
            const refs = extractComponentSchemaRefs(mediaContent.schema);
            for (const targetName of refs) {
              const context: RelationshipContext = { statusCode, mediaType, isArray: !!mediaContent.schema.items };
              relationships.push(createRelationship('endpoint-response', sourceRef, createSchemaRef(targetName), context));
            }
            // Also collect schema-to-schema relationships for the inline schema
            collectSchemaRelationships(mediaContent.schema, relationships);
          }
        }
      }
    }
  }

  // 3. Parameter → schema (with location)
  for (const param of endpoint.parameters) {
    if (param.schema) {
      if (param.schema.$ref) {
        // Direct $ref - create single relationship
        const targetName = extractSchemaRefName(param.schema.$ref);
        if (targetName) {
          const context: RelationshipContext = {
            parameterName: param.name,
            parameterLocation: param.in,
            required: param.required,
          };
          relationships.push(createRelationship('endpoint-parameter', sourceRef, createSchemaRef(targetName), context));
        }
      } else {
        // Inline schema - extract all component schema refs and create relationships
        const refs = extractComponentSchemaRefs(param.schema);
        for (const targetName of refs) {
          const context: RelationshipContext = {
            parameterName: param.name,
            parameterLocation: param.in,
            required: param.required,
            isArray: !!param.schema.items,
          };
          relationships.push(createRelationship('endpoint-parameter', sourceRef, createSchemaRef(targetName), context));
        }
        // Also collect schema-to-schema relationships for the inline schema
        collectSchemaRelationships(param.schema, relationships);
      }
    }
  }
}

// =============================================================================
// Component Relationship Collection
// =============================================================================

/**
 * Collects relationships from component definitions (responses, parameters, requestBodies, headers).
 * This tracks how reusable components reference schemas.
 */
export function collectComponentRelationships(registry: ComponentRegistry, relationships: Relationship[]): void {
  // 1. Response components → schemas
  for (const [name, responseDef] of registry.responses) {
    const sourceRef: ComponentRef = { componentType: 'schema', name: `response:${name}` };

    if (responseDef.content) {
      for (const [mediaType, mediaContent] of Object.entries(responseDef.content)) {
        if (mediaContent.schema) {
          if (mediaContent.schema.$ref) {
            const targetName = extractSchemaRefName(mediaContent.schema.$ref);
            if (targetName) {
              const context: RelationshipContext = { mediaType };
              relationships.push(createRelationship('endpoint-response', sourceRef, createSchemaRef(targetName), context));
            }
          }
          // Recursively collect from inline schema
          if (!mediaContent.schema.$ref) {
            collectSchemaRelationships(mediaContent.schema, relationships);
          }
        }
      }
    }

    // Response headers → schemas
    if (responseDef.headers) {
      for (const [headerName, header] of Object.entries(responseDef.headers)) {
        if (header.schema) {
          if (header.schema.$ref) {
            const targetName = extractSchemaRefName(header.schema.$ref);
            if (targetName) {
              const context: RelationshipContext = { propertyName: headerName };
              relationships.push(createRelationship('schema-property', sourceRef, createSchemaRef(targetName), context));
            }
          }
          if (!header.schema.$ref) {
            collectSchemaRelationships(header.schema, relationships);
          }
        }
      }
    }
  }

  // 2. Parameter components → schemas
  for (const [name, paramDef] of registry.parameters) {
    const sourceRef: ComponentRef = { componentType: 'schema', name: `parameter:${name}` };

    if (paramDef.schema) {
      if (paramDef.schema.$ref) {
        const targetName = extractSchemaRefName(paramDef.schema.$ref);
        if (targetName) {
          const context: RelationshipContext = {
            parameterName: paramDef.name,
            parameterLocation: paramDef.in,
            required: paramDef.required,
          };
          relationships.push(createRelationship('endpoint-parameter', sourceRef, createSchemaRef(targetName), context));
        }
      }
      if (!paramDef.schema.$ref) {
        collectSchemaRelationships(paramDef.schema, relationships);
      }
    }
  }

  // 3. Request body components → schemas
  for (const [name, reqBodyDef] of registry.requestBodies) {
    const sourceRef: ComponentRef = { componentType: 'schema', name: `requestBody:${name}` };

    if (reqBodyDef.content) {
      for (const [mediaType, mediaContent] of Object.entries(reqBodyDef.content)) {
        if (mediaContent.schema) {
          if (mediaContent.schema.$ref) {
            const targetName = extractSchemaRefName(mediaContent.schema.$ref);
            if (targetName) {
              const context: RelationshipContext = { mediaType };
              relationships.push(createRelationship('endpoint-request-body', sourceRef, createSchemaRef(targetName), context));
            }
          }
          if (!mediaContent.schema.$ref) {
            collectSchemaRelationships(mediaContent.schema, relationships);
          }
        }
      }
    }
  }

  // 4. Header components → schemas
  for (const [name, headerDef] of registry.headers) {
    const sourceRef: ComponentRef = { componentType: 'schema', name: `header:${name}` };

    if (headerDef.schema) {
      if (headerDef.schema.$ref) {
        const targetName = extractSchemaRefName(headerDef.schema.$ref);
        if (targetName) {
          relationships.push(createRelationship('schema-property', sourceRef, createSchemaRef(targetName), {}));
        }
      }
      if (!headerDef.schema.$ref) {
        collectSchemaRelationships(headerDef.schema, relationships);
      }
    }
  }
}

// =============================================================================
// Master Collection Function
// =============================================================================

/**
 * Master function that collects all relationships from the parsed spec.
 *
 * @param endpoints - Parsed endpoints
 * @param registry - Component registry with all component types
 * @returns Array of all relationships found in the spec
 */
export function collectRelationships(
  endpoints: Endpoint[],
  registry: ComponentRegistry
): Relationship[] {
  const relationships: Relationship[] = [];

  // 1. Collect relationships from all component schemas
  for (const schema of registry.schemas.values()) {
    collectSchemaRelationships(schema, relationships);
  }

  // 2. Collect relationships from all endpoints
  for (const endpoint of endpoints) {
    collectEndpointRelationships(endpoint, relationships);
  }

  // 3. Collect relationships from reusable component definitions
  collectComponentRelationships(registry, relationships);

  return relationships;
}
