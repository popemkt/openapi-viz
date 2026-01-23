import { parse as parseYaml } from 'yaml';
import { validate as validateOpenAPI } from '@readme/openapi-parser';
import type {
  ParsedSpec,
  Endpoint,
  Schema,
  Tag,
  HttpMethod,
  Parameter,
  RequestBody,
  Response,
  SourceLocation,
  SchemaType,
  SchemaProperty,
  Relationship,
  ComponentRegistry,
  ResponseDef,
  ParameterDef,
  RequestBodyDef,
  HeaderDef,
  LinkDef,
  CallbackDef,
  MediaType,
  Header,
  Discriminator,
} from '@/types';
import type { ParseError, SourceMap } from '@/types';
import { createEmptyComponentRegistry } from '@/types';
import {
  createRelationship,
  type ComponentRef,
  type RelationshipContext,
} from '@/types/relationships';

export interface ParseResult {
  spec: ParsedSpec | null;
  errors: ParseError[];
  sourceMap: SourceMap;
}

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

/**
 * Generates a unique ID for a schema.
 * Uses crypto.randomUUID() to ensure global uniqueness across all schemas,
 * including inline schemas that may have the same display name.
 */
function generateSchemaId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Options for schema extraction to provide context about where the schema is defined.
 */
interface SchemaExtractionOptions {
  /** Whether this schema is defined inline (vs in components/schemas) */
  isInline: boolean;
  /** Parent context for generating descriptive names (e.g., "Order" for "Order.address") */
  parentContext?: string;
}

function createSourceLocation(line = 1, column = 1): SourceLocation {
  return {
    startLine: line,
    startColumn: column,
    endLine: line,
    endColumn: column + 10,
  };
}

