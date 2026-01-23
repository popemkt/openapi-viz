/**
 * Additional component definition types for OpenAPI components registry
 *
 * Note: Core component types (ResponseDef, ParameterDef, RequestBodyDef,
 * HeaderDef, LinkDef, CallbackDef) are defined in openapi.ts alongside
 * the ComponentRegistry to avoid circular dependencies.
 *
 * This file contains additional/extended types not needed by the core
 * parsing system.
 */

import type { SourceLocation } from './openapi';

/**
 * Path item definition used in callbacks and components/pathItems
 * Represents a reusable path item that can be referenced via $ref
 */
export interface PathItemDef {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  /**
   * Operations defined on this path item, keyed by HTTP method
   */
  operations: Record<string, {
    operationId?: string;
    summary?: string;
    description?: string;
    requestBody?: { $ref?: string } | Record<string, unknown>;
    responses?: Record<string, { $ref?: string } | Record<string, unknown>>;
    parameters?: Array<{ $ref?: string } | Record<string, unknown>>;
  }>;
  parameters?: Array<{ $ref?: string } | Record<string, unknown>>;
  sourceLocation: SourceLocation;
}

/**
 * Security scheme component definition from components/securitySchemes
 * Represents authentication/authorization configuration
 */
export interface SecuritySchemeDef {
  id: string;
  name: string;
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect' | 'mutualTLS';
  description?: string;
  // apiKey specific
  in?: 'query' | 'header' | 'cookie';
  paramName?: string; // 'name' in spec, renamed to avoid confusion
  // http specific
  scheme?: string;
  bearerFormat?: string;
  // oauth2 specific
  flows?: {
    implicit?: OAuthFlowDef;
    password?: OAuthFlowDef;
    clientCredentials?: OAuthFlowDef;
    authorizationCode?: OAuthFlowDef;
  };
  // openIdConnect specific
  openIdConnectUrl?: string;
  sourceLocation: SourceLocation;
}

/**
 * OAuth flow definition for security schemes
 */
export interface OAuthFlowDef {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

/**
 * Example component definition from components/examples
 * Represents a reusable example that can be referenced via $ref
 */
export interface ExampleDef {
  id: string;
  name: string;
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
  sourceLocation: SourceLocation;
}
