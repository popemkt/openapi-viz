import { describe, it, expect } from 'vitest';
import { parseSpec } from '../src/core/parser/parseSpec';

const validSpec = `
openapi: "3.0.3"
info:
  title: Test API
  version: "1.0.0"
paths:
  /users:
    get:
      operationId: getUsers
      summary: Get all users
      responses:
        "200":
          description: Success
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
`;

describe('parseSpec', () => {
  it('parses valid OpenAPI 3.0 YAML spec', async () => {
    const result = await parseSpec(validSpec);

    expect(result.errors).toHaveLength(0);
    expect(result.spec).toBeDefined();
    expect(result.spec?.info.title).toBe('Test API');
    expect(result.spec?.info.version).toBe('1.0.0');
  });

  it('extracts endpoints from paths', async () => {
    const result = await parseSpec(validSpec);

    expect(result.spec?.endpoints).toHaveLength(1);
    expect(result.spec?.endpoints[0].path).toBe('/users');
    expect(result.spec?.endpoints[0].method).toBe('get');
    expect(result.spec?.endpoints[0].operationId).toBe('getUsers');
  });

  it('extracts schemas from components', async () => {
    const result = await parseSpec(validSpec);

    expect(result.spec?.schemas).toHaveLength(1);
    expect(result.spec?.schemas[0].name).toBe('User');
    expect(result.spec?.schemas[0].type).toBe('object');
  });

  it('returns errors for invalid YAML', async () => {
    const invalidYaml = `
openapi: "3.0.3"
info:
  title: Test
  version: "1.0.0"
paths: [invalid yaml structure
`;

    const result = await parseSpec(invalidYaml);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.spec).toBeNull();
  });

  it('returns errors for non-OpenAPI document', async () => {
    const nonOpenApiYaml = `
title: Not an OpenAPI spec
version: "1.0.0"
`;

    const result = await parseSpec(nonOpenApiYaml);

    expect(result.errors.length).toBeGreaterThan(0);
  });
});
