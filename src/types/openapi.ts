/**
 * OpenAPI type definitions for the visualization editor
 *
 * Supports OpenAPI 3.x specifications with comprehensive coverage of:
 * - Schema composition (allOf, oneOf, anyOf, not)
 * - Polymorphism (discriminator)
 * - Advanced schema features (additionalProperties, prefixItems)
 * - All component types (schemas, responses, parameters, etc.)
 */

import type { Relationship } from './relationships';

/**
 * Supported HTTP methods
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

/**
 * Location in source text for bidirectional sync
 */
export interface SourceLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

/**
 * Schema type enum.
 * In OpenAPI 3.1, type can be an array (e.g., ["string", "null"]).
 */
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/**
 * Discriminator object for polymorphism support.
 * Used with oneOf/anyOf to determine which schema variant applies.
 *
 * @example
 * discriminator:
 *   propertyName: petType
 *   mapping:
 *     dog: '#/components/schemas/Dog'
 *     cat: '#/components/schemas/Cat'
 */
export interface Discriminator {
  /**
   * The property name whose value determines the schema variant.
   * Must be a required property in all schemas.
   */
  propertyName: string;

  /**
   * Optional explicit mapping from property values to schema references.
   * If not provided, values are assumed to match schema names.
   */
  mapping?: Record<string, string>;
}

/**
 * Schema property definition with enhanced support for references and arrays.
 */
export interface SchemaProperty {
  name: string;
  type: SchemaType;
  description?: string;
  required: boolean;
  format?: string;
  enum?: unknown[];
  $ref?: string;
  items?: Schema;

  // Composition within properties
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
}

/**
 * Represents a schema definition from components/schemas.
 * Enhanced with full OpenAPI 3.x schema support.
 */
export interface Schema {
  id: string;
  name: string;
  type: SchemaType;
  description?: string;

  // Object schema features
  properties?: Record<string, SchemaProperty>;
  required?: string[];

  /**
   * Additional properties specification.
   * - undefined/true: allow any additional properties
   * - false: no additional properties allowed
   * - Schema: additional properties must match the schema (Map/Dictionary pattern)
   */
  additionalProperties?: boolean | Schema;

  // Enumeration
  enum?: unknown[];

  // Array features
  items?: Schema;

  /**
   * Tuple type items (OpenAPI 3.1 / JSON Schema 2020-12).
   * Each item in the array defines the schema for that position.
   */
  prefixItems?: Schema[];

  // Composition
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];

  /**
   * Schema that the value must NOT match (negation).
   */
  not?: Schema;

  /**
   * Discriminator for polymorphism with oneOf/anyOf.
   */
  discriminator?: Discriminator;

  // Reference
  $ref?: string;

  // Source tracking
  sourceLocation: SourceLocation;

  /**
   * Whether this schema is defined inline (within an endpoint/property)
   * vs. in components/schemas. Helps with visualization decisions.
   */
  isInline?: boolean;
}

/**
 * Parameter definition
 */
export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  schema?: Schema;
  description?: string;
}

/**
 * Media type definition
 */
export interface MediaType {
  schema?: Schema;
  example?: unknown;
}

/**
 * Request body definition
 */
export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

/**
 * Header definition
 */
export interface Header {
  description?: string;
  schema?: Schema;
}

/**
 * Response definition
 */
export interface Response {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, Header>;
}

/**
 * Represents a single API endpoint
 */
export interface Endpoint {
  id: string;
  path: string;
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  deprecated?: boolean;
  sourceLocation: SourceLocation;
}

/**
 * Tag definition
 */
export interface Tag {
  name: string;
  description?: string;
}

// =============================================================================
// Component Registry Types
// =============================================================================

/**
 * Response component definition (from components/responses).
 */
export interface ResponseDef {
  name: string;
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, Header>;
  sourceLocation: SourceLocation;
}

/**
 * Parameter component definition (from components/parameters).
 */
export interface ParameterDef {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  schema?: Schema;
  description?: string;
  sourceLocation: SourceLocation;
}

/**
 * Request body component definition (from components/requestBodies).
 */
export interface RequestBodyDef {
  name: string;
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
  sourceLocation: SourceLocation;
}

/**
 * Header component definition (from components/headers).
 */
export interface HeaderDef {
  name: string;
  description?: string;
  schema?: Schema;
  sourceLocation: SourceLocation;
}

/**
 * Link component definition (from components/links).
 * Links represent possible API traversal paths (HATEOAS).
 */
export interface LinkDef {
  name: string;
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
  sourceLocation: SourceLocation;
}

/**
 * Callback component definition (from components/callbacks).
 * Callbacks represent webhook/async operation patterns.
 */
export interface CallbackDef {
  name: string;
  /** URL expression -> path item mapping */
  paths: Record<string, unknown>;
  sourceLocation: SourceLocation;
}

/**
 * Registry of all reusable components in the OpenAPI specification.
 * Uses Maps for O(1) lookup by component name.
 */
export interface ComponentRegistry {
  schemas: Map<string, Schema>;
  responses: Map<string, ResponseDef>;
  parameters: Map<string, ParameterDef>;
  requestBodies: Map<string, RequestBodyDef>;
  headers: Map<string, HeaderDef>;
  links: Map<string, LinkDef>;
  callbacks: Map<string, CallbackDef>;
}

/**
 * Creates an empty component registry.
 */
export function createEmptyComponentRegistry(): ComponentRegistry {
  return {
    schemas: new Map(),
    responses: new Map(),
    parameters: new Map(),
    requestBodies: new Map(),
    headers: new Map(),
    links: new Map(),
    callbacks: new Map(),
  };
}

// =============================================================================
// ParsedSpec
// =============================================================================

/**
 * Parsed OpenAPI specification with comprehensive component and relationship support.
 */
export interface ParsedSpec {
  info: {
    title: string;
    version: string;
    description?: string;
  };

  endpoints: Endpoint[];

  /**
   * Schemas array for backward compatibility.
   * This is derived from components.schemas.
   */
  schemas: Schema[];

  tags: Tag[];

  /**
   * Full component registry with all component types.
   */
  components: ComponentRegistry;

  /**
   * Extracted relationships between components.
   * Provides semantic context for how components reference each other.
   */
  relationships: Relationship[];
}
