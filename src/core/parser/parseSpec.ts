import { parse as parseYaml } from 'yaml';
import { validate as validateOpenAPI } from '@readme/openapi-parser';
import type { ParsedSpec } from '@/types';
import type { ParseError, SourceMap } from '@/types';
import { createSourceLocation, buildLineMap, buildSourceMap } from './lineMapper';
import {
  extractEndpoints,
  extractComponents,
  extractSchemas,
  extractTags,
} from './extractors';
import { collectRelationships } from './relationshipCollector';

export interface ParseResult {
  spec: ParsedSpec | null;
  errors: ParseError[];
  sourceMap: SourceMap;
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
