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

/**
 * Comprehensive spec with all component types for testing
 */
const comprehensiveSpec = `
openapi: "3.0.3"
info:
  title: Comprehensive API
  version: "1.0.0"
paths:
  /pets:
    get:
      operationId: getPets
      summary: Get all pets
      parameters:
        - $ref: '#/components/parameters/LimitParam'
      responses:
        "200":
          $ref: '#/components/responses/PetListResponse'
    post:
      operationId: createPet
      summary: Create a pet
      requestBody:
        $ref: '#/components/requestBodies/PetBody'
      responses:
        "201":
          description: Created
          headers:
            X-Rate-Limit:
              $ref: '#/components/headers/RateLimitHeader'
components:
  schemas:
    Pet:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
        type:
          type: string
      required:
        - id
        - name
    PetList:
      type: array
      items:
        $ref: '#/components/schemas/Pet'
    Error:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
  responses:
    PetListResponse:
      description: A list of pets
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/PetList'
    NotFoundResponse:
      description: Resource not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
  parameters:
    LimitParam:
      name: limit
      in: query
      description: Maximum number of items to return
      required: false
      schema:
        type: integer
        minimum: 1
        maximum: 100
    OffsetParam:
      name: offset
      in: query
      description: Number of items to skip
      required: false
      schema:
        type: integer
        minimum: 0
  requestBodies:
    PetBody:
      description: Pet object to create
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Pet'
  headers:
    RateLimitHeader:
      description: Number of requests remaining
      schema:
        type: integer
    RequestIdHeader:
      description: Unique request identifier
      schema:
        type: string
        format: uuid
  links:
    GetPetById:
      operationId: getPetById
      parameters:
        petId: '$response.body#/id'
      description: Get the pet by its ID
    GetOwner:
      operationRef: '#/paths/~1owners~1{ownerId}/get'
      parameters:
        ownerId: '$response.body#/ownerId'
  callbacks:
    PetStatusWebhook:
      '{$request.body#/callbackUrl}':
        post:
          requestBody:
            content:
              application/json:
                schema:
                  type: object
          responses:
            "200":
              description: Callback received
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

describe('parseSpec - Component Registry', () => {
  it('extracts all schema components into registry', async () => {
    const result = await parseSpec(comprehensiveSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // Check schemas are in registry
    expect(registry.schemas.size).toBe(3);
    expect(registry.schemas.has('Pet')).toBe(true);
    expect(registry.schemas.has('PetList')).toBe(true);
    expect(registry.schemas.has('Error')).toBe(true);

    // Verify schema details
    const petSchema = registry.schemas.get('Pet');
    expect(petSchema?.type).toBe('object');
    expect(petSchema?.properties?.id?.type).toBe('integer');
    expect(petSchema?.properties?.name?.type).toBe('string');
    expect(petSchema?.required).toContain('id');
    expect(petSchema?.required).toContain('name');
  });

  it('extracts response components', async () => {
    const result = await parseSpec(comprehensiveSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // Check responses are in registry
    expect(registry.responses.size).toBe(2);
    expect(registry.responses.has('PetListResponse')).toBe(true);
    expect(registry.responses.has('NotFoundResponse')).toBe(true);

    // Verify response details
    const petListResponse = registry.responses.get('PetListResponse');
    expect(petListResponse?.name).toBe('PetListResponse');
    expect(petListResponse?.description).toBe('A list of pets');
    expect(petListResponse?.content?.['application/json']?.schema?.$ref).toBe(
      '#/components/schemas/PetList'
    );
  });

  it('extracts parameter components', async () => {
    const result = await parseSpec(comprehensiveSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // Check parameters are in registry
    expect(registry.parameters.size).toBe(2);
    expect(registry.parameters.has('LimitParam')).toBe(true);
    expect(registry.parameters.has('OffsetParam')).toBe(true);

    // Verify parameter details
    const limitParam = registry.parameters.get('LimitParam');
    expect(limitParam?.name).toBe('limit');
    expect(limitParam?.in).toBe('query');
    expect(limitParam?.required).toBe(false);
    expect(limitParam?.description).toBe('Maximum number of items to return');
    expect(limitParam?.schema?.type).toBe('integer');
  });

  it('extracts request body components', async () => {
    const result = await parseSpec(comprehensiveSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // Check request bodies are in registry
    expect(registry.requestBodies.size).toBe(1);
    expect(registry.requestBodies.has('PetBody')).toBe(true);

    // Verify request body details
    const petBody = registry.requestBodies.get('PetBody');
    expect(petBody?.name).toBe('PetBody');
    expect(petBody?.description).toBe('Pet object to create');
    expect(petBody?.required).toBe(true);
    expect(petBody?.content?.['application/json']?.schema?.$ref).toBe(
      '#/components/schemas/Pet'
    );
  });

  it('extracts header components', async () => {
    const result = await parseSpec(comprehensiveSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // Check headers are in registry
    expect(registry.headers.size).toBe(2);
    expect(registry.headers.has('RateLimitHeader')).toBe(true);
    expect(registry.headers.has('RequestIdHeader')).toBe(true);

    // Verify header details
    const rateLimitHeader = registry.headers.get('RateLimitHeader');
    expect(rateLimitHeader?.name).toBe('RateLimitHeader');
    expect(rateLimitHeader?.description).toBe('Number of requests remaining');
    expect(rateLimitHeader?.schema?.type).toBe('integer');

    const requestIdHeader = registry.headers.get('RequestIdHeader');
    expect(requestIdHeader?.schema?.type).toBe('string');
  });

  it('extracts link components', async () => {
    const result = await parseSpec(comprehensiveSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // Check links are in registry
    expect(registry.links.size).toBe(2);
    expect(registry.links.has('GetPetById')).toBe(true);
    expect(registry.links.has('GetOwner')).toBe(true);

    // Verify link details
    const getPetById = registry.links.get('GetPetById');
    expect(getPetById?.name).toBe('GetPetById');
    expect(getPetById?.operationId).toBe('getPetById');
    expect(getPetById?.description).toBe('Get the pet by its ID');
    expect(getPetById?.parameters).toEqual({ petId: '$response.body#/id' });

    const getOwner = registry.links.get('GetOwner');
    expect(getOwner?.operationRef).toBe('#/paths/~1owners~1{ownerId}/get');
  });

  it('extracts callback components', async () => {
    const result = await parseSpec(comprehensiveSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // Check callbacks are in registry
    expect(registry.callbacks.size).toBe(1);
    expect(registry.callbacks.has('PetStatusWebhook')).toBe(true);

    // Verify callback details
    const webhook = registry.callbacks.get('PetStatusWebhook');
    expect(webhook?.name).toBe('PetStatusWebhook');
    expect(webhook?.paths).toBeDefined();
    expect(Object.keys(webhook?.paths || {})).toContain('{$request.body#/callbackUrl}');
  });

  it('maintains backward compatibility with schemas array', async () => {
    const result = await parseSpec(comprehensiveSpec);

    expect(result.spec).toBeDefined();

    // Both schemas array and registry should be populated
    expect(result.spec!.schemas).toHaveLength(3);
    expect(result.spec!.components.schemas.size).toBe(3);

    // Schema names should match
    const schemaNames = result.spec!.schemas.map((s) => s.name);
    expect(schemaNames).toContain('Pet');
    expect(schemaNames).toContain('PetList');
    expect(schemaNames).toContain('Error');
  });

  it('handles spec with no components', async () => {
    const minimalSpec = `
