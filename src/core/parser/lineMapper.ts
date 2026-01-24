import type { Endpoint, Schema, SourceLocation, SourceMap } from '@/types';

/**
 * Component section names in OpenAPI components object.
 */
export const COMPONENT_SECTIONS = [
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

export type ComponentSection = (typeof COMPONENT_SECTIONS)[number];

/**
 * Creates a source location object with the given line and column.
 * Default values are line 1, column 1.
 */
export function createSourceLocation(line = 1, column = 1): SourceLocation {
  return {
    startLine: line,
    startColumn: column,
    endLine: line,
    endColumn: column + 10,
  };
}

/**
 * Builds a map from OpenAPI path keys to line numbers.
 * This allows us to track where each element is defined in the source.
 *
 * Supports mapping:
 * - `paths.{path}` - Path definitions
 * - `paths.{path}.{method}` - Method definitions
 * - `components.{section}.{name}` - Component definitions
 *
 * @param text - The raw YAML/JSON text of the OpenAPI spec
 * @returns A map from path keys to line numbers
 */
export function buildLineMap(text: string): Map<string, number> {
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
      if (COMPONENT_SECTIONS.includes(sectionName as ComponentSection)) {
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

/**
 * Builds a bidirectional source map between nodes and their source locations.
 *
 * @param endpoints - Parsed endpoints with source locations
 * @param schemas - Parsed schemas with source locations
 * @returns A SourceMap with node-to-location and line-to-nodes mappings
 */
export function buildSourceMap(endpoints: Endpoint[], schemas: Schema[]): SourceMap {
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
