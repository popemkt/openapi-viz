import type {
  Schema,
  Tag,
  ComponentRegistry,
  ResponseDef,
  ParameterDef,
  RequestBodyDef,
  HeaderDef,
  LinkDef,
  CallbackDef,
  MediaType,
  Header,
} from '@/types';
import { createEmptyComponentRegistry } from '@/types';
import { createSourceLocation } from '../lineMapper';
import { extractSchema } from './schemaExtractor';

/**
 * Extracts media type content from an OpenAPI content object.
 * Used by responses, request bodies, etc.
 *
 * @param content - The content object mapping media types to their definitions
 * @param lineNumber - Source line number for location tracking
 * @param parentContext - Parent context for naming (e.g., "ResponseName" or "RequestBodyName")
 */
export function extractMediaTypeContent(
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
export function extractHeadersObject(
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
export function extractResponseComponent(
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
export function extractParameterComponent(
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
export function extractRequestBodyComponent(
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
export function extractHeaderComponent(
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
export function extractLinkComponent(
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
export function extractCallbackComponent(
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
export function extractComponents(
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

/**
 * Extracts schemas from the components/schemas section.
 * This is a backward-compatible function that returns schemas as an array.
 */
export function extractSchemas(
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

/**
 * Extracts tags from the OpenAPI tags array.
 */
export function extractTags(tags: unknown[] | undefined): Tag[] {
  if (!Array.isArray(tags)) return [];

  return tags.map((t) => {
    const tag = t as Record<string, unknown>;
    return {
      name: tag.name as string,
      description: tag.description as string | undefined,
    };
  });
}