openapi: "3.0.3"
info:
  title: Minimal API
  version: "1.0.0"
paths:
  /health:
    get:
      responses:
        "200":
          description: OK
`;

    const result = await parseSpec(minimalSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // All component maps should be empty
    expect(registry.schemas.size).toBe(0);
    expect(registry.responses.size).toBe(0);
    expect(registry.parameters.size).toBe(0);
    expect(registry.requestBodies.size).toBe(0);
    expect(registry.headers.size).toBe(0);
    expect(registry.links.size).toBe(0);
    expect(registry.callbacks.size).toBe(0);
  });

  it('handles spec with only schemas component', async () => {
    const result = await parseSpec(validSpec);

    expect(result.spec).toBeDefined();
    const registry = result.spec!.components;

    // Only schemas should be populated
    expect(registry.schemas.size).toBe(1);
    expect(registry.responses.size).toBe(0);
    expect(registry.parameters.size).toBe(0);
    expect(registry.requestBodies.size).toBe(0);
    expect(registry.headers.size).toBe(0);
    expect(registry.links.size).toBe(0);
    expect(registry.callbacks.size).toBe(0);
  });
});

/**
 * Enhanced schema extraction features spec
 */
const enhancedSchemaSpec = `
openapi: "3.0.3"
info:
  title: Enhanced Schema API
  version: "1.0.0"
paths:
  /pets:
    get:
      operationId: getPets
      responses:
        "200":
          description: Success
