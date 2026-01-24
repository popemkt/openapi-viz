import type { Endpoint, HttpMethod, Parameter, RequestBody, Response, Schema } from '@/types';
import { createSourceLocation } from '../lineMapper';
import { extractSchema } from './schemaExtractor';

/**
 * HTTP methods supported by OpenAPI specifications.
 */
export const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

/**
 * Extracts parameters from an OpenAPI operation.
 *
 * @param params - Array of parameter objects from the operation
 * @param endpointContext - Context string for naming inline schemas (e.g., operationId or "GET:/pets")
 * @returns Array of Parameter objects
 */
export function extractParameters(params: unknown[], endpointContext?: string): Parameter[] {
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

/**
 * Extracts a request body from an OpenAPI operation.
 *
 * @param reqBody - The request body object from the operation
 * @param endpointContext - Context string for naming inline schemas
 * @returns RequestBody object or undefined if no request body
 */
export function extractRequestBody(
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

/**
 * Extracts responses from an OpenAPI operation.
 *
 * @param responses - The responses object from the operation
 * @param endpointContext - Context string for naming inline schemas
 * @returns Record mapping status codes to Response objects
 */
export function extractResponses(
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

/**
 * Extracts all endpoints from an OpenAPI paths object.
 *
 * @param paths - The paths object from the OpenAPI spec
 * @param lineMap - Map of JSON paths to line numbers for source location tracking
 * @returns Array of Endpoint objects
 */
export function extractEndpoints(
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
