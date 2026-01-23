# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Technical Specification

**Difficulty**: Hard - Complex architectural considerations, multiple reference types, polymorphism support

**Summary**: Created comprehensive technical specification in `spec.md` covering:
- Gap analysis of current vs required features
- Enhanced schema model with all OpenAPI 3.x reference types
- Relationship-based architecture for capturing semantic connections
- Component registry for all reusable component types
- Detailed implementation plan with 8 implementation steps

**Key architectural decisions**:
1. Introduce explicit `Relationship` model to capture semantic context
2. Use `ComponentRegistry` with Maps for O(1) lookup
3. Support `discriminator`, `additionalProperties`, and nested composition
4. Enhance edge labels with semantic context (property names, status codes, etc.)

---

### [x] Step 1: Enhanced Type Definitions
<!-- chat-id: 53b132ed-5425-407f-890b-786f17d4ce3a -->

Define the foundational types for the comprehensive schema model.

**Tasks**:
- Create `src/types/components.ts` with component definition types (`ResponseDef`, `ParameterDef`, `RequestBodyDef`, `HeaderDef`, `LinkDef`, `CallbackDef`)
- Create `src/types/relationships.ts` with `Relationship`, `RelationshipType`, `RelationshipContext`, `ComponentRef` types
- Enhance `src/types/openapi.ts`:
  - Add `Discriminator` interface
  - Update `Schema` to support `additionalProperties: boolean | Schema`, `not`, `prefixItems`
  - Add `ComponentRegistry` interface
  - Update `ParsedSpec` to include `components: ComponentRegistry` and `relationships: Relationship[]`
- Enhance `src/types/graph.ts`:
  - Add new `GraphNodeType` values for component types
  - Add new `EdgeType` values (`property`, `additional-props`, `discriminator`, `not`, etc.)
  - Enhance `GraphEdgeData` with `semanticContext`

**Verification**: `pnpm typecheck`

**Completed**: All type definitions have been implemented:
- `src/types/components.ts`: Additional component types (PathItemDef, SecuritySchemeDef, ExampleDef)
- `src/types/relationships.ts`: Relationship model with RelationshipType, ComponentRef, RelationshipContext
- `src/types/openapi.ts`: Enhanced with Discriminator, ComponentRegistry, updated Schema and ParsedSpec
- `src/types/graph.ts`: Enhanced with EdgeSemanticContext, GraphDisplayConfig, new edge types
- `src/constants/colors.ts`: Updated with colors for all new edge types
- Updated parser to populate components and relationships
- Updated graph builder to include new SchemaNodeData properties
- All tests updated and passing typecheck

---

### [x] Step 2: Parser - Component Registry
<!-- chat-id: 017c0fe4-26b8-4012-ba93-a42a2f5c4225 -->

Implement component extraction for all OpenAPI component types.

**Tasks**:
- Add `extractComponents()` function to parse the full components object
- Implement extraction functions:
  - `extractResponseComponent()`
  - `extractParameterComponent()`
  - `extractRequestBodyComponent()`
  - `extractHeaderComponent()`
  - `extractLinkComponent()`
  - `extractCallbackComponent()`
- Update `parseSpec()` to populate `ComponentRegistry`
- Maintain backward compatibility (existing `schemas` array still populated)

**Verification**: `pnpm typecheck && pnpm test`

**Completed**: All component extraction functions implemented in `src/core/parser/parseSpec.ts`:
- Added helper functions: `extractMediaTypeContent()`, `extractHeadersObject()`
- Implemented extraction functions for all component types:
  - `extractResponseComponent()` - extracts responses with content and headers
  - `extractParameterComponent()` - extracts parameters with schemas
  - `extractRequestBodyComponent()` - extracts request bodies with content
  - `extractHeaderComponent()` - extracts headers with schemas
  - `extractLinkComponent()` - extracts links with operationRef/operationId
  - `extractCallbackComponent()` - extracts callbacks with paths
- Created `extractComponents()` master function that populates full `ComponentRegistry`
- Enhanced `buildLineMap()` to detect all component sections (responses, parameters, requestBodies, headers, links, callbacks, securitySchemes, examples, pathItems)
- Updated `parseSpec()` to use `extractComponents()` for full registry
- Maintained backward compatibility: `schemas` array still populated alongside registry
- Added comprehensive tests for all component types (10 new tests)
- All 21 tests passing

