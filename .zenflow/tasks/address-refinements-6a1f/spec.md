# Technical Specification: Web Workers and Module Refactoring

## Task Difficulty: **Hard**

This task involves:
- Significant architectural changes (moving to Web Workers)
- Refactoring large modules while maintaining backward compatibility
- Complex dependencies (node polyfills required by @readme/openapi-parser)
- Risk of breaking existing functionality if not done carefully

---

## Technical Context

### Language & Dependencies
- **Language**: TypeScript 5.9.3, ES2022 target
- **Bundler**: Vite 7.2.4 with native Web Worker support
- **Key Dependencies**:
  - `yaml` (2.8.2) - YAML parsing
  - `@readme/openapi-parser` (5.5.0) - OpenAPI validation (requires Node polyfills)
  - `dagre` (0.8.5) - Graph layout algorithm
- **Testing**: Vitest 4.0.18

### Current Architecture
The parsing and graph layout run synchronously on the main thread:

```
useSpecParser (hook)
    ↓ debounced (500ms)
parseSpec() ← Main thread, blocking (~1485 lines)
    ↓
useGraphBuilder (hook)
    ↓
buildGraph() + applyDagreLayout() ← Main thread, blocking (~770 lines)
    ↓
Graph rendered
```

### Problem Statement
For large OpenAPI specifications (1000+ endpoints or deeply nested schemas), parsing and layout operations can block the main thread for 500ms-2s, causing:
- UI freeze during typing in the editor
- Dropped frames and laggy interactions
- Poor perceived performance

---

## Scope of Changes

### 1. Web Workers Implementation
Move CPU-intensive operations off the main thread:
- **Parser Worker**: YAML parsing, OpenAPI validation, relationship extraction
- **Graph Worker**: Graph building, Dagre layout computation

### 2. Parser Module Refactoring
Split `src/core/parser/parseSpec.ts` (1485 lines) into focused modules:
- `parseSpec.ts` - Main entry point and coordination (~150 lines)
- `schemaExtractor.ts` - Schema extraction functions (~350 lines)
- `endpointExtractor.ts` - Endpoint extraction functions (~200 lines)
- `componentExtractor.ts` - Component registry extraction (~300 lines)
- `relationshipCollector.ts` - Relationship collection logic (~350 lines)
- `lineMapper.ts` - Source location tracking (~100 lines)

### 3. Graph Builder Module Refactoring
Split `src/core/graph-builder/buildGraph.ts` (770 lines) into focused modules:
- `buildGraph.ts` - Main entry point and coordination (~150 lines)
- `circularDetection.ts` - Tarjan's SCC algorithm (~180 lines)
- `edgeBuilder.ts` - Relationship-to-edge conversion (~200 lines)
- `nodeBuilder.ts` - Node creation and metadata (~100 lines)
- `legacySupport.ts` - Backward compatibility functions (~180 lines)
- `layout.ts` - Dagre layout logic (~100 lines)

---

## Implementation Approach

### Phase 1: Module Refactoring (Low Risk)

Refactor both modules first **without** Web Workers. This allows:
- Incremental testing of extracted functions
- Existing tests to catch regressions
- Cleaner boundaries for Worker extraction later

#### 1.1 Parser Refactoring

**New file structure:**
```
src/core/parser/
├── index.ts                    # Re-exports
├── parseSpec.ts               # Main entry (coordination only)
├── types.ts                   # Internal types (SchemaExtractionOptions, etc.)
├── extractors/
│   ├── index.ts
│   ├── schemaExtractor.ts     # extractSchema, extractSchemaType, etc.
│   ├── endpointExtractor.ts   # extractEndpoints, extractParameters, etc.
│   └── componentExtractor.ts  # extractComponents, ComponentRegistry
├── relationshipCollector.ts   # collectRelationships, collectSchemaRelationships
└── lineMapper.ts              # buildLineMap, buildSourceMap
```

**Key functions to extract:**

From `parseSpec.ts`:

| Function | Target File | Lines |
|----------|-------------|-------|
| `extractSchemaType`, `extractSchema`, `extractSchemaProperties`, `extractCompositionSchemas`, `extractPrefixItems`, `extractAdditionalProperties`, `extractDiscriminator` | `schemaExtractor.ts` | ~250 |
| `extractParameters`, `extractRequestBody`, `extractResponses`, `extractEndpoints` | `endpointExtractor.ts` | ~140 |
| `extractMediaTypeContent`, `extractHeadersObject`, `extractResponseComponent`, `extractParameterComponent`, `extractRequestBodyComponent`, `extractHeaderComponent`, `extractLinkComponent`, `extractCallbackComponent`, `extractComponents` | `componentExtractor.ts` | ~280 |
| `collectSchemaRelationships`, `collectCompositionRelationships`, `extractComponentSchemaRefs`, `collectEndpointRelationships`, `collectComponentRelationships`, `collectRelationships` | `relationshipCollector.ts` | ~350 |
| `buildLineMap`, `createSourceLocation`, `buildSourceMap` | `lineMapper.ts` | ~100 |

