# Technical Specification: Comprehensive OpenAPI Schema Model & Graph Algorithm

## 1. Overview

**Task**: Revise and enhance the schema model and parsing algorithm to comprehensively handle all OpenAPI 3.x reference mechanisms, creating a robust foundation for visualizing and authoring OpenAPI specifications.

**Difficulty**: Hard
- Complex architectural decisions (multiple reference types, polymorphism, composition)
- Many edge cases to handle (circular refs, discriminators, nested structures)
- Significant impact on visualization accuracy

**Goals**:
1. Build a comprehensive internal model that captures ALL OpenAPI reference/relationship types
2. Create a robust parsing algorithm that extracts relationships at all levels
3. Design a clean, extensible architecture that will help users understand their specs

---

## 2. Technical Context

**Language**: TypeScript 5.9.3
**Framework**: React 19 + Vite 7
**Key Dependencies**:
- `@readme/openapi-parser` - OpenAPI validation
- `yaml` - YAML parsing
- `@xyflow/react` - Graph visualization
- `dagre` - Hierarchical layout algorithm
- `zustand` - State management

**Current Architecture**:
- `src/core/parser/parseSpec.ts` - Parses YAML to internal model
- `src/core/graph-builder/buildGraph.ts` - Converts model to graph nodes/edges
- `src/types/openapi.ts` - Internal type definitions
- `src/types/graph.ts` - Graph node/edge types

---

## 3. Gap Analysis: Current vs Required

### 3.1 Currently Supported Reference Types

| Feature | Parser | Graph | Notes |
|---------|--------|-------|-------|
| `$ref` to schemas | ✅ | ✅ | Basic support |
| `allOf` composition | ✅ | ✅ | Extracts refs |
| `oneOf` composition | ✅ | ✅ | Extracts refs |
| `anyOf` composition | ✅ | ✅ | Extracts refs |
| Array `items` | ✅ | ✅ | Schema-level |
| Property `$ref` | ✅ | ✅ | Object properties |
| Request body schemas | ✅ | ✅ | Via endpoint edges |
| Response schemas | ✅ | ✅ | Via endpoint edges |
| Parameter schemas | ✅ | ✅ | Via endpoint edges |
| Circular reference detection | ✅ | ✅ | Tarjan's algorithm |

### 3.2 Missing/Incomplete Features

| Feature | Priority | Impact | Notes |
|---------|----------|--------|-------|
| **Component Types** | | | |
| Response components (`$ref` to components/responses) | High | Major | Common pattern for shared responses |
| Parameter components (`$ref` to components/parameters) | High | Major | Common for shared params |
| RequestBody components | High | Major | Reusable request bodies |
| Header components | Medium | Moderate | Response headers |
| Link components | Medium | Moderate | HATEOAS support |
| Callback components | Low | Minor | Webhook patterns |
| PathItem components | Low | Minor | Reusable path items |
| **Schema Features** | | | |
| `additionalProperties` with schema ref | High | Major | Map/dictionary types |
| `discriminator` object | High | Major | Polymorphism support |
| Nested `allOf/oneOf/anyOf` in properties | High | Major | Complex compositions |
| `items` with composition (array of oneOf) | Medium | Moderate | Union arrays |
| `prefixItems` (tuple types, OAS 3.1) | Low | Minor | Tuple support |
| `not` schema | Low | Minor | Negation |
| **Advanced Features** | | | |
| External `$ref` (other files/URLs) | Medium | Major | Multi-file specs |
| `$id` and `$anchor` (JSON Schema) | Low | Minor | OAS 3.1 feature |
| Response headers with schemas | Medium | Moderate | Header validation |
| Security scheme references | Low | Minor | Auth patterns |

### 3.3 Architecture Issues to Address

1. **Flat schema model**: Current `Schema` type doesn't distinguish between inline schemas and references well
2. **Lost context**: When extracting refs, we lose the context of WHERE the ref is (property name, array context, etc.)
3. **Incomplete component support**: Only schemas are tracked; other component types are not first-class
4. **No discriminator support**: Polymorphic patterns are not captured
5. **Graph edge semantics**: Edge types don't capture the full semantic context (e.g., "property X uses schema Y")

---

## 4. Proposed Architecture

### 4.1 Enhanced Schema Model

The core insight is to model OpenAPI relationships as a **rich graph** where:
- **Nodes** represent reusable components (schemas, responses, parameters, etc.)
- **Edges** represent relationships with full semantic context

