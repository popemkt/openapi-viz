# Address Refinements: Web Workers and Module Refactoring

## Configuration
- **Artifacts Path**: `.zenflow/tasks/address-refinements-6a1f`
- **Spec**: `spec.md`

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

**Difficulty Assessment**: Hard

- Significant architectural changes (Web Workers)
- Refactoring large modules (1485 + 770 lines)
- Complex dependencies (node polyfills in workers)
- Risk of breaking existing functionality

**Deliverable**: `spec.md` with:
- Full technical context and approach
- Detailed file structure changes
- Worker architecture design
- Verification strategy

---

## Phase 1: Module Refactoring

### [x] Step: Extract Parser - Line Mapper Module
<!-- chat-id: 3cc0224f-1733-4d68-a4e7-6b5b57d77d0e -->

Extract source location tracking functions into dedicated module.

**Files to Create:**
- `src/core/parser/lineMapper.ts`

**Functions to Extract from `parseSpec.ts`:**
- `createSourceLocation()`
- `buildLineMap()`
- `buildSourceMap()`
- `COMPONENT_SECTIONS` constant

**Verification:**
```bash
pnpm typecheck && pnpm test -- parser
```

---

### [x] Step: Extract Parser - Schema Extractor Module
<!-- chat-id: d4dd8c44-2124-44af-9e23-bcaa342f7144 -->

Extract all schema extraction logic into dedicated module.

**Files to Create:**
- `src/core/parser/extractors/index.ts`
- `src/core/parser/extractors/schemaExtractor.ts`
- `src/core/parser/types.ts` (for `SchemaExtractionOptions`)

**Functions to Extract from `parseSpec.ts`:**
- `generateSchemaId()`
- `extractSchemaType()`
- `extractRefName()`
- `extractSchema()`
- `extractSchemaProperties()`
- `extractCompositionSchemas()`
- `extractPrefixItems()`
- `extractAdditionalProperties()`
- `extractDiscriminator()`

**Verification:**
```bash
pnpm typecheck && pnpm test -- parser
```

---

### [x] Step: Extract Parser - Endpoint Extractor Module
<!-- chat-id: fdb5c1c7-520e-4869-8393-d09e104eb6a0 -->

Extract endpoint extraction logic into dedicated module.

**Files to Create:**
- `src/core/parser/extractors/endpointExtractor.ts`

**Functions to Extract from `parseSpec.ts`:**
- `extractParameters()`
- `extractRequestBody()`
- `extractResponses()`
- `extractEndpoints()`
- `HTTP_METHODS` constant

**Verification:**
```bash
pnpm typecheck && pnpm test -- parser
```

---

### [x] Step: Extract Parser - Component Extractor Module
<!-- chat-id: 15760608-0c5e-4ba4-bc6d-369595897910 -->

Extract component registry extraction logic into dedicated module.

**Files to Create:**
- `src/core/parser/extractors/componentExtractor.ts`

**Functions to Extract from `parseSpec.ts`:**
- `extractMediaTypeContent()`
- `extractHeadersObject()`
- `extractResponseComponent()`
- `extractParameterComponent()`
- `extractRequestBodyComponent()`
- `extractHeaderComponent()`
- `extractLinkComponent()`
- `extractCallbackComponent()`
- `extractComponents()`
- `extractSchemas()`
- `extractTags()`

**Verification:**
```bash
pnpm typecheck && pnpm test -- parser
```

---

### [x] Step: Extract Parser - Relationship Collector Module
<!-- chat-id: a09f89ac-5795-46aa-a92d-40e873a9d8d4 -->

Extract relationship collection logic into dedicated module.

**Files to Create:**
- `src/core/parser/relationshipCollector.ts`

**Functions to Extract from `parseSpec.ts`:**
- `createSchemaRef()`
- `createEndpointRef()`
- `extractSchemaRefName()`
- `collectSchemaRelationships()`
- `collectCompositionRelationships()`
- `extractComponentSchemaRefs()`
- `collectEndpointRelationships()`
- `collectComponentRelationships()`
- `collectRelationships()`

**Verification:**
```bash
pnpm typecheck && pnpm test -- parser
```

---