---

### [x] Step 3: Parser - Enhanced Schema Extraction
<!-- chat-id: 1445a940-33ab-41db-a33a-b50980860a9c -->

Add support for missing schema features.

**Tasks**:
- Implement `extractDiscriminator()` function
- Update `extractSchema()` to handle:
  - `additionalProperties` as boolean or schema reference
  - `discriminator` object
  - `not` schema
  - `prefixItems` for tuple types (OAS 3.1)
- Handle nested composition schemas (allOf/oneOf/anyOf within properties)
- Update `extractSchemaProperties()` to capture richer property metadata

**Verification**: `pnpm typecheck && pnpm test`

**Completed**: All enhanced schema extraction features implemented in `src/core/parser/parseSpec.ts`:

**Core Feature Functions**:
- Added `extractDiscriminator()` function to extract discriminator with propertyName and mapping
- Added `extractAdditionalProperties()` function to handle boolean or schema ref (Map/Dictionary pattern)
- Added `extractPrefixItems()` function for tuple types (OAS 3.1)
- Updated `extractSchema()` to extract all new features:
  - `additionalProperties` - boolean or Schema for Map/Dictionary pattern
  - `discriminator` - for polymorphism with oneOf/anyOf
  - `not` - negation schema
  - `prefixItems` - tuple type support
- Updated `extractSchemaProperties()` to capture nested composition (allOf/oneOf/anyOf within properties)

**Improvements Based on Review Feedback**:
1. **Schema ID Uniqueness**: Added `generateSchemaId()` using `crypto.randomUUID()` to ensure globally unique IDs for all schemas including inline ones. This prevents ID collisions in the graph visualization.
2. **isInline Flag Implementation**: Added `SchemaExtractionOptions` interface and set `isInline: false` for component schemas, `isInline: true` for all inline/nested schemas (properties, parameters, request/response bodies).
3. **Contextual Naming**: Improved nested schema naming with parent context (e.g., `Order.shippingAddress.items` instead of just `items`). This improves readability and debugging in the parsed model.
4. **Parent Context Propagation**: Updated all extraction functions to pass parent context for better nested schema naming:
   - `extractCompositionSchemas()` - now accepts `compositionType` and `parentContext`
   - `extractSchemaProperties()` - passes property context to nested schemas
   - `extractPrefixItems()` - uses parent context for tuple items
   - `extractParameters()`, `extractRequestBody()`, `extractResponses()` - use endpoint context

**Tests Added** (21 new tests):
- Discriminator extraction (with propertyName and mapping)
- additionalProperties (false, inline schema, schema $ref)
- 'not' schema extraction (simple and within allOf)
- Nested composition in properties (oneOf in property, anyOf in array items)
- prefixItems extraction (inline schemas and $refs)
- Edge cases (schemas without enhanced features)
- Schema ID uniqueness (UUID format, globally unique)
- isInline flag (false for components, true for inline schemas)
- Contextual naming verification
- Duplicate structure handling (same schema structure in different contexts get different IDs)

- All 42 tests passing

---

### [x] Step 4: Parser - Relationship Collection
<!-- chat-id: 2e904d8b-5742-4803-87d5-f9beceb87df9 -->

Implement the relationship extraction system.

**Tasks**:
- Create `collectRelationships()` master function
- Implement `collectEndpointRelationships()`:
  - Request body → schema
  - Response → schema (with status code context)
  - Parameter → schema (with location context)
- Implement `collectSchemaRelationships()`:
  - Property → schema (with property name)
  - additionalProperties → schema
  - allOf/oneOf/anyOf → schemas
  - items → schema (array context)
  - discriminator mapping → schemas
- Implement `collectComponentRelationships()`:
  - Response components → schemas
  - Parameter components → schemas
  - Header components → schemas
- Update `parseSpec()` to return `relationships[]`

**Verification**: `pnpm typecheck && pnpm test`

**Completed**: All relationship collection functions implemented in `src/core/parser/parseSpec.ts`:

**Core Functions**:
- `createSchemaRef()` / `createEndpointRef()` - Helper functions to create ComponentRef objects
- `extractSchemaRefName()` - Extracts schema name from $ref string (e.g., '#/components/schemas/Pet' → 'Pet')
- `collectSchemaRelationships()` - Collects all relationships from a schema:
  - Property references (`schema-property`)
  - Array items in properties (`schema-array-items`)
  - Nested composition in properties (`schema-oneOf`, `schema-anyOf`, `schema-allOf`)
  - additionalProperties references (`schema-additional-props`)
  - Top-level array items (`schema-array-items`)
  - Tuple items / prefixItems (`schema-tuple-item`)
  - Composition types (`schema-allOf`, `schema-oneOf`, `schema-anyOf`)
  - Not schema (`schema-not`)
  - Discriminator mappings (`schema-discriminator`)
- `collectCompositionRelationships()` - Helper for collecting composition relationships with optional property context
- `collectEndpointRelationships()` - Collects endpoint-to-schema relationships:
  - Request body → schema (`endpoint-request-body`)
  - Response → schema (`endpoint-response`) with status code context
  - Parameter → schema (`endpoint-parameter`) with location context
- `collectComponentRelationships()` - Collects relationships from component definitions:
  - Response components → schemas
  - Parameter components → schemas
  - Request body components → schemas
  - Header components → schemas
- `collectRelationships()` - Master function that orchestrates all relationship collection

**Key Features**:
1. **Rich Context**: Each relationship includes semantic context (property name, status code, media type, parameter location, discriminator value, tuple index, etc.)
2. **Unique IDs**: Relationships have unique IDs generated from source, target, type, and context
3. **Recursive Collection**: Inline schemas are recursively traversed to collect nested relationships
4. **Component-Level Relationships**: Tracks relationships from reusable components (responses, parameters, requestBodies, headers)

**Tests Added** (15 new tests):
- Schema property relationships (direct $ref, array items with property context)
- Endpoint relationships (response with status code, request body, parameter with location)
- Composition relationships (oneOf, allOf, anyOf)
- Discriminator mapping relationships
- Advanced schema relationships (additionalProperties, not schema)
- Tuple item relationships with index
- Component-level relationships (response, parameter, requestBody, header components)
- Relationship ID uniqueness
- Empty/minimal spec handling
- Circular reference marking initialization

**Verification**: All 63 tests passing (57 parser + 6 graph builder)

---

### [x] Step 5: Constants & Edge Configuration
<!-- chat-id: 9473a345-df7e-43ac-b5ec-05186025ecd9 -->

Add configuration for new edge types.

**Tasks**:
- Update `src/constants/colors.ts`:
  - Add colors for `property`, `additional-props`, `discriminator`, `not`, `tuple-item`
- Create `src/constants/edgeTypes.ts`:
  - Define edge type metadata (color, label template, dashed, animated)
  - Define semantic label generators
- Update `src/constants/index.ts` exports

**Verification**: `pnpm typecheck`

**Completed**: Created comprehensive edge type configuration in `src/constants/edgeTypes.ts`:

**EdgeTypeConfig Interface**:
- `color`: Hex color for the edge
- `dashed`: Whether edge should be dashed (used for optional/alternative relationships)
- `animated`: Whether edge should be animated (used for circular references)
- `conciseLabelTemplate`: Template for compact label display (e.g., `.{propertyName}`)
- `verboseLabelTemplate`: Template for detailed label display (e.g., `property: {propertyName}{requiredSuffix}`)
- `markerEnd`: Arrow style configuration
- `strokeWidth`: Edge thickness
- `description`: Human-readable description for UI/tooltips

**Key Features**:
1. **EDGE_TYPE_CONFIG**: Complete configuration for all 13 edge types with styling and labels
2. **RELATIONSHIP_TO_EDGE_TYPE**: Maps parser relationship types to visualization edge types
3. **generateSemanticLabels()**: Generates both concise and verbose labels from context
4. **createSemanticEdgeLabel()**: Creates display labels with mode selection
5. **relationshipContextToEdgeContext()**: Converts parser context to graph context
6. **Helper functions**: `isCompositionEdge()`, `isStructuralEdge()`, `isEndpointEdge()` for categorization
7. **EDGE_CATEGORIES**: Grouped edge types for UI filtering (endpoint, composition, structural, polymorphism, special)
8. **EDGE_CATEGORY_LABELS**: Human-readable names for categories