function extractSchemaType(schemaObj: Record<string, unknown>): SchemaType {
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
 * Extracts composition schemas (allOf, oneOf, anyOf) from an array of sub-schemas.
 * Each sub-schema is recursively extracted to preserve nested structures.
 *
 * @param composition - The composition array (allOf, oneOf, or anyOf)
 * @param lineNumber - Source line number for location tracking
 * @param compositionType - The type of composition (allOf, oneOf, anyOf)
 * @param parentContext - Parent schema name for contextual naming
 */
function extractCompositionSchemas(
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
 * Extracts the schema name from a $ref string.
 * E.g., "#/components/schemas/Pet" -> "Pet"
 */
function extractRefName(ref: string): string | null {
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
function extractDiscriminator(
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
 * Extracts additionalProperties as either a boolean or a Schema reference.
 * - undefined or true: allow any additional properties
 * - false: no additional properties allowed
 * - Schema object: additional properties must match the schema (Map/Dictionary pattern)
 *
 * @param addProps - The additionalProperties value from the schema
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent schema name for contextual naming
 */
function extractAdditionalProperties(
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
 * Extracts schema properties with full context for nested schemas.
 *
 * @param schemaObj - The schema object containing properties
 * @param requiredFields - List of required field names
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent schema name for contextual naming (e.g., "Order")
 */
function extractSchemaProperties(
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
function extractPrefixItems(
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
function extractSchema(
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

function extractParameters(params: unknown[], endpointContext?: string): Parameter[] {
  if (!Array.isArray(params)) return [];

  return params.map((p) => {
    const param = p as Record<string, unknown>;
    const paramName = param.name as string;
    const schemaName = endpointContext ? `${endpointContext}.param.${paramName}` : `param.${paramName}`;
    return {
      name: paramName,
      in: param.in as 'query' | 'path' | 'header' | 'cookie',
      required: (param.required as boolean) || false,
      description: param.description as string | undefined,
      schema: param.schema
        ? extractSchema(schemaName, param.schema as Record<string, unknown>, 1, { isInline: true })
        : undefined,
    };
  });
}

function extractRequestBody(
  reqBody: Record<string, unknown> | undefined,
  endpointContext?: string
): RequestBody | undefined {
  if (!reqBody) return undefined;

  const content = reqBody.content as Record<string, Record<string, unknown>> | undefined;
  if (!content) return undefined;

  const processedContent: Record<string, { schema?: Schema; example?: unknown }> = {};
  for (const [mediaType, mediaContent] of Object.entries(content)) {
    const schemaName = endpointContext ? `${endpointContext}.requestBody` : 'requestBody';
    processedContent[mediaType] = {
      schema: mediaContent.schema
        ? extractSchema(schemaName, mediaContent.schema as Record<string, unknown>, 1, { isInline: true })
        : undefined,
      example: mediaContent.example,
    };
  }

  return {
    description: reqBody.description as string | undefined,
    required: reqBody.required as boolean | undefined,
    content: processedContent,
  };
}

function extractResponses(
  responses: Record<string, unknown>,
  endpointContext?: string
): Record<string, Response> {
  const result: Record<string, Response> = {};

  for (const [statusCode, response] of Object.entries(responses)) {
    const resp = response as Record<string, unknown>;
    const content = resp.content as Record<string, Record<string, unknown>> | undefined;
    const schemaName = endpointContext ? `${endpointContext}.response.${statusCode}` : `response.${statusCode}`;

    const processedContent: Record<string, { schema?: Schema; example?: unknown }> | undefined = content
      ? Object.fromEntries(
          Object.entries(content).map(([mediaType, mediaContent]) => [
            mediaType,
            {
              schema: mediaContent.schema
                ? extractSchema(schemaName, mediaContent.schema as Record<string, unknown>, 1, { isInline: true })
                : undefined,
              example: mediaContent.example,
            },
          ])
        )
      : undefined;

    result[statusCode] = {
      description: (resp.description as string) || '',
      content: processedContent,
    };
  }

  return result;
}

function extractEndpoints(
  paths: Record<string, Record<string, unknown>>,
  lineMap: Map<string, number>
): Endpoint[] {
  const endpoints: Endpoint[] = [];

  for (const [path, pathItem] of Object.entries(paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const id = `${method}-${path}`;
      const lineNumber = lineMap.get(`paths.${path}.${method}`) || 1;
      // Use operationId or method+path as context for inline schemas
      const endpointContext = (operation.operationId as string) || `${method.toUpperCase()}:${path}`;

      endpoints.push({
        id,
        path,
        method,
        operationId: operation.operationId as string | undefined,
        summary: operation.summary as string | undefined,
        description: operation.description as string | undefined,
        tags: (operation.tags as string[]) || [],
        parameters: extractParameters(operation.parameters as unknown[] || [], endpointContext),
        requestBody: extractRequestBody(operation.requestBody as Record<string, unknown> | undefined, endpointContext),
        responses: extractResponses((operation.responses as Record<string, unknown>) || {}, endpointContext),
        deprecated: operation.deprecated as boolean | undefined,
        sourceLocation: createSourceLocation(lineNumber),
      });
    }
  }

  return endpoints;
}

function extractSchemas(
  components: Record<string, unknown> | undefined,
  lineMap: Map<string, number>
): Schema[] {
  if (!components) return [];

  const schemas = components.schemas as Record<string, Record<string, unknown>> | undefined;
  if (!schemas) return [];

  return Object.entries(schemas).map(([name, schemaObj]) => {
    const lineNumber = lineMap.get(`components.schemas.${name}`) || 1;
    // Schemas defined in components/schemas are NOT inline (they are reusable components)
    return extractSchema(name, schemaObj, lineNumber, { isInline: false });
  });
}

// =============================================================================
// Component Registry Extraction Functions
// =============================================================================

/**
 * Extracts media type content from an OpenAPI content object.
 * Used by responses, request bodies, etc.
 *
 * @param content - The content object mapping media types to their definitions
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent context for naming (e.g., "ResponseName" or "RequestBodyName")
 */
function extractMediaTypeContent(
  content: Record<string, Record<string, unknown>> | undefined,
  lineNumber: number,
  parentContext?: string
): Record<string, MediaType> | undefined {
  if (!content) return undefined;

  const result: Record<string, MediaType> = {};
  for (const [mediaType, mediaContent] of Object.entries(content)) {
    const schemaName = parentContext ? `${parentContext}.content` : 'content';
    result[mediaType] = {
      schema: mediaContent.schema
        ? extractSchema(schemaName, mediaContent.schema as Record<string, unknown>, lineNumber, {
            isInline: true,
            parentContext,
          })
        : undefined,
      example: mediaContent.example,
    };
  }
  return result;
}

/**
 * Extracts headers from an OpenAPI headers object.
 * Used by responses.
 *
 * @param headers - The headers object mapping header names to their definitions
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent context for naming (e.g., "ResponseName")
 */
function extractHeadersObject(
  headers: Record<string, Record<string, unknown>> | undefined,
  lineNumber: number,
  parentContext?: string
): Record<string, Header> | undefined {
  if (!headers) return undefined;

  const result: Record<string, Header> = {};
  for (const [headerName, header] of Object.entries(headers)) {
    const schemaName = parentContext ? `${parentContext}.header.${headerName}` : `header.${headerName}`;
    result[headerName] = {
      description: header.description as string | undefined,
      schema: header.schema
        ? extractSchema(schemaName, header.schema as Record<string, unknown>, lineNumber, {
            isInline: true,
            parentContext,
          })
        : undefined,
    };
  }
  return result;
}

/**
 * Extracts a single response component from components/responses.
 */
function extractResponseComponent(
  name: string,
  responseObj: Record<string, unknown>,
  lineNumber: number
): ResponseDef {
  // Response components are reusable, so use the component name as context
  const componentContext = `responses.${name}`;
  return {
    name,
    description: (responseObj.description as string) || '',
    content: extractMediaTypeContent(
      responseObj.content as Record<string, Record<string, unknown>> | undefined,
      lineNumber,
      componentContext
    ),
    headers: extractHeadersObject(
      responseObj.headers as Record<string, Record<string, unknown>> | undefined,
      lineNumber,
      componentContext
    ),
    sourceLocation: createSourceLocation(lineNumber),
  };
}

/**
 * Extracts a single parameter component from components/parameters.
 */
function extractParameterComponent(
  name: string,
  paramObj: Record<string, unknown>,
  lineNumber: number
): ParameterDef {
  const componentContext = `parameters.${name}`;
  return {
    name: (paramObj.name as string) || name,
    in: paramObj.in as 'query' | 'path' | 'header' | 'cookie',
    required: (paramObj.required as boolean) || false,
    description: paramObj.description as string | undefined,
    schema: paramObj.schema
      ? extractSchema(componentContext, paramObj.schema as Record<string, unknown>, lineNumber, {
          isInline: true,
          parentContext: componentContext,
        })
      : undefined,
    sourceLocation: createSourceLocation(lineNumber),
  };
}

/**
 * Extracts a single request body component from components/requestBodies.
 */
function extractRequestBodyComponent(
  name: string,
  reqBodyObj: Record<string, unknown>,
  lineNumber: number
): RequestBodyDef {
  const componentContext = `requestBodies.${name}`;
  return {
    name,
    description: reqBodyObj.description as string | undefined,
    required: reqBodyObj.required as boolean | undefined,
    content: extractMediaTypeContent(
      reqBodyObj.content as Record<string, Record<string, unknown>> | undefined,
      lineNumber,
      componentContext
    ) || {},
    sourceLocation: createSourceLocation(lineNumber),
  };
}

/**
 * Extracts a single header component from components/headers.
 */
function extractHeaderComponent(
  name: string,
  headerObj: Record<string, unknown>,
  lineNumber: number
): HeaderDef {
  const componentContext = `headers.${name}`;
  return {
    name,
    description: headerObj.description as string | undefined,
    schema: headerObj.schema
      ? extractSchema(componentContext, headerObj.schema as Record<string, unknown>, lineNumber, {
          isInline: true,
          parentContext: componentContext,
        })
      : undefined,
    sourceLocation: createSourceLocation(lineNumber),
  };
}

/**
 * Extracts a single link component from components/links.
 */
function extractLinkComponent(
  name: string,
  linkObj: Record<string, unknown>,
  lineNumber: number
): LinkDef {
  return {
    name,
    operationRef: linkObj.operationRef as string | undefined,
    operationId: linkObj.operationId as string | undefined,
    parameters: linkObj.parameters as Record<string, unknown> | undefined,
    requestBody: linkObj.requestBody,
    description: linkObj.description as string | undefined,
    sourceLocation: createSourceLocation(lineNumber),
  };
}

/**
 * Extracts a single callback component from components/callbacks.
 */
function extractCallbackComponent(
  name: string,
  callbackObj: Record<string, unknown>,
  lineNumber: number
): CallbackDef {
  return {
    name,
    paths: callbackObj as Record<string, unknown>,
    sourceLocation: createSourceLocation(lineNumber),
  };
}

/**
 * Extracts all components from the OpenAPI components object into a ComponentRegistry.
 * This provides O(1) lookup for all component types.
 */
function extractComponents(
  components: Record<string, unknown> | undefined,
  lineMap: Map<string, number>
): ComponentRegistry {
  const registry = createEmptyComponentRegistry();

  if (!components) return registry;

  // Extract schemas (already handled by extractSchemas, populate registry)
  const schemas = components.schemas as Record<string, Record<string, unknown>> | undefined;
  if (schemas) {
    for (const [name, schemaObj] of Object.entries(schemas)) {
      const lineNumber = lineMap.get(`components.schemas.${name}`) || 1;
      // Schemas in components/schemas are NOT inline (they are reusable components)
      registry.schemas.set(name, extractSchema(name, schemaObj, lineNumber, { isInline: false }));
    }
  }

  // Extract responses
  const responses = components.responses as Record<string, Record<string, unknown>> | undefined;
  if (responses) {
    for (const [name, responseObj] of Object.entries(responses)) {
      const lineNumber = lineMap.get(`components.responses.${name}`) || 1;
      registry.responses.set(name, extractResponseComponent(name, responseObj, lineNumber));
    }
  }

  // Extract parameters
  const parameters = components.parameters as Record<string, Record<string, unknown>> | undefined;
  if (parameters) {
    for (const [name, paramObj] of Object.entries(parameters)) {
      const lineNumber = lineMap.get(`components.parameters.${name}`) || 1;
      registry.parameters.set(name, extractParameterComponent(name, paramObj, lineNumber));
    }
  }

  // Extract request bodies
  const requestBodies = components.requestBodies as Record<string, Record<string, unknown>> | undefined;
  if (requestBodies) {
    for (const [name, reqBodyObj] of Object.entries(requestBodies)) {
      const lineNumber = lineMap.get(`components.requestBodies.${name}`) || 1;
      registry.requestBodies.set(name, extractRequestBodyComponent(name, reqBodyObj, lineNumber));
    }
  }

  // Extract headers
  const headers = components.headers as Record<string, Record<string, unknown>> | undefined;
  if (headers) {
    for (const [name, headerObj] of Object.entries(headers)) {
      const lineNumber = lineMap.get(`components.headers.${name}`) || 1;
      registry.headers.set(name, extractHeaderComponent(name, headerObj, lineNumber));
    }
  }

  // Extract links
  const links = components.links as Record<string, Record<string, unknown>> | undefined;
  if (links) {
    for (const [name, linkObj] of Object.entries(links)) {
      const lineNumber = lineMap.get(`components.links.${name}`) || 1;
      registry.links.set(name, extractLinkComponent(name, linkObj, lineNumber));
    }
  }

  // Extract callbacks
  const callbacks = components.callbacks as Record<string, Record<string, unknown>> | undefined;
  if (callbacks) {
    for (const [name, callbackObj] of Object.entries(callbacks)) {
      const lineNumber = lineMap.get(`components.callbacks.${name}`) || 1;
      registry.callbacks.set(name, extractCallbackComponent(name, callbackObj, lineNumber));
    }
  }

  return registry;
}

function extractTags(tags: unknown[] | undefined): Tag[] {
  if (!Array.isArray(tags)) return [];

  return tags.map((t) => {
    const tag = t as Record<string, unknown>;
    return {
      name: tag.name as string,
      description: tag.description as string | undefined,
    };
  });
}

/**
 * Component section names in OpenAPI components object.
 */
const COMPONENT_SECTIONS = [
  'schemas',
  'responses',
  'parameters',
  'requestBodies',
  'headers',
  'links',
  'callbacks',
  'securitySchemes',
  'examples',
  'pathItems',
] as const;

function buildLineMap(text: string): Map<string, number> {
  const lineMap = new Map<string, number>();
  const lines = text.split('\n');

  let currentPath = '';
  let inPaths = false;
  let inComponents = false;
  let currentComponentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNumber = i + 1;
    const indent = line.length - line.trimStart().length;

    // Detect paths section
    if (trimmed === 'paths:') {
      inPaths = true;
      inComponents = false;
      currentComponentSection = '';
      continue;
    }

    // Detect components section
    if (trimmed === 'components:') {
      inPaths = false;
      inComponents = true;
      currentPath = '';
      continue;
    }

    // Exit components section when we hit another top-level key
    if (indent === 0 && trimmed.endsWith(':') && trimmed !== 'components:' && trimmed !== 'paths:') {
      inComponents = false;
      currentComponentSection = '';
    }

    // In paths section, look for path definitions
    if (inPaths && trimmed.startsWith('/') && trimmed.endsWith(':')) {
      currentPath = trimmed.slice(0, -1);
      lineMap.set(`paths.${currentPath}`, lineNumber);
      continue;
    }

    // In paths section, look for methods
    if (inPaths && currentPath) {
      const methodMatch = trimmed.match(/^(get|post|put|delete|patch|options|head):$/);
      if (methodMatch) {
        const currentMethod = methodMatch[1];
        lineMap.set(`paths.${currentPath}.${currentMethod}`, lineNumber);
      }
    }

    // In components section, detect which component sub-section we're in
    if (inComponents && indent === 2) {
      const sectionName = trimmed.slice(0, -1); // Remove trailing ':'
      if (COMPONENT_SECTIONS.includes(sectionName as typeof COMPONENT_SECTIONS[number])) {
        currentComponentSection = sectionName;
        continue;
      }
    }

    // In a component sub-section, look for component names (indent level 4)
    if (inComponents && currentComponentSection && indent === 4) {
      if (trimmed.endsWith(':') && !trimmed.includes(' ')) {
        const componentName = trimmed.slice(0, -1);
        lineMap.set(`components.${currentComponentSection}.${componentName}`, lineNumber);
      }
    }
  }

  return lineMap;
}

function buildSourceMap(endpoints: Endpoint[], schemas: Schema[]): SourceMap {
  const nodeToLocation = new Map<string, SourceLocation>();
  const lineToNodes = new Map<number, string[]>();

  for (const endpoint of endpoints) {
    nodeToLocation.set(endpoint.id, endpoint.sourceLocation);
    const line = endpoint.sourceLocation.startLine;
    const nodes = lineToNodes.get(line) || [];
    nodes.push(endpoint.id);
    lineToNodes.set(line, nodes);
  }

  for (const schema of schemas) {
    nodeToLocation.set(`schema-${schema.id}`, schema.sourceLocation);
    const line = schema.sourceLocation.startLine;
    const nodes = lineToNodes.get(line) || [];
    nodes.push(`schema-${schema.id}`);
    lineToNodes.set(line, nodes);
  }

  return { nodeToLocation, lineToNodes };
}

// =============================================================================
// Relationship Collection Functions
// =============================================================================

/**
 * Creates a ComponentRef for a schema.
 */
function createSchemaRef(schemaName: string, path?: string): ComponentRef {
  return { componentType: 'schema', name: schemaName, path };
}

/**
 * Creates a ComponentRef for an endpoint.
 */
function createEndpointRef(endpointId: string, path?: string): ComponentRef {
  return { componentType: 'endpoint', name: endpointId, path };
}

/**
 * Extracts the schema name from a $ref string.
 * Returns null if the reference is not to a schema component.
 *
 * @example
 * extractSchemaRefName('#/components/schemas/Pet') // 'Pet'
 * extractSchemaRefName('#/components/responses/Error') // null
 */
function extractSchemaRefName(ref: string): string | null {
  const match = ref.match(/#\/components\/schemas\/(.+)/);
  return match ? match[1] : null;
}

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
function collectSchemaRelationships(schema: Schema, relationships: Relationship[]): void {
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
function collectCompositionRelationships(
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

/**
 * Extracts all component schema references from an inline schema.
 * This traverses the schema to find all $refs to component schemas.
 * Used for creating endpoint-to-schema edges when the response/request body
 * is an inline schema (e.g., array of refs, object with ref properties).
 */
function extractComponentSchemaRefs(schema: Schema, refs: Set<string> = new Set()): Set<string> {
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
function collectEndpointRelationships(endpoint: Endpoint, relationships: Relationship[]): void {
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

/**
 * Collects relationships from component definitions (responses, parameters, requestBodies, headers).
 * This tracks how reusable components reference schemas.
 */
function collectComponentRelationships(registry: ComponentRegistry, relationships: Relationship[]): void {
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

/**
 * Master function that collects all relationships from the parsed spec.
 *
 * @param endpoints - Parsed endpoints
 * @param registry - Component registry with all component types
 * @returns Array of all relationships found in the spec
 */
function collectRelationships(
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

export async function parseSpec(text: string): Promise<ParseResult> {
  const errors: ParseError[] = [];
  const lineMap = buildLineMap(text);

  // First try to parse YAML
  let parsed: Record<string, unknown>;
  try {
    parsed = parseYaml(text) as Record<string, unknown>;
  } catch (error) {
    const yamlError = error as Error & { linePos?: { line: number; col: number }[] };
    const location = yamlError.linePos?.[0];
    errors.push({
      message: `YAML Parse Error: ${yamlError.message}`,
      severity: 'error',
      location: location
        ? createSourceLocation(location.line, location.col)
        : undefined,
    });
    return {
      spec: null,
      errors,
      sourceMap: { nodeToLocation: new Map(), lineToNodes: new Map() },
    };
  }

  // Validate against OpenAPI spec
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validationResult = await validateOpenAPI(structuredClone(parsed) as any);
    if (!validationResult.valid) {
      for (const error of validationResult.errors) {
        errors.push({
          message: error.message,
          severity: 'error',
        });
      }
    }
    for (const warning of validationResult.warnings) {
      errors.push({
        message: warning.message,
        severity: 'warning',
      });
    }
  } catch (error) {
    errors.push({
      message: `Validation Error: ${(error as Error).message}`,
      severity: 'error',
    });
  }

  // Even with validation errors, try to extract what we can
  try {
    const info = parsed.info as Record<string, unknown> | undefined;
    const paths = (parsed.paths || {}) as Record<string, Record<string, unknown>>;
    const components = parsed.components as Record<string, unknown> | undefined;
    const tags = parsed.tags as unknown[] | undefined;

    const endpoints = extractEndpoints(paths, lineMap);
    // Extract schemas for backward compatibility (still populate schemas array)
    const schemas = extractSchemas(components, lineMap);
    const sourceMap = buildSourceMap(endpoints, schemas);

    // Extract full component registry (includes all component types)
    const componentRegistry = extractComponents(components, lineMap);

    // Collect all relationships between components
    const relationships = collectRelationships(endpoints, componentRegistry);

    const spec: ParsedSpec = {
      info: {
        title: (info?.title as string) || 'Untitled API',
        version: (info?.version as string) || '1.0.0',
        description: info?.description as string | undefined,
      },
      endpoints,
      schemas,
      tags: extractTags(tags),
      components: componentRegistry,
      relationships,
    };

    return { spec, errors, sourceMap };
  } catch (error) {
    errors.push({
      message: `Parse Error: ${(error as Error).message}`,
      severity: 'error',
    });
    return {
      spec: null,
      errors,
      sourceMap: { nodeToLocation: new Map(), lineToNodes: new Map() },
    };
  }
}