components:
  schemas:
    # Discriminator example for polymorphism
    Pet:
      oneOf:
        - $ref: '#/components/schemas/Dog'
        - $ref: '#/components/schemas/Cat'
      discriminator:
        propertyName: petType
        mapping:
          dog: '#/components/schemas/Dog'
          cat: '#/components/schemas/Cat'
    Dog:
      type: object
      required:
        - petType
        - breed
      properties:
        petType:
          type: string
        breed:
          type: string
        barkVolume:
          type: integer
    Cat:
      type: object
      required:
        - petType
        - breed
      properties:
        petType:
          type: string
        breed:
          type: string
        meowFrequency:
          type: integer
    # AdditionalProperties with boolean (false - no additional props)
    StrictObject:
      type: object
      properties:
        id:
          type: string
      additionalProperties: false
    # AdditionalProperties with schema ref (Map/Dictionary pattern)
    StringMap:
      type: object
      additionalProperties:
        type: string
    SchemaMap:
      type: object
      additionalProperties:
        $ref: '#/components/schemas/Dog'
    # Not schema (negation)
    NotNull:
      not:
        type: "null"
    NotEmpty:
      allOf:
        - $ref: '#/components/schemas/Dog'
        - not:
            properties:
              breed:
                const: ""
    # Nested composition in properties
    Order:
      type: object
      properties:
        id:
          type: integer
        shippingAddress:
          oneOf:
            - $ref: '#/components/schemas/USAddress'
            - $ref: '#/components/schemas/CanadianAddress'
        items:
          type: array
          items:
            anyOf:
              - $ref: '#/components/schemas/Dog'
              - $ref: '#/components/schemas/Cat'
    USAddress:
      type: object
      properties:
        state:
          type: string
        zip:
          type: string
    CanadianAddress:
      type: object
      properties:
        province:
          type: string
        postalCode:
          type: string
`;

/**
 * Tuple types spec (OAS 3.1 prefixItems)
 */
const tupleSpec = `
openapi: "3.1.0"
info:
  title: Tuple API
  version: "1.0.0"
paths:
  /coordinates:
    get:
      operationId: getCoordinates
      responses:
        "200":
          description: Success
components:
  schemas:
    # Tuple type: [latitude, longitude, altitude?]
    Coordinate:
      type: array
      prefixItems:
        - type: number
          description: Latitude
        - type: number
          description: Longitude
        - type: number
          description: Altitude (optional)
    # Tuple with refs
    AddressTuple:
      type: array
      prefixItems:
        - type: string
          description: Street
        - type: string
          description: City
        - $ref: '#/components/schemas/ZipCode'
    ZipCode:
      type: string
      pattern: "^[0-9]{5}$"