**Styling Decisions**:
- Composition edges (allOf, oneOf, anyOf): Distinct colors, oneOf/anyOf are dashed to indicate alternatives
- Structural edges (property, array-items): Standard styling, array-items has thicker stroke
- Endpoint edges: Solid lines with distinct colors for request/response/parameter
- Circular edges: Red, dashed, animated for visibility

**Verification**: `pnpm typecheck` passed

---

### [x] Step 6: Graph Builder - Relationship-Based Edges
<!-- chat-id: 33e3a01c-04c8-47c1-b444-32b6dc8ff28a -->

Rewrite graph builder to use relationship model.

**Tasks**:
- Update `buildGraph()` to accept relationships
- Create `relationshipsToEdges()` function:
  - Map relationship types to edge types
  - Apply semantic context to labels
  - Handle circular marking
- Update `detectCircularEdges()` to work with relationships (not just schema refs)
- Implement `createSemanticEdgeLabel()` for human-readable labels:
  - "property: address" for schema-property
  - "oneOf: Dog" for discriminator values
  - "items[]" for array items
  - "200 response" for response edges
- Maintain backward compatibility with existing edge types

**Verification**: `pnpm typecheck && pnpm test`

**Completed**: Rewrote graph builder in `src/core/graph-builder/buildGraph.ts` to use relationship model:

**Core Functions Implemented**:
1. `detectCircularRelationships()` - Uses Tarjan's algorithm to find SCCs in the relationship graph, returning a set of circular relationship IDs
2. `getEdgeTypeForRelationship()` - Maps relationship types to edge types, with circular override
3. `relationshipsToEdges()` - Converts relationships to graph edges with:
   - Semantic label generation using `createSemanticEdgeLabel()` from edgeTypes.ts
   - Proper edge styling (color, dashed, animated) from `getEdgeConfig()`
   - Both concise and verbose labels stored in edge data
   - Full semantic context preserved in `semanticContext` field
4. `calculateRefCounts()` - Calculates incoming/outgoing reference counts for schema nodes

**Key Features**:
- **Dual-mode support**: Uses relationship-based edges when `spec.relationships` is populated, falls back to legacy extraction otherwise
- **Rich semantic labels**:
  - Property edges: `.homeAddress` (concise) / `property: homeAddress (required)` (verbose)
  - Response edges: `200` (concise) / `200 response (application/json)` (verbose)
  - Discriminator edges: `=dog` (concise) / `discriminator: dog` (verbose)
- **Circular detection**: Works with relationships across different types (allOf, property, oneOf can all form cycles)
- **Node enrichment**: Schema nodes now include `discriminatorValues` from relationship analysis, plus `incomingRefCount` and `outgoingRefCount`
- **Edge deduplication**: Identical relationships (same source, target, type, and context) are deduplicated
- **Invalid reference filtering**: Relationships to non-existent schemas/endpoints are skipped

**Tests Added** (25 new tests):
- Schema-to-Schema edges (property, array-items, allOf, oneOf, anyOf, discriminator, additional-props, not, tuple-item)
- Endpoint-to-Schema edges (request body, response with status code, parameter with location)
- Circular reference detection (self-referencing, two-level, three-level, cross-type cycles)
- Node data enrichment (discriminatorValues, reference counts, hasDiscriminator, compositionType)
- Edge deduplication (same context vs different context)
- Invalid reference filtering

**Verification**: All 88 tests passing (31 graph builder + 57 parser), typecheck passes

---

### [x] Step 7: UI Updates
<!-- chat-id: b6e45115-9255-47e0-8ba8-a614998c140d -->

Update visualization components for new features.

**Tasks**:
- Update `src/features/graph/components/SchemaNode.tsx`:
  - Add discriminator badge/indicator
  - Show composition type indicator (allOf/oneOf/anyOf)
- Update `src/features/detail-panel/components/SchemaDetail.tsx`:
  - Show discriminator configuration
  - Show additionalProperties type
  - Show incoming/outgoing relationships
- Update `src/constants/colors.ts` with any missing edge colors
- Update FilterToolbar if needed for new component types

**Verification**: `pnpm typecheck && pnpm dev` (manual testing)

