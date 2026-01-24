import type { Schema, SchemaType, SchemaProperty, Discriminator } from '@/types';
import { createSourceLocation } from '../lineMapper';
import type { SchemaExtractionOptions } from '../types';

/**
 * Generates a unique ID for a schema.
 * Uses crypto.randomUUID() to ensure global uniqueness across all schemas,
 * including inline schemas that may have the same display name.
 */
export function generateSchemaId(): string {
  return globalThis.crypto.randomUUID();
}

export function extractSchemaType(schemaObj: Record<string, unknown>): SchemaType {
  const type = schemaObj.type as string | undefined;
  if (type && ['string', 'number', 'integer', 'boolean', 'array', 'object', 'null'].includes(type)) {
    return type as SchemaType;
  }
  if (schemaObj.$ref) return 'object';
  if (schemaObj.properties) return 'object';
  if (schemaObj.items) return 'array';
  // Composition types are typically object-like
  if (schemaObj.allOf || schemaObj.oneOf || schemaObj.anyOf) return 'object';
  return 'object';
}

/**
 * Extracts the schema name from a $ref string.
 * E.g., "#/components/schemas/Pet" -> "Pet"
 */
export function extractRefName(ref: string): string | null {
  const match = ref.match(/#\/components\/schemas\/(.+)/);
  return match ? match[1] : null;
}

/**
 * Extracts a discriminator object from an OpenAPI schema.
 * Discriminators are used for polymorphism support with oneOf/anyOf.
 *
 * @example
 * discriminator:
 *   propertyName: petType
 *   mapping:
 *     dog: '#/components/schemas/Dog'
 *     cat: '#/components/schemas/Cat'
 */
export function extractDiscriminator(
  discriminatorObj: Record<string, unknown> | undefined
): Discriminator | undefined {
  if (!discriminatorObj) return undefined;

  const propertyName = discriminatorObj.propertyName as string | undefined;
  if (!propertyName) return undefined;

  return {
    propertyName,
    mapping: discriminatorObj.mapping as Record<string, string> | undefined,
  };
}

/**
 * Extracts composition schemas (allOf, oneOf, anyOf) from an array of sub-schemas.
 * Each sub-schema is recursively extracted to preserve nested structures.
 *
 * @param composition - The composition array (allOf, oneOf, or anyOf)
 * @param lineNumber - Source line number for location tracking
 * @param compositionType - The type of composition (allOf, oneOf, anyOf)
 * @param parentContext - Parent schema name for contextual naming
 */
export function extractCompositionSchemas(
  composition: unknown,
  lineNumber: number,
  compositionType: 'allOf' | 'oneOf' | 'anyOf',
  parentContext?: string
): Schema[] | undefined {
  if (!Array.isArray(composition) || composition.length === 0) {
    return undefined;
  }

  return composition.map((subSchema, index) => {
    const schemaObj = subSchema as Record<string, unknown>;
    // Generate a descriptive name with parent context
    const baseName = schemaObj.$ref
      ? extractRefName(schemaObj.$ref as string) || `${compositionType}-${index}`
      : `${compositionType}-${index}`;
    const name = parentContext ? `${parentContext}.${baseName}` : baseName;
    return extractSchema(name, schemaObj, lineNumber, { isInline: true, parentContext });
  });
}

/**
 * Extracts additionalProperties as either a boolean or a Schema reference.
 * - undefined or true: allow any additional properties
 * - false: no additional properties allowed
 * - Schema object: additional properties must match the schema (Map/Dictionary pattern)
 *
 * @param addProps - The additionalProperties value from the schema
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent schema name for contextual naming
 */
export function extractAdditionalProperties(
  addProps: unknown,
  lineNumber: number,
  parentContext?: string
): boolean | Schema | undefined {
  if (addProps === undefined) return undefined;

  // Boolean case: true or false
  if (typeof addProps === 'boolean') {
    return addProps;
  }

  // Schema object case (Map/Dictionary pattern)
  if (typeof addProps === 'object' && addProps !== null) {
    const schemaObj = addProps as Record<string, unknown>;
    const name = parentContext ? `${parentContext}.additionalProperties` : 'additionalProperties';
    return extractSchema(name, schemaObj, lineNumber, { isInline: true, parentContext });
  }

  return undefined;
}

/**
 * Extracts nested properties from a property that has inline properties
 * (e.g., alongside allOf in a combined schema pattern).
 *
 * @param properties - The nested properties object
 * @param requiredFields - List of required field names
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent context for naming (e.g., "RealEstate.cadastralPlots")
 */
export function extractNestedProperties(
  properties: Record<string, Record<string, unknown>>,
  requiredFields: string[] = [],
  lineNumber: number = 1,
  parentContext?: string
): Record<string, SchemaProperty> {
  const result: Record<string, SchemaProperty> = {};
  for (const [propName, prop] of Object.entries(properties)) {
    const propertyContext = parentContext ? `${parentContext}.${propName}` : propName;

    result[propName] = {
      name: propName,
      type: extractSchemaType(prop),
      description: prop.description as string | undefined,
      required: requiredFields.includes(propName),
      format: prop.format as string | undefined,
      enum: prop.enum as unknown[] | undefined,
      $ref: prop.$ref as string | undefined,

      // Handle array items in nested properties
      items: prop.items
        ? extractSchema(`${propertyContext}.items`, prop.items as Record<string, unknown>, lineNumber, {
            isInline: true,
            parentContext: propertyContext,
          })
        : undefined,

      // Handle nested composition
      allOf: extractCompositionSchemas(prop.allOf, lineNumber, 'allOf', propertyContext),
      oneOf: extractCompositionSchemas(prop.oneOf, lineNumber, 'oneOf', propertyContext),
      anyOf: extractCompositionSchemas(prop.anyOf, lineNumber, 'anyOf', propertyContext),

      // Recursively handle deeply nested properties
      properties: prop.properties
        ? extractNestedProperties(
            prop.properties as Record<string, Record<string, unknown>>,
            (prop.required as string[]) || [],
            lineNumber,
            propertyContext
          )
        : undefined,
    };
  }
  return result;
}

/**
 * Extracts schema properties with full context for nested schemas.
 *
 * @param schemaObj - The schema object containing properties
 * @param requiredFields - List of required field names
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent schema name for contextual naming (e.g., "Order")
 */
export function extractSchemaProperties(
  schemaObj: Record<string, unknown>,
  requiredFields: string[] = [],
  lineNumber: number = 1,
  parentContext?: string
): Record<string, SchemaProperty> | undefined {
  const properties = schemaObj.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return undefined;

  const result: Record<string, SchemaProperty> = {};
  for (const [propName, prop] of Object.entries(properties)) {
    // Build the property context for nested schemas (e.g., "Order.address")
    const propertyContext = parentContext ? `${parentContext}.${propName}` : propName;

    result[propName] = {
      name: propName,
      type: extractSchemaType(prop),
      description: prop.description as string | undefined,
      required: requiredFields.includes(propName),
      format: prop.format as string | undefined,
      enum: prop.enum as unknown[] | undefined,
      $ref: prop.$ref as string | undefined,

      // Handle array items in properties with contextual naming
      items: prop.items
        ? extractSchema(`${propertyContext}.items`, prop.items as Record<string, unknown>, lineNumber, {
            isInline: true,
            parentContext: propertyContext,
          })
        : undefined,

      // Handle nested composition within properties (allOf/oneOf/anyOf)
      // This supports complex property definitions like:
      // address:
      //   oneOf:
      //     - $ref: '#/components/schemas/USAddress'
      //     - $ref: '#/components/schemas/CanadianAddress'
      allOf: extractCompositionSchemas(prop.allOf, lineNumber, 'allOf', propertyContext),
      oneOf: extractCompositionSchemas(prop.oneOf, lineNumber, 'oneOf', propertyContext),
      anyOf: extractCompositionSchemas(prop.anyOf, lineNumber, 'anyOf', propertyContext),

      // Handle inline properties alongside allOf (combined schema pattern)
      // This supports patterns like:
      // cadastralPlots:
      //   allOf:
      //     - $ref: '#/components/schemas/PropertyMetadata'
      //   properties:
      //     value:
      //       items:
      //         $ref: '#/components/schemas/Target'
      properties: prop.properties
        ? extractNestedProperties(
            prop.properties as Record<string, Record<string, unknown>>,
            (prop.required as string[]) || [],
            lineNumber,
            propertyContext
          )
        : undefined,
    };
  }
  return result;
}

/**
 * Extracts prefixItems for tuple type support (OpenAPI 3.1 / JSON Schema 2020-12).
 * Each item in the array defines the schema for that position.
 *
 * @param prefixItems - The prefixItems array from the schema
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent schema name for contextual naming
 *
 * @example
 * prefixItems:
 *   - type: string
 *   - type: integer
 *   - $ref: '#/components/schemas/Address'
 */
export function extractPrefixItems(
  prefixItems: unknown,
  lineNumber: number,
  parentContext?: string
): Schema[] | undefined {
  if (!Array.isArray(prefixItems) || prefixItems.length === 0) {
    return undefined;
  }

  return prefixItems.map((item, index) => {
    const schemaObj = item as Record<string, unknown>;
    const baseName = schemaObj.$ref
      ? extractRefName(schemaObj.$ref as string) || `[${index}]`
      : `[${index}]`;
    const name = parentContext ? `${parentContext}${baseName}` : baseName;
    return extractSchema(name, schemaObj, lineNumber, { isInline: true, parentContext });
  });
}

/**
 * Extracts a schema object into the internal Schema representation.
 *
 * @param name - Display name for the schema (used in UI, may not be unique)
 * @param schemaObj - The raw schema object from the OpenAPI spec
 * @param lineNumber - Source line number for location tracking
 * @param options - Extraction options (isInline, parentContext)
 */
export function extractSchema(
  name: string,
  schemaObj: Record<string, unknown>,
  lineNumber: number,
  options: SchemaExtractionOptions = { isInline: false }
): Schema {
  const { isInline, parentContext } = options;
  const requiredFields = (schemaObj.required as string[]) || [];

  // Use the current schema name as context for nested extractions
  const currentContext = parentContext ? name : name;

  return {
    // Generate globally unique ID for graph node identification
    id: generateSchemaId(),
    name,
    type: extractSchemaType(schemaObj),
    description: schemaObj.description as string | undefined,
    properties: extractSchemaProperties(schemaObj, requiredFields, lineNumber, currentContext),
    required: requiredFields,

    // Additional properties (boolean or Schema for Map/Dictionary pattern)
    additionalProperties: extractAdditionalProperties(schemaObj.additionalProperties, lineNumber, currentContext),

    enum: schemaObj.enum as unknown[] | undefined,
    $ref: schemaObj.$ref as string | undefined,

    // Array items with contextual naming
    items: schemaObj.items
      ? extractSchema(
          `${currentContext}.items`,
          schemaObj.items as Record<string, unknown>,
          lineNumber,
          { isInline: true, parentContext: currentContext }
        )
      : undefined,

    // Tuple items (OAS 3.1)
    prefixItems: extractPrefixItems(schemaObj.prefixItems, lineNumber, currentContext),

    // Composition types with contextual naming
    allOf: extractCompositionSchemas(schemaObj.allOf, lineNumber, 'allOf', currentContext),
    oneOf: extractCompositionSchemas(schemaObj.oneOf, lineNumber, 'oneOf', currentContext),
    anyOf: extractCompositionSchemas(schemaObj.anyOf, lineNumber, 'anyOf', currentContext),

    // Negation schema
    not: schemaObj.not
      ? extractSchema(
          `${currentContext}.not`,
          schemaObj.not as Record<string, unknown>,
          lineNumber,
          { isInline: true, parentContext: currentContext }
        )
      : undefined,

    // Discriminator for polymorphism with oneOf/anyOf
    discriminator: extractDiscriminator(schemaObj.discriminator as Record<string, unknown> | undefined),

    sourceLocation: createSourceLocation(lineNumber),

    // Track whether this schema is defined inline vs in components/schemas
    isInline,
  };
}