`;

describe('parseSpec - Enhanced Schema Extraction', () => {
  describe('Discriminator extraction', () => {
    it('extracts discriminator with propertyName', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const petSchema = result.spec!.components.schemas.get('Pet');

      expect(petSchema).toBeDefined();
      expect(petSchema?.discriminator).toBeDefined();
      expect(petSchema?.discriminator?.propertyName).toBe('petType');
    });

    it('extracts discriminator mapping', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const petSchema = result.spec!.components.schemas.get('Pet');

      expect(petSchema?.discriminator?.mapping).toBeDefined();
      expect(petSchema?.discriminator?.mapping).toEqual({
        dog: '#/components/schemas/Dog',
        cat: '#/components/schemas/Cat',
      });
    });

    it('extracts oneOf schemas with discriminator', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const petSchema = result.spec!.components.schemas.get('Pet');

      expect(petSchema?.oneOf).toBeDefined();
      expect(petSchema?.oneOf).toHaveLength(2);
      expect(petSchema?.oneOf?.[0].$ref).toBe('#/components/schemas/Dog');
      expect(petSchema?.oneOf?.[1].$ref).toBe('#/components/schemas/Cat');
    });
  });

  describe('additionalProperties extraction', () => {
    it('extracts additionalProperties: false', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const strictObject = result.spec!.components.schemas.get('StrictObject');

      expect(strictObject).toBeDefined();
      expect(strictObject?.additionalProperties).toBe(false);
    });

    it('extracts additionalProperties with inline schema (string type)', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const stringMap = result.spec!.components.schemas.get('StringMap');

      expect(stringMap).toBeDefined();
      expect(stringMap?.additionalProperties).toBeDefined();
      expect(typeof stringMap?.additionalProperties).toBe('object');
      expect((stringMap?.additionalProperties as { type: string })?.type).toBe('string');
    });

    it('extracts additionalProperties with schema $ref (Map/Dictionary pattern)', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const schemaMap = result.spec!.components.schemas.get('SchemaMap');

      expect(schemaMap).toBeDefined();
      expect(schemaMap?.additionalProperties).toBeDefined();
      expect(typeof schemaMap?.additionalProperties).toBe('object');
      expect((schemaMap?.additionalProperties as { $ref: string }).$ref).toBe(
        '#/components/schemas/Dog'
      );
    });
  });

  describe('not schema extraction', () => {
    it('extracts simple not schema', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const notNull = result.spec!.components.schemas.get('NotNull');

      expect(notNull).toBeDefined();
      expect(notNull?.not).toBeDefined();
      expect(notNull?.not?.type).toBe('null');
    });

    it('extracts not schema within allOf composition', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const notEmpty = result.spec!.components.schemas.get('NotEmpty');

      expect(notEmpty).toBeDefined();
      expect(notEmpty?.allOf).toBeDefined();
      expect(notEmpty?.allOf).toHaveLength(2);

      // First item is a $ref
      expect(notEmpty?.allOf?.[0].$ref).toBe('#/components/schemas/Dog');

      // Second item has a 'not' schema
      expect(notEmpty?.allOf?.[1].not).toBeDefined();
    });
  });

  describe('Nested composition in properties', () => {
    it('extracts oneOf within property (union type)', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const order = result.spec!.components.schemas.get('Order');

      expect(order).toBeDefined();
      expect(order?.properties?.shippingAddress).toBeDefined();

      const shippingAddress = order?.properties?.shippingAddress;
      expect(shippingAddress?.oneOf).toBeDefined();
      expect(shippingAddress?.oneOf).toHaveLength(2);
      expect(shippingAddress?.oneOf?.[0].$ref).toBe('#/components/schemas/USAddress');
      expect(shippingAddress?.oneOf?.[1].$ref).toBe('#/components/schemas/CanadianAddress');
    });

    it('extracts anyOf within array items', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const order = result.spec!.components.schemas.get('Order');

      expect(order).toBeDefined();
      expect(order?.properties?.items).toBeDefined();
      expect(order?.properties?.items?.type).toBe('array');

      const items = order?.properties?.items?.items;
      expect(items).toBeDefined();
      expect(items?.anyOf).toBeDefined();
      expect(items?.anyOf).toHaveLength(2);
      expect(items?.anyOf?.[0].$ref).toBe('#/components/schemas/Dog');
      expect(items?.anyOf?.[1].$ref).toBe('#/components/schemas/Cat');
    });
  });

  describe('prefixItems extraction (tuple types, OAS 3.1)', () => {
    it('extracts prefixItems with inline schemas', async () => {
      const result = await parseSpec(tupleSpec);

      expect(result.spec).toBeDefined();
      const coordinate = result.spec!.components.schemas.get('Coordinate');

      expect(coordinate).toBeDefined();
      expect(coordinate?.type).toBe('array');
      expect(coordinate?.prefixItems).toBeDefined();
      expect(coordinate?.prefixItems).toHaveLength(3);

      // Check each tuple position
      expect(coordinate?.prefixItems?.[0].type).toBe('number');
      expect(coordinate?.prefixItems?.[0].description).toBe('Latitude');

      expect(coordinate?.prefixItems?.[1].type).toBe('number');
      expect(coordinate?.prefixItems?.[1].description).toBe('Longitude');

      expect(coordinate?.prefixItems?.[2].type).toBe('number');
      expect(coordinate?.prefixItems?.[2].description).toBe('Altitude (optional)');
    });

    it('extracts prefixItems with schema $ref', async () => {
      const result = await parseSpec(tupleSpec);

      expect(result.spec).toBeDefined();
      const addressTuple = result.spec!.components.schemas.get('AddressTuple');

      expect(addressTuple).toBeDefined();
      expect(addressTuple?.prefixItems).toBeDefined();
      expect(addressTuple?.prefixItems).toHaveLength(3);

      // First two are inline strings
      expect(addressTuple?.prefixItems?.[0].type).toBe('string');
      expect(addressTuple?.prefixItems?.[1].type).toBe('string');

      // Third is a $ref
      expect(addressTuple?.prefixItems?.[2].$ref).toBe('#/components/schemas/ZipCode');
    });
  });

  describe('Schemas without enhanced features', () => {
    it('does not add discriminator for non-polymorphic schemas', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const dogSchema = result.spec!.components.schemas.get('Dog');

      expect(dogSchema).toBeDefined();
      expect(dogSchema?.discriminator).toBeUndefined();
    });

    it('does not add additionalProperties when not specified', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const dogSchema = result.spec!.components.schemas.get('Dog');

      expect(dogSchema).toBeDefined();
      expect(dogSchema?.additionalProperties).toBeUndefined();
    });

    it('does not add not when not specified', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const dogSchema = result.spec!.components.schemas.get('Dog');

      expect(dogSchema).toBeDefined();
      expect(dogSchema?.not).toBeUndefined();
    });

    it('does not add prefixItems when not specified', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const dogSchema = result.spec!.components.schemas.get('Dog');

      expect(dogSchema).toBeDefined();
      expect(dogSchema?.prefixItems).toBeUndefined();
    });
  });

  describe('Schema ID uniqueness and isInline flag', () => {
    it('generates unique IDs for all schemas including inline ones', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();

      // Collect all schema IDs (including nested ones)
      const allIds = new Set<string>();

      // Check component schemas
      for (const schema of result.spec!.components.schemas.values()) {
        expect(schema.id).toBeDefined();
        expect(schema.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(allIds.has(schema.id)).toBe(false); // Should be unique
        allIds.add(schema.id);
      }

      // IDs should be UUIDs
      expect(allIds.size).toBeGreaterThan(0);
    });

    it('sets isInline=false for schemas in components/schemas', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();

      // All component schemas should have isInline: false
      for (const schema of result.spec!.components.schemas.values()) {
        expect(schema.isInline).toBe(false);
      }
    });

    it('sets isInline=true for nested/inline schemas', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const order = result.spec!.components.schemas.get('Order');

      expect(order).toBeDefined();
      expect(order?.isInline).toBe(false); // Order itself is a component schema

      // Check nested schemas within properties
      const shippingAddress = order?.properties?.shippingAddress;
      expect(shippingAddress?.oneOf).toBeDefined();

      // OneOf schemas within properties should be inline
      for (const oneOfSchema of shippingAddress?.oneOf || []) {
        expect(oneOfSchema.isInline).toBe(true);
      }
    });

    it('generates contextual names for nested schemas', async () => {
      const result = await parseSpec(enhancedSchemaSpec);

      expect(result.spec).toBeDefined();
      const order = result.spec!.components.schemas.get('Order');

      expect(order).toBeDefined();

      // Check that items property has contextual naming
      const itemsProp = order?.properties?.items;
      expect(itemsProp?.items).toBeDefined();
      expect(itemsProp?.items?.name).toContain('items');
    });

    it('generates unique IDs for schemas with same structure in different contexts', async () => {
      // This tests that two inline schemas with the same content get different IDs
      const specWithDuplicateStructures = `