**Completed**: Updated UI components for enhanced visualization:

**SchemaNode.tsx Updates**:
- Added discriminator badge with tooltip showing the propertyName and mappings
- Added discriminator values badge for schemas that are targets of discriminator mappings (shows `= dog | cat`)
- Enhanced composition type indicators to use pre-computed `compositionType` from node data
- Added `additionalProperties` badge showing "closed" or "map" pattern
- Added `prefixItems` (tuple) badge with position count
- Added reference count indicators (`←3 →2`) with tooltip explaining incoming/outgoing counts
- Uses `hasDiscriminator`, `discriminatorValues`, `compositionType`, `incomingRefCount`, `outgoingRefCount` from SchemaNodeData

**SchemaDetail.tsx Updates**:
- Added relationship props: `incomingRelationships` and `outgoingRelationships`
- Added `RelationshipBadge` component to display relationships with context
- Added discriminator section with propertyName and mapping visualization
- Added additionalProperties section showing "Not allowed", "Any type allowed", or "Map/Dictionary" with value type
- Added prefixItems (tuple structure) section with positional schema display
- Added `not` schema section with red styling
- Added "Referenced By" section showing all incoming relationships with context
- Added "References" section showing all outgoing relationships with context
- Added reference count stats in the header

**DetailPanel.tsx Updates**:
- Computes `incomingRelationships` and `outgoingRelationships` using `useMemo` from `parsedSpec.relationships`
- Passes relationships to SchemaDetail component

**FilterToolbar**: No changes needed - current implementation already handles endpoint/schema filtering; new component types are used for relationship extraction, not as separate visualization nodes.

**colors.ts**: Verified all edge colors are present for all edge types

**Verification**: All 88 tests passing, typecheck passes

---

### [x] Step 8: Testing & Documentation
<!-- chat-id: da166f39-762a-43a6-8b5b-9f8c668ec84f -->

Add comprehensive tests for new functionality.

**Tasks**:
- Add tests to `tests/parser.test.ts`:
  - Discriminator extraction
  - additionalProperties with schema ref
  - Nested composition schemas
  - All component types extraction
- Add tests to `tests/graphBuilder.test.ts`:
  - Discriminator edges
  - additionalProperties edges
  - Relationship-based edge generation
  - Circular detection with new relationship types
- Run full verification: `pnpm verify`
- Create sample OpenAPI spec demonstrating all features

**Verification**: `pnpm verify` (lint + typecheck + test)

**Completed**: All testing and documentation tasks completed:

**Test Coverage** (88 tests total):
- **Parser tests** (57 tests in `tests/parser.test.ts`):
  - Basic parsing (5 tests)
  - Component Registry extraction (10 tests): responses, parameters, requestBodies, headers, links, callbacks
  - Enhanced Schema Extraction (21 tests): discriminator, additionalProperties, not schema, nested composition, prefixItems/tuples, schema ID uniqueness, isInline flag, contextual naming
  - Relationship Collection (21 tests): schema property relationships, endpoint relationships, composition relationships, discriminator mappings, advanced schema relationships, tuple items, component-level relationships, relationship ID uniqueness, edge cases

- **Graph Builder tests** (31 tests in `tests/graphBuilder.test.ts`):
  - Legacy mode (6 tests): circular detection at various levels, diamond dependencies
  - Relationship-Based Mode (25 tests):
    - Schema-to-Schema edges (9 tests): property, array-items, allOf, oneOf, anyOf, discriminator, additional-props, not, tuple-item
    - Endpoint-to-Schema edges (3 tests): request body, response with status code, parameter with location
    - Circular reference detection (5 tests): self-referencing, two-level, three-level, cross-type cycles, endpoint isolation
    - Node data enrichment (4 tests): discriminatorValues, reference counts, hasDiscriminator, compositionType
    - Edge handling (4 tests): deduplication, invalid reference filtering

**Sample OpenAPI Spec** created at `public/samples/comprehensive-demo.yaml`:
- Demonstrates all relationship types:
  - Polymorphism with `discriminator` (Pet → Dog/Cat/Bird)
  - Composition (`allOf`, `oneOf`, `anyOf`)
  - `additionalProperties` with schema refs (Map/Dictionary pattern)
  - Tuple types (`prefixItems`)
  - Negation schemas (`not`)
  - Nested composition in properties
  - Circular references (User → User self-reference, User ↔ Team mutual reference)
  - All component types (responses, parameters, requestBodies, headers, links, callbacks)

