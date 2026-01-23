/**
 * Relationship model for capturing semantic connections between OpenAPI components.
 * This provides a rich representation of how schemas, endpoints, and other components
 * reference each other, with full context about the nature of each relationship.
 */

/**
 * All possible relationship types in an OpenAPI specification.
 * Organized by source -> target pattern.
 */
export type RelationshipType =
  // Endpoint -> Schema relationships
  | 'endpoint-request-body'    // Endpoint uses schema in request body
  | 'endpoint-response'        // Endpoint returns schema in response
  | 'endpoint-parameter'       // Endpoint parameter uses schema

  // Schema -> Schema relationships (composition)
  | 'schema-allOf'             // Schema extends another via allOf
  | 'schema-oneOf'             // Schema is one of alternatives
  | 'schema-anyOf'             // Schema is any of alternatives
  | 'schema-not'               // Schema must not match

  // Schema -> Schema relationships (structural)
  | 'schema-property'          // Property references another schema
  | 'schema-additional-props'  // additionalProperties references schema
  | 'schema-array-items'       // Array items reference schema
  | 'schema-tuple-item'        // Tuple item at position references schema

  // Schema -> Schema relationships (polymorphism)
  | 'schema-discriminator';    // Discriminator maps value to schema

/**
 * Reference to a component in the OpenAPI spec.
 */
export interface ComponentRef {
  /**
   * Type of component being referenced.
   * Currently focused on schemas and endpoints per user requirements.
   */
  componentType: 'schema' | 'endpoint';

  /**
   * Name/identifier of the component.
   * For schemas: the schema name (e.g., "User")
   * For endpoints: the endpoint id (e.g., "get-/users/{id}")
   */
  name: string;

  /**
   * Optional JSON pointer path within the component.
   * Used for fine-grained source tracking.
   */
  path?: string;
}

/**
 * Semantic context providing details about why/how the relationship exists.
 * Different fields are relevant for different relationship types.
 */
export interface RelationshipContext {
  /**
   * For schema-property: the property name that creates the relationship.
   * e.g., "address" when User.address references Address schema.
   */
  propertyName?: string;

  /**
   * For endpoint-response: the HTTP status code.
   * e.g., "200", "201", "400"
   */
  statusCode?: string;

  /**
   * For request/response bodies: the media type.
   * e.g., "application/json", "multipart/form-data"
   */
  mediaType?: string;

  /**
   * For endpoint-parameter: the parameter location.
   * e.g., "query", "path", "header", "cookie"
   */
  parameterLocation?: 'query' | 'path' | 'header' | 'cookie';

  /**
   * For endpoint-parameter: the parameter name.
   * e.g., "userId", "page"
   */
  parameterName?: string;

  /**
   * For schema-discriminator: the discriminator property value that maps to the target.
   * e.g., "dog" when discriminator maps "dog" -> Dog schema
   */
  discriminatorValue?: string;

  /**
   * For schema-tuple-item: the position in the tuple (0-indexed).
   */
  tupleIndex?: number;

  /**
   * Whether the reference is in an array context (items or property that is array).
   */
  isArray?: boolean;

  /**
   * Whether the property/parameter is required.
   */
  required?: boolean;
}

/**
 * A relationship between two components in the OpenAPI specification.
 * Captures both the structural connection and semantic meaning.
 */
export interface Relationship {
  /**
   * Unique identifier for this relationship.
   * Format: "{sourceType}-{sourceName}-{targetType}-{targetName}-{type}[-{context}]"
   */
  id: string;

  /**
   * The type of relationship.
   */
  type: RelationshipType;

  /**
   * The source component (the one that references).
   */
  source: ComponentRef;

  /**
   * The target component (the one being referenced).
   */
  target: ComponentRef;

  /**
   * Semantic context providing details about the relationship.
   */
  context: RelationshipContext;

  /**
   * Whether this relationship is part of a circular reference chain.
   * Populated during graph building after cycle detection.
   */
  isCircular: boolean;
}

/**
 * Creates a unique relationship ID from its components.
 */
export function createRelationshipId(
  source: ComponentRef,
  target: ComponentRef,
  type: RelationshipType,
  context: RelationshipContext
): string {
  const baseParts = [
    source.componentType,
    source.name,
    target.componentType,
    target.name,
    type,
  ];

  // Add context-specific suffix for uniqueness
  const contextSuffix: string[] = [];
  if (context.propertyName) contextSuffix.push(`prop:${context.propertyName}`);
  if (context.statusCode) contextSuffix.push(`status:${context.statusCode}`);
  if (context.parameterName) contextSuffix.push(`param:${context.parameterName}`);
  if (context.discriminatorValue) contextSuffix.push(`disc:${context.discriminatorValue}`);
  if (context.tupleIndex !== undefined) contextSuffix.push(`idx:${context.tupleIndex}`);

  const suffix = contextSuffix.length > 0 ? `-${contextSuffix.join('-')}` : '';
  return baseParts.join('-') + suffix;
}

/**
 * Helper to create a relationship object with auto-generated ID.
 */
export function createRelationship(
  type: RelationshipType,
  source: ComponentRef,
  target: ComponentRef,
  context: RelationshipContext = {},
  isCircular = false
): Relationship {
  return {
    id: createRelationshipId(source, target, type, context),
    type,
    source,
    target,
    context,
    isCircular,
  };
}