openapi: "3.0.3"
info:
  title: Test API
  version: "1.0.0"
paths:
  /test:
    get:
      responses:
        "200":
          description: Success
components:
  schemas:
    Parent1:
      type: object
      properties:
        items:
          type: array
          items:
            type: string
    Parent2:
      type: object
      properties:
        items:
          type: array
          items:
            type: string
`;

      const result = await parseSpec(specWithDuplicateStructures);
      expect(result.spec).toBeDefined();

      const parent1 = result.spec!.components.schemas.get('Parent1');
      const parent2 = result.spec!.components.schemas.get('Parent2');

      expect(parent1).toBeDefined();
      expect(parent2).toBeDefined();

      // Both have items.items schemas, but they should have different IDs
      const parent1ItemsSchema = parent1?.properties?.items?.items;
      const parent2ItemsSchema = parent2?.properties?.items?.items;

      expect(parent1ItemsSchema).toBeDefined();
      expect(parent2ItemsSchema).toBeDefined();
      expect(parent1ItemsSchema?.id).not.toBe(parent2ItemsSchema?.id);
    });
  });
});

// =============================================================================
// Relationship Collection Tests
// =============================================================================

/**
 * Spec for testing relationship collection with various schema patterns.
 */
const relationshipSpec = `
openapi: "3.0.3"
info:
  title: Relationship Test API
  version: "1.0.0"
paths:
  /users:
    get:
      operationId: getUsers
      summary: Get all users
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            $ref: '#/components/schemas/Pagination'
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
        "404":
          description: Not found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
    post:
      operationId: createUser
      summary: Create a user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
components:
  schemas:
    User:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: integer
        name:
          type: string
        address:
          $ref: '#/components/schemas/Address'
        tags:
          type: array
          items:
            $ref: '#/components/schemas/Tag'
    Address:
      type: object
      properties:
        street:
          type: string
        city:
          type: string
    Tag:
      type: object
      properties:
        name:
          type: string
    CreateUserRequest:
      type: object
      properties:
        name:
          type: string
    Pagination:
      type: object
      properties:
        limit:
          type: integer
        offset:
          type: integer
    Error:
      type: object
      properties:
        code:
          type: integer
        message:
          type: string
`;

/**
 * Spec for testing composition relationships (allOf, oneOf, anyOf).
 */
const compositionRelationshipSpec = `
openapi: "3.0.3"
info:
  title: Composition Relationship Test API
  version: "1.0.0"
paths:
  /pets:
    get:
      operationId: getPets
      responses:
        "200":
          description: Success
components:
  schemas:
    Pet:
      oneOf:
        - $ref: '#/components/schemas/Dog'
        - $ref: '#/components/schemas/Cat'
      discriminator:
        propertyName: petType
        mapping:
          dog: '#/components/schemas/Dog'
          cat: '#/components/schemas/Cat'
    Dog:
      allOf:
        - $ref: '#/components/schemas/Animal'
        - type: object
          properties:
            breed:
              type: string
    Cat:
      allOf:
        - $ref: '#/components/schemas/Animal'
        - type: object
          properties:
            meowVolume:
              type: integer
    Animal:
      type: object
      properties:
        petType:
          type: string
        name:
          type: string
    MixedPet:
      anyOf:
        - $ref: '#/components/schemas/Dog'
        - $ref: '#/components/schemas/Cat'
`;

/**
 * Spec for testing additionalProperties and not schema relationships.
 */
const advancedSchemaRelationshipSpec = `
openapi: "3.0.3"
info:
  title: Advanced Schema Relationship Test API
  version: "1.0.0"