### [x] Step: Clean Up Parser Main Module
<!-- chat-id: 22facda3-b981-40a1-b603-6d792c42409c -->

Simplify `parseSpec.ts` to be a coordination module that imports from extracted modules.

**Files to Modify:**
- `src/core/parser/parseSpec.ts` (reduce to ~150 lines)
- `src/core/parser/index.ts` (update exports)

**Expected Final Structure:**
```
src/core/parser/
├── index.ts
├── parseSpec.ts           (~150 lines, coordination only)
├── types.ts
├── lineMapper.ts
├── relationshipCollector.ts
└── extractors/
    ├── index.ts
    ├── schemaExtractor.ts
    ├── endpointExtractor.ts
    └── componentExtractor.ts
```

**Verification:**
```bash
pnpm verify
```

---

### [x] Step: Extract Graph Builder - Circular Detection Module
<!-- chat-id: 234a978e-3d04-4871-9b98-a9492f5166d3 -->

Extract Tarjan's SCC algorithm into dedicated module.

**Files to Create:**
- `src/core/graph-builder/circularDetection.ts`

**Functions to Extract from `buildGraph.ts`:**
- `detectCircularRelationships()`
- Tarjan's `strongconnect()` algorithm (inline function)

**Verification:**
```bash
pnpm typecheck && pnpm test -- graphBuilder
```

---

### [x] Step: Extract Graph Builder - Edge Builder Module
<!-- chat-id: 1c6f538e-e2bf-4084-bc41-634cb2f26d21 -->

Extract edge creation logic into dedicated module.

**Files to Create:**
- `src/core/graph-builder/edgeBuilder.ts`

**Functions to Extract from `buildGraph.ts`:**
- `getEdgeTypeForRelationship()`
- `relationshipsToEdges()`

**Verification:**
```bash
pnpm typecheck && pnpm test -- graphBuilder
```

---

### [x] Step: Extract Graph Builder - Node Builder Module
<!-- chat-id: cdd36199-85f2-4990-9d68-ed970db118b2 -->

Extract node creation logic into dedicated module.

**Files to Create:**
- `src/core/graph-builder/nodeBuilder.ts`

**Functions to Extract from `buildGraph.ts`:**
- `calculateRefCounts()`
- Endpoint node creation logic
- Schema node creation logic

**Verification:**
```bash
pnpm typecheck && pnpm test -- graphBuilder
```

---

### [x] Step: Extract Graph Builder - Legacy Support Module
<!-- chat-id: 63efdf49-b516-4b98-9a6a-88d8b5bf0d0a -->

Extract backward compatibility functions into dedicated module.

**Files to Create:**
- `src/core/graph-builder/legacySupport.ts`

**Functions to Extract from `buildGraph.ts`:**
- `extractSchemaRef()`
- `getDirectSchemaRefs()`
- `detectCircularEdgesLegacy()`
- `buildLegacySchemaEdges()`
- `buildLegacyEndpointEdges()`

**Verification:**
```bash
pnpm typecheck && pnpm test -- graphBuilder
```

---

### [x] Step: Extract Graph Builder - Layout Module
<!-- chat-id: a2c7f7c9-7872-44df-972c-67f02d016c3f -->

Extract Dagre layout logic into dedicated module.

**Files to Create:**
- `src/core/graph-builder/layout.ts`

**Functions to Extract from `buildGraph.ts`:**
- `DEFAULT_LAYOUT_OPTIONS`
- `applyDagreLayout()`

**Verification:**
```bash
pnpm typecheck && pnpm test -- graphBuilder
```

---

### [x] Step: Clean Up Graph Builder Main Module
<!-- chat-id: 0b2331bf-b96a-4ea4-bd0a-d4c76ca09670 -->

Simplify `buildGraph.ts` to be a coordination module.

**Files to Modify:**
- `src/core/graph-builder/buildGraph.ts` (reduce to ~150 lines)
- `src/core/graph-builder/index.ts` (update exports)

**Expected Final Structure:**
```
src/core/graph-builder/
├── index.ts
├── buildGraph.ts          (~150 lines, coordination only)
├── circularDetection.ts
├── edgeBuilder.ts
├── nodeBuilder.ts
├── legacySupport.ts
└── layout.ts
```

**Verification:**
```bash
pnpm verify
```