**Lint Fixes Applied**:
- Fixed `crypto` → `globalThis.crypto` for eslint no-undef rule
- Fixed useMemo dependency in DetailPanel.tsx for React Compiler compatibility

**Full Verification**: `pnpm verify` passes (lint + typecheck + test)

---

### [x] Step: Final Report
<!-- chat-id: acc23163-0c31-4ac1-8eee-7ae39914632d -->

Write completion report to `{@artifacts_path}/report.md`:
- Summary of implemented features
- How the solution was tested
- Known limitations or future improvements
- Sample specs for testing

**Completed**: Created comprehensive report at `.zenflow/tasks/revise-comprehensive-graph-and-p-405d/report.md` covering:
- Summary of all implemented features (relationship model, component registry, edge types, UI updates)
- Complete test coverage breakdown (88 tests: 57 parser + 31 graph builder)
- Sample specification documentation (`public/samples/comprehensive-demo.yaml`)
- Architecture decisions with rationale
- Known limitations (external $ref, JSON Schema $id/$anchor, security schemes, webhooks)
- Future improvement suggestions
- Complete list of modified/created files

### [x] Step: Fix graph display
<!-- chat-id: 1d5ba878-0706-4d83-9453-3d439ccf325a -->
<!-- agent: claude-code -->

It looks like the models works nicely since the panel shows all the references.

But, i don't think it's loaded correctly to the graph. No connections are made. Double check.

**Completed**: Fixed the graph display issue where no connections were showing.

**Root Cause**: Schema ID vs Name mismatch in `buildGraph.ts`:
- The `schemaMap` was keyed by `schema.id` (a UUID), but relationships reference schemas by `schema.name`
- The `relationshipsToEdges()` function checked `schemaMap.has(rel.source.name)` against a map keyed by UUIDs
- This caused all relationship-to-edge conversions to be skipped

**Fixes Applied** (in `src/core/graph-builder/buildGraph.ts`):
1. Changed `schemaMap` to use `schema.name` as key instead of `schema.id` (line 621)
2. Changed `calculateRefCounts()` to initialize counts by `schema.name` (line 578)
3. Fixed discriminator value matching to compare `rel.target.name === schema.name` (line 692)
4. Fixed ref counts lookup to use `schema.name` (line 700)
5. Fixed node ID generation to use `schema.name` for consistency (line 714)
6. Fixed legacy mode `buildLegacySchemaEdges()` to use `schema.name` (lines 430, 436, 437)

**Verification**:
- All 88 tests passing
- TypeScript check passes
- Manual testing confirms edges are now displayed correctly in the graph
- Detail panel shows correct relationship information

---

**Additional Fix**: Endpoint-to-schema edges for inline schemas with nested refs

**Problem**: Endpoints with inline response/request body schemas (e.g., `type: array` with `items.$ref`) were not creating direct endpoint-to-schema edges. Only schema-to-schema relationships from the inline schema were created, but since inline schemas aren't shown as graph nodes, the edges were filtered out.

**Example**: `GET /users` returns `type: array, items: { $ref: '#/components/schemas/User' }`. Previously, no edge was drawn from the endpoint to `User` because:
1. The parser created a `schema-array-items` relationship from `listUsers.response.200` (inline) to `User`
2. The graph builder filtered it out because `listUsers.response.200` isn't in the component schemas

**Solution** (in `src/core/parser/parseSpec.ts`):
1. Added `extractComponentSchemaRefs()` helper function to recursively extract all component schema references from an inline schema (handles arrays, properties, composition, additionalProperties, tuples)
2. Updated `collectEndpointRelationships()` to create `endpoint-response`, `endpoint-request-body`, and `endpoint-parameter` relationships for ALL component schemas referenced within inline schemas
3. The `isArray` flag is added to the context to indicate array responses

**Result**:
- `GET /users` now shows an edge to `User` with label "200" (for the inline array response)
- All endpoint-to-schema connections are now properly visualized regardless of whether the schema is direct `$ref` or nested within inline structures