paths:
  /data:
    get:
      operationId: getData
      responses:
        "200":
          description: Success
components:
  schemas:
    StringMap:
      type: object
      additionalProperties:
        type: string
    SchemaMap:
      type: object
      additionalProperties:
        $ref: '#/components/schemas/Config'
    Config:
      type: object
      properties:
        value:
          type: string
    NotNull:
      not:
        $ref: '#/components/schemas/NullType'
    NullType:
      type: "null"
`;

/**
 * Spec for testing allOf combined with inline properties.
 * This pattern is common when extending a schema with additional properties.
 */
const allOfWithPropertiesSpec = `
openapi: "3.0.3"
info:
  title: AllOf with Properties Test API
  version: "1.0.0"
paths:
  /real-estate:
    get:
      operationId: getRealEstate
      responses:
        "200":
          description: Success
components:
  schemas:
    RealEstate:
      type: object
      properties:
        cadastralPlots:
          allOf:
            - $ref: '#/components/schemas/PropertyMetadata'
          properties:
            value:
              type: array
              nullable: true
              items:
                $ref: '#/components/schemas/CadastralPlot'
          description: A collection of cadastral plots
    PropertyMetadata:
      type: object
      properties:
        lastModified:
          type: string
          format: date-time
    CadastralPlot:
      type: object
      properties:
        id:
          type: string
        area:
          type: number
`;

/**
 * Spec for testing tuple (prefixItems) relationships.
 */
const tupleRelationshipSpec = `
openapi: "3.1.0"
info:
  title: Tuple Relationship Test API
  version: "1.0.0"
paths:
  /coordinates:
    get:
      operationId: getCoordinates
      responses:
        "200":
          description: Success
components:
  schemas:
    AddressTuple:
      type: array
      prefixItems:
        - type: string
          description: Street
        - type: string
          description: City
        - $ref: '#/components/schemas/ZipCode'
    ZipCode:
      type: string
      pattern: "^[0-9]{5}$"
`;

/**
 * Spec for testing component-level relationships (responses, parameters, requestBodies, headers).
 */
const componentRelationshipSpec = `
openapi: "3.0.3"
info:
  title: Component Relationship Test API
  version: "1.0.0"
paths:
  /items:
    get:
      operationId: getItems
      parameters:
        - $ref: '#/components/parameters/PageParam'
      responses:
        "200":
          $ref: '#/components/responses/ItemListResponse'
    post:
      operationId: createItem
      requestBody:
        $ref: '#/components/requestBodies/ItemBody'
      responses:
        "201":
          description: Created
          headers:
            X-Request-Id:
              $ref: '#/components/headers/RequestIdHeader'
components:
  schemas:
    Item:
      type: object
      properties:
        id:
          type: integer
        name:
          type: string
    ItemList:
      type: array
      items:
        $ref: '#/components/schemas/Item'
    PageInfo:
      type: object
      properties:
        page:
          type: integer
        total:
          type: integer
  responses:
    ItemListResponse:
      description: A list of items
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ItemList'
  parameters:
    PageParam:
      name: page
      in: query
      required: false
      schema:
        $ref: '#/components/schemas/PageInfo'
  requestBodies:
    ItemBody:
      description: Item to create
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Item'
  headers:
    RequestIdHeader:
      description: Request ID
      schema:
        $ref: '#/components/schemas/Item'