---

## Phase 2: Web Workers Implementation

### [x] Step: Configure Vite for Web Workers
<!-- chat-id: f09166f9-530f-493b-83b9-6144a45e0c10 -->

Update Vite configuration to support Web Workers with Node polyfills.

**Files to Modify:**
- `vite.config.ts`

**Changes:**
```typescript
worker: {
  format: 'es',
  plugins: () => [
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'path'],
      globals: { Buffer: true, process: true },
    }),
  ],
}
```

**Verification:**
```bash
pnpm build
```

---

### [x] Step: Implement Parser Worker
<!-- chat-id: de0fd08e-41f7-40d1-91f0-11d7014a8dd5 -->

Create Web Worker for parsing operations.

**Files to Create:**
- `src/core/parser/workers/parser.worker.ts`
- `src/core/parser/workers/parserWorkerClient.ts`
- `src/core/parser/workers/types.ts`

**Features:**
- Message protocol (ParseRequest/ParseResponse)
- Request ID correlation
- Error handling and serialization

**Verification:**
```bash
pnpm typecheck && pnpm test -- parser
```

---

### [x] Step: Implement Graph Worker
<!-- chat-id: f4ac6c33-d985-46c7-a9f7-a354275566d2 -->

Create Web Worker for graph building and layout.

**Files to Create:**
- `src/core/graph-builder/workers/graph.worker.ts`
- `src/core/graph-builder/workers/graphWorkerClient.ts`
- `src/core/graph-builder/workers/types.ts`

**Features:**
- Message protocol (BuildGraphRequest/BuildGraphResponse)
- Request ID correlation
- Layout options support

**Verification:**
```bash
pnpm typecheck && pnpm test -- graphBuilder
```

---

### [x] Step: Integrate Workers into Hooks
<!-- chat-id: 665c881c-8c52-41ea-8aa0-c8bf2055a286 -->

Update React hooks to use worker clients instead of direct function calls.

**Files to Modify:**
- `src/features/editor/hooks/useSpecParser.ts`
- `src/features/graph/hooks/useGraphBuilder.ts`

**Changes:**
- Replace `parseSpec()` with `ParserWorkerClient.parse()`
- Replace `buildGraph()` with `GraphWorkerClient.build()`
- Handle worker lifecycle (singleton pattern)

**Verification:**
```bash
pnpm verify
```

---

### [x] Step: Add Worker Integration Tests
<!-- chat-id: 9454caef-e710-46c8-9e07-3ea7162b0a37 -->

Add tests for worker message handling and integration.

**Files to Create/Modify:**
- `tests/parserWorker.test.ts` (NEW)
- `tests/graphWorker.test.ts` (NEW)

**Test Cases:**
- Worker responds to parse request
- Worker handles parse errors gracefully
- Worker handles large specs without timeout
- Request cancellation works correctly

**Verification:**
```bash
pnpm test
```

---

### [x] Step: Final Verification and Manual Testing
<!-- chat-id: bcbc1087-0afd-48d4-9348-cf730bf3d9cb -->

Comprehensive testing of the complete implementation.

**Verification Steps:**
1. Run full test suite: `pnpm verify`
2. Manual testing:
   - Load small spec (< 10 endpoints) - verify fast response
   - Load medium spec (50-100 endpoints) - verify UI responsive
   - Load large spec (500+ endpoints) - verify no UI freeze
   - Edit spec while parsing - verify cancel/restart works
   - Verify graph renders correctly after all parses
3. Browser testing: Chrome, Firefox, Safari

**Deliverable:**
Write report to `report.md` with:
- What was implemented
- Test results
- Performance benchmarks
- Any issues encountered

---

## Summary

| Phase | Steps | Focus |
|-------|-------|-------|
| Phase 1 | 12 steps | Module refactoring (parser + graph builder) |
| Phase 2 | 6 steps | Web Worker implementation |
| **Total** | **18 steps** | |

**Estimated Lines Changed:**
- ~2200 lines refactored (parser + graph builder)
- ~400 lines new (worker infrastructure)
- Tests updated/added

**Risk Mitigation:**
- Each step is independently testable
- Phase 1 provides value even if Phase 2 encounters issues
- Existing tests catch regressions throughout