```
┌─────────────────────────────────────────────────────────────────┐
│                        ParsedSpec                                │
├─────────────────────────────────────────────────────────────────┤
│  info: ApiInfo                                                   │
│  endpoints: Endpoint[]                                           │
│  components: ComponentRegistry  ← NEW: All component types       │
│  tags: Tag[]                                                     │
│  relationships: Relationship[]  ← NEW: Explicit relationship model│
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     ComponentRegistry                            │
├─────────────────────────────────────────────────────────────────┤
│  schemas: Map<string, Schema>                                    │
│  responses: Map<string, ResponseDef>                             │
│  parameters: Map<string, ParameterDef>                           │
│  requestBodies: Map<string, RequestBodyDef>                      │
│  headers: Map<string, HeaderDef>                                 │
│  links: Map<string, LinkDef>                                     │
│  callbacks: Map<string, CallbackDef>                             │
│  pathItems: Map<string, PathItemDef>                             │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Enhanced Schema Type

```typescript
interface Schema {
  id: string;
  name: string;
  type: SchemaType | SchemaType[];  // OAS 3.1 supports type arrays
  description?: string;

  // Object schema features
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  additionalProperties?: boolean | Schema;  // NEW: Can be schema ref

  // Composition
  allOf?: SchemaOrRef[];
  oneOf?: SchemaOrRef[];
  anyOf?: SchemaOrRef[];
  not?: SchemaOrRef;  // NEW

  // Polymorphism
  discriminator?: Discriminator;  // NEW

  // Array features
  items?: SchemaOrRef;
  prefixItems?: SchemaOrRef[];  // NEW: OAS 3.1 tuples
  minItems?: number;
  maxItems?: number;

  // Reference
  $ref?: string;

  // Metadata
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  example?: unknown;

  // Source tracking
  sourceLocation: SourceLocation;
  isInline: boolean;  // NEW: Track if defined inline vs in components
}

interface SchemaOrRef {
  // Either a reference or an inline schema
  $ref?: string;
  resolvedSchema?: Schema;  // Populated after resolution
  // ... inline schema properties if not a ref
}

interface Discriminator {
  propertyName: string;
  mapping?: Record<string, string>;  // value -> schema ref
}
```

### 4.3 Relationship Model

A key improvement is to make relationships first-class citizens:

```typescript
type RelationshipType =
  // Endpoint -> Component relationships
  | 'endpoint-request-body'
  | 'endpoint-response'
  | 'endpoint-parameter'
  | 'endpoint-header'
  | 'endpoint-callback'
  | 'endpoint-link'

  // Schema -> Schema relationships
  | 'schema-property'        // Property references another schema
  | 'schema-additional-props' // additionalProperties references schema
  | 'schema-allOf'
  | 'schema-oneOf'
  | 'schema-anyOf'
  | 'schema-not'
  | 'schema-array-items'
  | 'schema-tuple-items'
  | 'schema-discriminator'   // Discriminator mapping

  // Component -> Component relationships
  | 'response-schema'        // Response references schema
  | 'response-header'        // Response uses header component
  | 'parameter-schema'       // Parameter references schema
  | 'header-schema'          // Header references schema
  | 'link-operation'         // Link references operation
  | 'callback-path'          // Callback defines path items

  // Circular
  | 'circular';

interface Relationship {
  id: string;
  type: RelationshipType;
  source: ComponentRef;
  target: ComponentRef;
  context: RelationshipContext;
  isCircular: boolean;
}

interface ComponentRef {
  componentType: 'schema' | 'response' | 'parameter' | 'requestBody' | 'header' | 'link' | 'callback' | 'endpoint';
  name: string;
  path?: string;  // JSON pointer within the component
}

interface RelationshipContext {
  // Semantic context of the relationship
  propertyName?: string;      // For schema-property edges
  statusCode?: string;        // For response edges
  mediaType?: string;         // For content edges
  parameterLocation?: string; // query/path/header/cookie
  discriminatorValue?: string; // For discriminator mappings
}
```

### 4.4 Graph Node Enhancement

```typescript
type GraphNodeType =
  | 'endpoint'
  | 'schema'
  | 'response'
  | 'parameter'
  | 'requestBody'
  | 'header'
  | 'link'
  | 'callback';

interface BaseNodeData {
  componentType: GraphNodeType;
  name: string;
  visible: boolean;
  incomingRefs: number;   // Count of things referencing this
  outgoingRefs: number;   // Count of things this references
  isCircularMember: boolean;  // Part of a cycle
}