#### 1.2 Graph Builder Refactoring

**New file structure:**
```
src/core/graph-builder/
├── index.ts                   # Re-exports
├── buildGraph.ts             # Main entry (coordination only)
├── types.ts                  # Internal types
├── circularDetection.ts      # Tarjan's algorithm
├── edgeBuilder.ts            # relationshipsToEdges, getEdgeTypeForRelationship
├── nodeBuilder.ts            # createEndpointNode, createSchemaNode
├── legacySupport.ts          # All legacy* functions
└── layout.ts                 # applyDagreLayout, DEFAULT_LAYOUT_OPTIONS
```

**Key functions to extract:**

| Function | Target File | Lines |
|----------|-------------|-------|
| `detectCircularRelationships`, Tarjan's algorithm | `circularDetection.ts` | ~120 |
| `relationshipsToEdges`, `getEdgeTypeForRelationship` | `edgeBuilder.ts` | ~100 |
| `calculateRefCounts`, node creation loops | `nodeBuilder.ts` | ~80 |
| `extractSchemaRef`, `getDirectSchemaRefs`, `detectCircularEdgesLegacy`, `buildLegacySchemaEdges`, `buildLegacyEndpointEdges` | `legacySupport.ts` | ~200 |
| `applyDagreLayout`, `DEFAULT_LAYOUT_OPTIONS` | `layout.ts` | ~50 |

### Phase 2: Web Worker Implementation

#### 2.1 Vite Worker Configuration

Vite supports Web Workers out of the box with `?worker` imports:

```typescript
// Import worker (Vite handles bundling)
import ParserWorker from './workers/parser.worker?worker';
const worker = new ParserWorker();
```

**Challenge**: The `@readme/openapi-parser` requires Node polyfills (buffer, process, util, stream, path). These must be bundled into the worker.

**Solution**: Configure Vite to apply `vite-plugin-node-polyfills` to workers:

```typescript
// vite.config.ts
export default defineConfig({
  worker: {
    format: 'es',
    plugins: () => [
      nodePolyfills({
        include: ['buffer', 'process', 'util', 'stream', 'path'],
        globals: { Buffer: true, process: true },
      }),
    ],
  },
  // ... rest of config
});
```

#### 2.2 Worker Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Main Thread                            │
├─────────────────────────────────────────────────────────────┤
│  useSpecParser                useGraphBuilder               │
│       ↓                            ↓                        │
│  ParserWorkerClient           GraphWorkerClient             │
│       ↓                            ↓                        │
└───────┼────────────────────────────┼────────────────────────┘
        │ postMessage                │ postMessage
        ▼                            ▼
┌───────────────────┐    ┌───────────────────────────────────┐
│  Parser Worker    │    │        Graph Worker               │
├───────────────────┤    ├───────────────────────────────────┤
│  - parseYaml      │    │  - buildGraph                     │
│  - validateOpenAPI│    │  - applyDagreLayout               │
│  - extractors     │    │  - circularDetection              │
│  - relationship   │    │                                   │
│    collector      │    │                                   │
└───────────────────┘    └───────────────────────────────────┘
```

#### 2.3 Worker Message Protocol

**Parser Worker:**
```typescript
// Request
interface ParseRequest {
  type: 'parse';
  id: string;  // For request/response correlation
  text: string;
}

// Response
interface ParseResponse {
  type: 'parse-result';
  id: string;
  result: ParseResult | null;
  error?: string;
}
```

**Graph Worker:**
```typescript
// Request
interface BuildGraphRequest {
  type: 'build';
  id: string;
  spec: ParsedSpec;
  layoutOptions?: Partial<LayoutOptions>;
}

// Response
interface BuildGraphResponse {
  type: 'build-result';
  id: string;
  result: GraphBuildResult | null;
  error?: string;
}
```

#### 2.4 Worker Client Pattern

Create a client class for clean async/await interface:

```typescript
// src/core/parser/parserWorkerClient.ts
export class ParserWorkerClient {
  private worker: Worker;
  private pendingRequests = new Map<string, { resolve, reject }>();

  constructor() {
    this.worker = new ParserWorker();
    this.worker.onmessage = this.handleMessage.bind(this);
  }

  async parse(text: string): Promise<ParseResult> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({ type: 'parse', id, text });
    });
  }

  terminate() {
    this.worker.terminate();
  }

  private handleMessage(event: MessageEvent<ParseResponse>) {
    const { id, result, error } = event.data;
    const pending = this.pendingRequests.get(id);
    if (pending) {
      this.pendingRequests.delete(id);
      if (error) {
        pending.reject(new Error(error));
      } else {
        pending.resolve(result);
      }
    }
  }
}
```

#### 2.5 Singleton vs On-Demand Workers

**Recommendation**: Use singleton workers that persist for the session.

Pros:
- No worker startup cost on each parse
- Warm module cache in worker
- Simpler lifecycle management

Cons:
- Memory overhead (but minimal for these workers)

```typescript
// src/core/parser/index.ts
let workerClient: ParserWorkerClient | null = null;

