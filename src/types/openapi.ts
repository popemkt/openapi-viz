/**
 * OpenAPI type definitions for the visualization editor
 */

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
 * Schema type enum
 */
export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/**
 * Schema property definition
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
}

/**
 * Represents a schema definition from components/schemas
 */
export interface Schema {
  id: string;
  name: string;
  type: SchemaType;
  description?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  enum?: unknown[];
  items?: Schema;
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  $ref?: string;
  sourceLocation: SourceLocation;
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

/**
 * Parsed OpenAPI specification
 */
export interface ParsedSpec {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  endpoints: Endpoint[];
  schemas: Schema[];
  tags: Tag[];
}
