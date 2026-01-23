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
} from '@/types';
import type { ParseError, SourceMap } from '@/types';

export interface ParseResult {
  spec: ParsedSpec | null;
  errors: ParseError[];
  sourceMap: SourceMap;
}

const HTTP_METHODS: HttpMethod[] = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'];

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
 */
function extractCompositionSchemas(
  composition: unknown,
  lineNumber: number
): Schema[] | undefined {
  if (!Array.isArray(composition) || composition.length === 0) {
    return undefined;
  }

  return composition.map((subSchema, index) => {
    const schemaObj = subSchema as Record<string, unknown>;
    // Generate a unique name for inline composed schemas
    const name = schemaObj.$ref
      ? extractRefName(schemaObj.$ref as string) || `composed-${index}`
      : `composed-${index}`;
    return extractSchema(name, schemaObj, lineNumber);
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

function extractSchemaProperties(
  schemaObj: Record<string, unknown>,
  requiredFields: string[] = [],
  lineNumber: number = 1
): Record<string, SchemaProperty> | undefined {
  const properties = schemaObj.properties as Record<string, Record<string, unknown>> | undefined;
  if (!properties) return undefined;

  const result: Record<string, SchemaProperty> = {};
  for (const [name, prop] of Object.entries(properties)) {
    result[name] = {
      name,
      type: extractSchemaType(prop),
      description: prop.description as string | undefined,
      required: requiredFields.includes(name),
      format: prop.format as string | undefined,
      enum: prop.enum as unknown[] | undefined,
      $ref: prop.$ref as string | undefined,
      // Handle array items in properties
      items: prop.items
        ? extractSchema('items', prop.items as Record<string, unknown>, lineNumber)
        : undefined,
    };
  }
  return result;
}

function extractSchema(
  name: string,
  schemaObj: Record<string, unknown>,
  lineNumber: number
): Schema {
  const requiredFields = (schemaObj.required as string[]) || [];

  return {
    id: name,
    name,
    type: extractSchemaType(schemaObj),
    description: schemaObj.description as string | undefined,
    properties: extractSchemaProperties(schemaObj, requiredFields, lineNumber),
    required: requiredFields,
    enum: schemaObj.enum as unknown[] | undefined,
    $ref: schemaObj.$ref as string | undefined,
    // Composition types
    allOf: extractCompositionSchemas(schemaObj.allOf, lineNumber),
    oneOf: extractCompositionSchemas(schemaObj.oneOf, lineNumber),
    anyOf: extractCompositionSchemas(schemaObj.anyOf, lineNumber),
    // Array items
    items: schemaObj.items
      ? extractSchema('items', schemaObj.items as Record<string, unknown>, lineNumber)
      : undefined,
    sourceLocation: createSourceLocation(lineNumber),
  };
}

function extractParameters(params: unknown[]): Parameter[] {
  if (!Array.isArray(params)) return [];

  return params.map((p) => {
    const param = p as Record<string, unknown>;
    return {
      name: param.name as string,
      in: param.in as 'query' | 'path' | 'header' | 'cookie',
      required: (param.required as boolean) || false,
      description: param.description as string | undefined,
      schema: param.schema ? extractSchema('param', param.schema as Record<string, unknown>, 1) : undefined,
    };
  });
}

function extractRequestBody(reqBody: Record<string, unknown> | undefined): RequestBody | undefined {
  if (!reqBody) return undefined;

  const content = reqBody.content as Record<string, Record<string, unknown>> | undefined;
  if (!content) return undefined;

  const processedContent: Record<string, { schema?: Schema; example?: unknown }> = {};
  for (const [mediaType, mediaContent] of Object.entries(content)) {
    processedContent[mediaType] = {
      schema: mediaContent.schema
        ? extractSchema('requestBody', mediaContent.schema as Record<string, unknown>, 1)
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

function extractResponses(responses: Record<string, unknown>): Record<string, Response> {
  const result: Record<string, Response> = {};

  for (const [statusCode, response] of Object.entries(responses)) {
    const resp = response as Record<string, unknown>;
    const content = resp.content as Record<string, Record<string, unknown>> | undefined;

    const processedContent: Record<string, { schema?: Schema; example?: unknown }> | undefined = content
      ? Object.fromEntries(
          Object.entries(content).map(([mediaType, mediaContent]) => [
            mediaType,
            {
              schema: mediaContent.schema
                ? extractSchema('response', mediaContent.schema as Record<string, unknown>, 1)
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

      endpoints.push({
        id,
        path,
        method,
        operationId: operation.operationId as string | undefined,
        summary: operation.summary as string | undefined,
        description: operation.description as string | undefined,
        tags: (operation.tags as string[]) || [],
        parameters: extractParameters(operation.parameters as unknown[] || []),
        requestBody: extractRequestBody(operation.requestBody as Record<string, unknown> | undefined),
        responses: extractResponses((operation.responses as Record<string, unknown>) || {}),
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
    return extractSchema(name, schemaObj, lineNumber);
  });
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

function buildLineMap(text: string): Map<string, number> {
  const lineMap = new Map<string, number>();
  const lines = text.split('\n');

  let currentPath = '';
  let currentMethod = '';
  let currentSchema = '';
  let inPaths = false;
  let inSchemas = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const lineNumber = i + 1;

    // Detect paths section
    if (trimmed === 'paths:') {
      inPaths = true;
      inSchemas = false;
      continue;
    }

    // Detect components/schemas section
    if (trimmed === 'schemas:' && lines[i - 1]?.trim() === 'components:') {
      inPaths = false;
      inSchemas = true;
      continue;
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
        currentMethod = methodMatch[1];
        lineMap.set(`paths.${currentPath}.${currentMethod}`, lineNumber);
      }
    }

    // In schemas section, look for schema names
    if (inSchemas) {
      const indent = line.length - line.trimStart().length;
      if (indent === 4 && trimmed.endsWith(':') && !trimmed.includes(' ')) {
        currentSchema = trimmed.slice(0, -1);
        lineMap.set(`components.schemas.${currentSchema}`, lineNumber);
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
    const schemas = extractSchemas(components, lineMap);
    const sourceMap = buildSourceMap(endpoints, schemas);

    const spec: ParsedSpec = {
      info: {
        title: (info?.title as string) || 'Untitled API',
        version: (info?.version as string) || '1.0.0',
        description: info?.description as string | undefined,
      },
      endpoints,
      schemas,
      tags: extractTags(tags),
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