export function getParserWorker(): ParserWorkerClient {
  if (!workerClient) {
    workerClient = new ParserWorkerClient();
  }
  return workerClient;
}

// For cleanup (e.g., in tests or app unmount)
export function terminateParserWorker() {
  workerClient?.terminate();
  workerClient = null;
}
```

---

## Source Code Structure Changes

### New Files to Create

```
src/core/parser/
├── extractors/
│   ├── index.ts                    # NEW
│   ├── schemaExtractor.ts          # NEW
│   ├── endpointExtractor.ts        # NEW
│   └── componentExtractor.ts       # NEW
├── relationshipCollector.ts        # NEW
├── lineMapper.ts                   # NEW
├── types.ts                        # NEW (internal types)
├── workers/
│   ├── parser.worker.ts            # NEW
│   └── parserWorkerClient.ts       # NEW
├── parseSpec.ts                    # MODIFIED (reduced to coordination)
└── index.ts                        # MODIFIED (add worker exports)

src/core/graph-builder/
├── circularDetection.ts            # NEW
├── edgeBuilder.ts                  # NEW
├── nodeBuilder.ts                  # NEW
├── legacySupport.ts                # NEW
├── layout.ts                       # NEW
├── workers/
│   ├── graph.worker.ts             # NEW
│   └── graphWorkerClient.ts        # NEW
├── buildGraph.ts                   # MODIFIED (reduced to coordination)
└── index.ts                        # MODIFIED (add worker exports)
```

### Files to Modify

| File | Change Type | Description |
|------|-------------|-------------|
| `vite.config.ts` | MODIFIED | Add worker plugin configuration |
| `src/features/editor/hooks/useSpecParser.ts` | MODIFIED | Use ParserWorkerClient instead of direct parseSpec |
| `src/features/graph/hooks/useGraphBuilder.ts` | MODIFIED | Use GraphWorkerClient instead of direct buildGraph |
| `tests/parser.test.ts` | MODIFIED | Test extracted modules + worker integration |
| `tests/graphBuilder.test.ts` | MODIFIED | Test extracted modules + worker integration |

---

## Data Model / Interface Changes

No changes to public interfaces. All types remain the same:
- `ParseResult`
- `ParsedSpec`
- `GraphBuildResult`
- `GraphNode`, `GraphEdge`

Internal types may be added in module-specific `types.ts` files:
- `SchemaExtractionOptions` (already exists, just relocated)
- Worker message types (new)

---

## Verification Approach

### Phase 1 Verification (Refactoring)
1. Run existing tests after each extracted module:
   ```bash
   pnpm test
   ```
2. Verify no type errors:
   ```bash
   pnpm typecheck
   ```
3. Verify lint passes:
   ```bash
   pnpm lint
   ```
4. Full verification:
   ```bash
   pnpm verify
   ```

### Phase 2 Verification (Web Workers)
1. **Unit tests for workers**: Test worker message handling
2. **Integration tests**: Verify end-to-end parsing flow through workers
3. **Manual testing**:
   - Load large OpenAPI spec (1000+ endpoints)
   - Verify editor remains responsive during parsing
   - Verify graph renders correctly after parsing
4. **Performance benchmarking**:
   - Measure time-to-parse for large specs (before/after)
   - Measure main thread blocking time (should be near zero)

### Test Commands
```bash
# Run all tests
pnpm test

# Run parser tests only
pnpm test -- parser

# Run graph builder tests only
pnpm test -- graphBuilder

# Type check
pnpm typecheck

# Full verification
pnpm verify
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Node polyfills don't work in Worker | Medium | High | Test early; fallback to SharedWorker or main thread |
| Serialization overhead negates gains | Low | Medium | ParsedSpec is JSON-serializable; benchmark transfer time |
| Tests break during refactoring | Medium | Medium | Extract one module at a time; run tests after each |
| Memory leaks from workers | Low | Low | Implement cleanup in useEffect returns |
| Safari/Firefox Worker compat | Low | Medium | Test on all browsers; Vite handles ES module workers |

---

## Fallback Plan

If Web Workers prove problematic (polyfill issues, serialization overhead):

1. Keep the modular refactoring (still valuable for maintainability)
2. Use `requestIdleCallback` to break parsing into chunks
3. Add progress indicators during long parses
4. Consider WebAssembly for hot paths (future enhancement)

---

## Dependencies Between Steps

```
Phase 1A: Parser Refactoring
    ↓ (must complete before)
Phase 1B: Graph Builder Refactoring
    ↓ (must complete before)
Phase 2A: Parser Worker
    ↓ (can run in parallel with)
Phase 2B: Graph Worker
    ↓
Integration Testing
```

Phase 1A and 1B are independent and could theoretically be parallelized, but sequential is safer for testing.