interface SchemaNodeData extends BaseNodeData {
  componentType: 'schema';
  schema: Schema;
  hasDiscriminator: boolean;
  discriminatorValues?: string[];  // Values that map to this schema
  compositionType?: 'allOf' | 'oneOf' | 'anyOf';  // If this is a composition
}
```

### 4.5 Enhanced Edge Types

```typescript
type EdgeType =
  // Endpoint edges
  | 'request-body'
  | 'response'
  | 'parameter'

  // Schema composition edges
  | 'allOf'
  | 'oneOf'
  | 'anyOf'
  | 'not'

  // Schema structural edges
  | 'property'           // Named property reference
  | 'additional-props'   // additionalProperties
  | 'array-items'        // Array items
  | 'tuple-item'         // Tuple position item

  // Polymorphism edges
  | 'discriminator'      // Discriminator mapping

  // Component edges
  | 'response-schema'
  | 'parameter-schema'
  | 'header-schema'

  // Special
  | 'circular';

interface EnhancedEdgeData {
  edgeType: EdgeType;
  label: string;
  semanticContext: {
    propertyName?: string;
    statusCode?: string;
    mediaType?: string;
    discriminatorValue?: string;
    arrayContext?: boolean;
    required?: boolean;
  };
}
```

---

## 5. Implementation Approach

### 5.1 Phase 1: Enhanced Parser (Core)

**Goal**: Extract ALL relationship information from OpenAPI specs

**Changes to `parseSpec.ts`**:

1. **Add component extraction for all types**:
   ```typescript
   function extractComponents(components: unknown): ComponentRegistry
   function extractResponseComponent(name: string, response: unknown): ResponseDef
   function extractParameterComponent(name: string, param: unknown): ParameterDef
   function extractRequestBodyComponent(name: string, body: unknown): RequestBodyDef
   function extractHeaderComponent(name: string, header: unknown): HeaderDef
   function extractLinkComponent(name: string, link: unknown): LinkDef
   function extractCallbackComponent(name: string, callback: unknown): CallbackDef
   ```

2. **Enhanced schema extraction**:
   ```typescript
   function extractSchemaWithRelationships(
     name: string,
     schemaObj: unknown,
     context: ExtractionContext
   ): { schema: Schema; relationships: Relationship[] }

   function extractDiscriminator(disc: unknown): Discriminator
   function extractAdditionalProperties(addProps: unknown): boolean | Schema
   ```

3. **Relationship collection**:
   ```typescript
   function collectEndpointRelationships(endpoint: Endpoint): Relationship[]
   function collectSchemaRelationships(schema: Schema): Relationship[]
   function collectResponseRelationships(response: ResponseDef): Relationship[]
   ```

### 5.2 Phase 2: Enhanced Graph Builder

**Goal**: Transform rich model into meaningful graph visualization

**Changes to `buildGraph.ts`**:

1. **Multi-component node creation**:
   ```typescript
   function createComponentNodes(components: ComponentRegistry): GraphNode[]
   function createEndpointNodes(endpoints: Endpoint[]): GraphNode[]
   ```

2. **Relationship-to-edge mapping**:
   ```typescript
   function relationshipsToEdges(
     relationships: Relationship[],
     circularEdges: Set<string>
   ): GraphEdge[]
   ```

3. **Enhanced circular detection** (keep Tarjan's, extend to all component types):
   ```typescript
   function detectCircularRelationships(
     relationships: Relationship[]
   ): Set<string>
   ```

4. **Semantic edge labeling**:
   ```typescript
   function createSemanticEdgeLabel(relationship: Relationship): string
   // e.g., "property: items[]" or "oneOf: Dog" or "response: 200"
   ```

### 5.3 Phase 3: Type Definitions

**New/Modified files**:
- `src/types/openapi.ts` - Enhanced schema and component types
- `src/types/graph.ts` - Enhanced node/edge types
- `src/types/relationships.ts` - NEW: Relationship model types

### 5.4 Phase 4: Constants & Configuration

**Changes to `src/constants/`**:
- `colors.ts` - Add colors for new edge types
- `edgeTypes.ts` - NEW: Edge type definitions and semantics

---

## 6. Source Code Changes

### 6.1 Files to Modify

| File | Changes |
|------|---------|
| `src/types/openapi.ts` | Add component types, enhance Schema, add Discriminator |
| `src/types/graph.ts` | Add new node types, enhance edge types |
| `src/core/parser/parseSpec.ts` | Major rewrite for comprehensive extraction |
| `src/core/graph-builder/buildGraph.ts` | Relationship-based edge generation |
| `src/constants/colors.ts` | Add colors for new edge types |
| `src/features/graph/components/SchemaNode.tsx` | Show discriminator info |
| `src/features/detail-panel/components/SchemaDetail.tsx` | Show relationships |

### 6.2 New Files

| File | Purpose |
|------|---------|
| `src/types/relationships.ts` | Relationship model types |
| `src/types/components.ts` | Non-schema component types |
| `src/constants/edgeTypes.ts` | Edge type configuration |

---

## 7. Detailed Implementation Plan

### Step 1: Enhanced Type Definitions
- Define `ComponentRegistry` type with all component maps
- Enhance `Schema` type with `additionalProperties`, `discriminator`, `not`, `prefixItems`
- Create `Relationship` and `RelationshipContext` types
- Define all `RelationshipType` variants
- Add component definition types (`ResponseDef`, `ParameterDef`, etc.)

### Step 2: Parser - Component Registry
- Implement `extractComponents()` to parse all component types
- Add extraction functions for each component type
- Update `ParsedSpec` to include `ComponentRegistry`
- Update `parseSpec()` to populate components

### Step 3: Parser - Enhanced Schema Extraction
- Add `additionalProperties` schema extraction
- Add `discriminator` extraction
- Add `not` schema extraction
- Add `prefixItems` extraction for tuples
- Handle nested composition in properties

### Step 4: Parser - Relationship Collection
- Create relationship collector that traverses all components
- Extract relationships from endpoint->schema
- Extract relationships from schema->schema (all types)
- Extract relationships from response->schema, parameter->schema, etc.
- Handle discriminator mappings as relationships

### Step 5: Graph Builder - Multi-Component Support
- Create nodes for all component types (not just schemas)
- Add node type configuration (colors, sizes, shapes)
- Update filtering to handle new node types

### Step 6: Graph Builder - Relationship-Based Edges
- Convert relationship model to edges
- Apply semantic context to edge labels
- Maintain circular reference detection
- Add edge type styling configuration

### Step 7: UI Updates
- Update SchemaNode to show discriminator badge
- Update DetailPanel to show relationship details
- Add legend for new edge types
- Update filtering for new component types

### Step 8: Testing
- Add unit tests for new parser functions
- Add tests for discriminator extraction
- Add tests for additionalProperties scenarios
- Add integration tests for complex specs
- Test circular detection with new relationship types

---

## 8. Verification Approach

### 8.1 Unit Tests

```bash
pnpm test
```

Test coverage for:
- All component type extraction
- Discriminator parsing
- additionalProperties with schema refs
- Nested composition schemas
- Relationship collection accuracy
- Circular detection across component types

### 8.2 Type Checking

```bash
pnpm typecheck
```

Ensure all new types are correctly defined and used.

### 8.3 Linting

```bash
pnpm lint
```

### 8.4 Manual Verification

Test with complex OpenAPI specs including:
1. **Petstore spec** - Standard reference spec
2. **Kubernetes API spec** - Heavy composition and discriminators
3. **Custom spec with all features** - discriminators, additionalProperties, callbacks, links

### 8.5 Full Verification

```bash
pnpm verify  # runs lint + typecheck + test
```

---

## 9. Key Design Decisions

### 9.1 Why a Relationship Model?

Instead of discovering edges at graph-build time, we extract relationships during parsing. Benefits:
- **Single source of truth**: Relationships are explicit, not derived
- **Richer context**: We preserve WHY things are connected
- **Easier testing**: Relationships can be unit tested independently
- **Future flexibility**: Can add relationship types without changing graph builder

### 9.2 Why Component Registry Instead of Arrays?

Using `Map<string, Component>` instead of `Component[]`:
- **O(1) lookup**: Fast reference resolution
- **Natural ID**: Component name is the key
- **Mirrors OpenAPI structure**: Components are keyed by name in the spec

### 9.3 Edge Label Strategy

Labels should be semantic and helpful:
- ❌ "schema-ref" (too technical)
- ✅ "property: address" (meaningful)
- ✅ "oneOf: Dog | Cat" (shows alternatives)
- ✅ "items[]" (indicates array)

---

## 10. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing functionality | Medium | High | Comprehensive test coverage |
| Performance with large specs | Low | Medium | Lazy relationship resolution |
| Complex discriminator handling | Medium | Medium | Start with simple cases, iterate |
| External $ref complexity | Medium | High | Defer to later phase |

---

## 11. Out of Scope (Future Work)

1. **External $ref resolution** - Multi-file spec support
2. **JSON Schema $id/$anchor** - Full JSON Schema 2020-12 support
3. **Security scheme visualization** - Auth flow diagrams
4. **Webhook visualization** - OAS 3.1 webhooks
5. **Real-time collaboration** - Multi-user editing

---

## 12. Success Criteria

1. ✅ Parser extracts ALL component types from OpenAPI 3.x specs
2. ✅ All reference mechanisms are captured as relationships
3. ✅ Discriminator patterns are properly visualized
4. ✅ `additionalProperties` with schema refs create edges
5. ✅ Nested composition is fully supported
6. ✅ All existing tests pass
7. ✅ New features have test coverage
8. ✅ No performance regression on existing specs