`;

describe('parseSpec - Relationship Collection', () => {
  describe('Schema property relationships', () => {
    it('collects property references between schemas', async () => {
      const result = await parseSpec(relationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // User.address -> Address
      const addressRel = relationships.find(
        (r) =>
          r.type === 'schema-property' &&
          r.source.name === 'User' &&
          r.target.name === 'Address' &&
          r.context.propertyName === 'address'
      );
      expect(addressRel).toBeDefined();
    });

    it('collects array items references with property context', async () => {
      const result = await parseSpec(relationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // User.tags[] -> Tag
      const tagsRel = relationships.find(
        (r) =>
          r.type === 'schema-array-items' &&
          r.source.name === 'User' &&
          r.target.name === 'Tag' &&
          r.context.propertyName === 'tags' &&
          r.context.isArray === true
      );
      expect(tagsRel).toBeDefined();
    });
  });

  describe('Endpoint relationships', () => {
    it('collects endpoint-response relationships with status code', async () => {
      const result = await parseSpec(relationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // GET /users 200 -> User (via array items)
      // Note: The response schema is inline "type: array items: $ref" so we look for the inner relationship
      const errorResponse = relationships.find(
        (r) =>
          r.type === 'endpoint-response' &&
          r.source.name === 'get-/users' &&
          r.target.name === 'Error' &&
          r.context.statusCode === '404'
      );
      expect(errorResponse).toBeDefined();
    });

    it('collects endpoint-request-body relationships', async () => {
      const result = await parseSpec(relationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // POST /users requestBody -> CreateUserRequest
      const requestBodyRel = relationships.find(
        (r) =>
          r.type === 'endpoint-request-body' &&
          r.source.name === 'post-/users' &&
          r.target.name === 'CreateUserRequest' &&
          r.context.mediaType === 'application/json'
      );
      expect(requestBodyRel).toBeDefined();
    });

    it('collects endpoint-parameter relationships with location context', async () => {
      const result = await parseSpec(relationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // GET /users ?limit parameter -> Pagination
      const paramRel = relationships.find(
        (r) =>
          r.type === 'endpoint-parameter' &&
          r.source.name === 'get-/users' &&
          r.target.name === 'Pagination' &&
          r.context.parameterName === 'limit' &&
          r.context.parameterLocation === 'query'
      );
      expect(paramRel).toBeDefined();
    });
  });

  describe('Composition relationships', () => {
    it('collects oneOf relationships', async () => {
      const result = await parseSpec(compositionRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // Pet oneOf -> Dog
      const dogOneOf = relationships.find(
        (r) =>
          r.type === 'schema-oneOf' &&
          r.source.name === 'Pet' &&
          r.target.name === 'Dog'
      );
      expect(dogOneOf).toBeDefined();

      // Pet oneOf -> Cat
      const catOneOf = relationships.find(
        (r) =>
          r.type === 'schema-oneOf' &&
          r.source.name === 'Pet' &&
          r.target.name === 'Cat'
      );
      expect(catOneOf).toBeDefined();
    });

    it('collects allOf relationships', async () => {
      const result = await parseSpec(compositionRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // Dog allOf -> Animal
      const dogAllOf = relationships.find(
        (r) =>
          r.type === 'schema-allOf' &&
          r.source.name === 'Dog' &&
          r.target.name === 'Animal'
      );
      expect(dogAllOf).toBeDefined();

      // Cat allOf -> Animal
      const catAllOf = relationships.find(
        (r) =>
          r.type === 'schema-allOf' &&
          r.source.name === 'Cat' &&
          r.target.name === 'Animal'
      );
      expect(catAllOf).toBeDefined();
    });

    it('collects anyOf relationships', async () => {
      const result = await parseSpec(compositionRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // MixedPet anyOf -> Dog
      const mixedDogAnyOf = relationships.find(
        (r) =>
          r.type === 'schema-anyOf' &&
          r.source.name === 'MixedPet' &&
          r.target.name === 'Dog'
      );
      expect(mixedDogAnyOf).toBeDefined();

      // MixedPet anyOf -> Cat
      const mixedCatAnyOf = relationships.find(
        (r) =>
          r.type === 'schema-anyOf' &&
          r.source.name === 'MixedPet' &&
          r.target.name === 'Cat'
      );
      expect(mixedCatAnyOf).toBeDefined();
    });

    it('collects discriminator mapping relationships', async () => {
      const result = await parseSpec(compositionRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // Pet discriminator dog -> Dog
      const dogDiscriminator = relationships.find(
        (r) =>
          r.type === 'schema-discriminator' &&
          r.source.name === 'Pet' &&
          r.target.name === 'Dog' &&
          r.context.discriminatorValue === 'dog'
      );
      expect(dogDiscriminator).toBeDefined();

      // Pet discriminator cat -> Cat
      const catDiscriminator = relationships.find(
        (r) =>
          r.type === 'schema-discriminator' &&
          r.source.name === 'Pet' &&
          r.target.name === 'Cat' &&
          r.context.discriminatorValue === 'cat'
      );
      expect(catDiscriminator).toBeDefined();
    });
  });

  describe('Advanced schema relationships', () => {
    it('collects additionalProperties schema reference', async () => {
      const result = await parseSpec(advancedSchemaRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // SchemaMap additionalProperties -> Config
      const addPropsRel = relationships.find(
        (r) =>
          r.type === 'schema-additional-props' &&
          r.source.name === 'SchemaMap' &&
          r.target.name === 'Config'
      );
      expect(addPropsRel).toBeDefined();
    });

    it('collects not schema reference', async () => {
      const result = await parseSpec(advancedSchemaRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // NotNull not -> NullType
      const notRel = relationships.find(
        (r) =>
          r.type === 'schema-not' &&
          r.source.name === 'NotNull' &&
          r.target.name === 'NullType'
      );
      expect(notRel).toBeDefined();
    });

    it('collects refs from inline properties alongside allOf (combined schema pattern)', async () => {
      const result = await parseSpec(allOfWithPropertiesSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // RealEstate.cadastralPlots allOf -> PropertyMetadata
      const allOfRel = relationships.find(
        (r) =>
          r.type === 'schema-allOf' &&
          r.source.name === 'RealEstate' &&
          r.target.name === 'PropertyMetadata' &&
          r.context.propertyName === 'cadastralPlots'
      );
      expect(allOfRel).toBeDefined();

      // RealEstate.cadastralPlots.value[] -> CadastralPlot
      // This is the key test - the ref inside the inline properties of an allOf combined schema
      const nestedArrayRel = relationships.find(
        (r) =>
          r.type === 'schema-array-items' &&
          r.source.name === 'RealEstate' &&
          r.target.name === 'CadastralPlot' &&
          r.context.propertyName === 'cadastralPlots.value' &&
          r.context.isArray === true
      );
      expect(nestedArrayRel).toBeDefined();
    });
  });

  describe('Tuple item relationships', () => {
    it('collects tuple item (prefixItems) reference with index', async () => {
      const result = await parseSpec(tupleRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // AddressTuple[2] -> ZipCode
      const tupleRel = relationships.find(
        (r) =>
          r.type === 'schema-tuple-item' &&
          r.source.name === 'AddressTuple' &&
          r.target.name === 'ZipCode' &&
          r.context.tupleIndex === 2
      );
      expect(tupleRel).toBeDefined();
    });
  });

  describe('Component-level relationships', () => {
    it('collects response component schema reference', async () => {
      const result = await parseSpec(componentRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // responses/ItemListResponse -> ItemList
      const responseRel = relationships.find(
        (r) =>
          r.type === 'endpoint-response' &&
          r.source.name === 'response:ItemListResponse' &&
          r.target.name === 'ItemList'
      );
      expect(responseRel).toBeDefined();
    });

    it('collects parameter component schema reference', async () => {
      const result = await parseSpec(componentRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // parameters/PageParam -> PageInfo
      const paramRel = relationships.find(
        (r) =>
          r.type === 'endpoint-parameter' &&
          r.source.name === 'parameter:PageParam' &&
          r.target.name === 'PageInfo' &&
          r.context.parameterLocation === 'query'
      );
      expect(paramRel).toBeDefined();
    });

    it('collects requestBody component schema reference', async () => {
      const result = await parseSpec(componentRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // requestBodies/ItemBody -> Item
      const reqBodyRel = relationships.find(
        (r) =>
          r.type === 'endpoint-request-body' &&
          r.source.name === 'requestBody:ItemBody' &&
          r.target.name === 'Item'
      );
      expect(reqBodyRel).toBeDefined();
    });

    it('collects header component schema reference', async () => {
      const result = await parseSpec(componentRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // headers/RequestIdHeader -> Item
      const headerRel = relationships.find(
        (r) =>
          r.type === 'schema-property' &&
          r.source.name === 'header:RequestIdHeader' &&
          r.target.name === 'Item'
      );
      expect(headerRel).toBeDefined();
    });
  });

  describe('Relationship ID uniqueness', () => {
    it('generates unique IDs for each relationship', async () => {
      const result = await parseSpec(compositionRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      const ids = relationships.map((r) => r.id);
      const uniqueIds = new Set(ids);

      // All IDs should be unique
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('includes context in relationship ID for disambiguation', async () => {
      const result = await parseSpec(compositionRelationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // Find discriminator relationships which should have discriminatorValue in ID
      const discriminatorRels = relationships.filter((r) => r.type === 'schema-discriminator');

      for (const rel of discriminatorRels) {
        expect(rel.id).toContain('disc:');
      }
    });
  });

  describe('Empty/minimal spec handling', () => {
    it('returns empty relationships for spec with no references', async () => {
      const minimalSpec = `
