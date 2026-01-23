import { configureMonacoYaml } from 'monaco-yaml';
import type { Monaco } from '@monaco-editor/react';

/**
 * Configure monaco-yaml with OpenAPI schema support.
 * This enables:
 * - Schema-based autocomplete for OpenAPI properties
 * - Hover documentation
 * - Validation against OpenAPI 3.x JSON Schema
 * - Go-to-definition for $ref references
 * - YAML anchor navigation
 */
export function setupMonacoYaml(monaco: Monaco): void {
  configureMonacoYaml(monaco, {
    enableSchemaRequest: true,
    hover: true,
    completion: true,
    validate: true,
    format: true,
    schemas: [
      {
        // OpenAPI 3.1 schema
        uri: 'https://spec.openapis.org/oas/3.1/schema-base/2022-10-07',
        fileMatch: ['*'],
      },
      {
        // OpenAPI 3.0 schema (fallback)
        uri: 'https://spec.openapis.org/oas/3.0/schema/2021-09-28',
        fileMatch: ['*'],
      },
    ],
  });
}