openapi: "3.0.3"
info:
  title: Minimal API
  version: "1.0.0"
paths:
  /health:
    get:
      responses:
        "200":
          description: OK
components:
  schemas:
    Simple:
      type: string
`;

      const result = await parseSpec(minimalSpec);

      expect(result.spec).toBeDefined();
      // Simple string schema has no relationships
      const schemaRelationships = result.spec!.relationships.filter(
        (r) => r.source.name === 'Simple'
      );
      expect(schemaRelationships).toHaveLength(0);
    });

    it('handles spec with no components', async () => {
      const noComponentsSpec = `
openapi: "3.0.3"
info:
  title: No Components API
  version: "1.0.0"
paths:
  /test:
    get:
      responses:
        "200":
          description: OK
`;

      const result = await parseSpec(noComponentsSpec);

      expect(result.spec).toBeDefined();
      expect(result.spec!.relationships).toHaveLength(0);
    });
  });

  describe('Circular reference marking', () => {
    it('initializes isCircular to false for all relationships', async () => {
      const result = await parseSpec(relationshipSpec);

      expect(result.spec).toBeDefined();
      const relationships = result.spec!.relationships;

      // All relationships should have isCircular: false initially
      // (actual circular detection happens in graph building phase)
      for (const rel of relationships) {
        expect(rel.isCircular).toBe(false);
      }
    });
  });
});
