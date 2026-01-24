# Architecture Overview

This document explains the architectural design of the OpenAPI Visualization project, with particular focus on the relationship model that enables semantic graph visualization.

## Design Philosophy

The core insight driving this architecture is the separation of **OpenAPI semantics** from **visual representation**. Rather than directly mapping JSON pointers to graph edges, we extract a rich relationship model that captures the *meaning* of connections between components.

This enables:
- Semantically meaningful edge labels and colors
- Filtering by relationship type
- Understanding circular dependencies in context
- Future features like "show all request body schemas"

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Application                        │
├─────────────────────────────────────────────────────────────────┤
│  Features                                                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Editor  │ │  Graph   │ │  Detail  │ │  Export  │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
│       │            │            │            │                  │
├───────┴────────────┴────────────┴────────────┴──────────────────┤
│  Zustand Stores                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ specStore│ │graphStore│ │ uiStore  │ │filterStr │          │
│  └────┬─────┘ └────┬─────┘ └──────────┘ └──────────┘          │
│       │            │                                            │
├───────┴────────────┴────────────────────────────────────────────┤
│  Core                                                           │
│  ┌────────────────────┐    ┌────────────────────┐              │
│  │       Parser       │───▶│    Graph Builder   │              │
│  │  (Web Worker)      │    │    (Web Worker)    │              │
│  └────────────────────┘    └────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## The Relationship Model

The relationship model is the heart of this application. It lives in `src/types/relationships.ts`.

### Why a Relationship Model?

Consider this OpenAPI fragment:

```yaml
paths:
  /users:
    post:
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateUserRequest'
      responses:
        '201':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'

components:
  schemas:
    CreateUserRequest:
      properties:
        address:
          $ref: '#/components/schemas/Address'
    User:
      allOf:
        - $ref: '#/components/schemas/BaseEntity'
        - type: object
          properties:
            name:
              type: string
```

A naive approach would create edges like:
- `POST /users` → `CreateUserRequest` (why?)
- `POST /users` → `User` (why?)
- `CreateUserRequest` → `Address` (why?)
- `User` → `BaseEntity` (why?)

Our relationship model captures the semantic context:

| Source | Target | Type | Context |
|--------|--------|------|---------|
| `POST /users` | `CreateUserRequest` | `endpoint-request-body` | `{mediaType: "application/json"}` |
| `POST /users` | `User` | `endpoint-response` | `{statusCode: "201", mediaType: "application/json"}` |
| `CreateUserRequest` | `Address` | `schema-property` | `{propertyName: "address"}` |
| `User` | `BaseEntity` | `schema-allOf` | `{}` |

### Relationship Types

```typescript
type RelationshipType =
  // Endpoint → Schema
  | 'endpoint-request-body'    // POST/PUT/PATCH body
  | 'endpoint-response'        // Response schema
  | 'endpoint-parameter'       // Path/query/header parameter

  // Schema → Schema (composition)
  | 'schema-allOf'             // Inheritance/extension
  | 'schema-oneOf'             // Union type (exactly one)
  | 'schema-anyOf'             // Union type (one or more)
  | 'schema-not'               // Negation

  // Schema → Schema (structural)
  | 'schema-property'          // Object property
  | 'schema-additional-props'  // additionalProperties
  | 'schema-array-items'       // Array items
  | 'schema-tuple-item'        // Tuple position

  // Schema → Schema (polymorphism)
  | 'schema-discriminator';    // Discriminator mapping
```

### Relationship Context

Each relationship carries semantic context:

```typescript
interface RelationshipContext {
  propertyName?: string;           // For schema-property
  statusCode?: string;             // For endpoint-response
  mediaType?: string;              // For request/response bodies
  parameterLocation?: string;      // For endpoint-parameter
  parameterName?: string;          // For endpoint-parameter
  discriminatorValue?: string;     // For schema-discriminator
  tupleIndex?: number;             // For schema-tuple-item
  isArray?: boolean;               // Array context flag
  required?: boolean;              // Required field flag
}
```

## Data Flow

### 1. Parsing (Web Worker)

```
Raw YAML/JSON
     │
     ▼
┌─────────────────────────────────────────────────┐
│                  Parser Worker                   │
│                                                  │
│  ┌──────────────┐   ┌──────────────────────┐   │
│  │ lineMapper   │   │ extractors/          │   │
│  │              │   │ ├── schemaExtractor  │   │
│  │ Line → Path  │   │ ├── endpointExtractor│   │
│  │ mapping      │   │ └── componentExtractor│   │
│  └──────────────┘   └──────────────────────┘   │
│          │                    │                  │
│          ▼                    ▼                  │
│  ┌──────────────┐   ┌──────────────────────┐   │
│  │  SourceMap   │   │     ParsedSpec       │   │
│  └──────────────┘   │ • endpoints[]        │   │
│                     │ • schemas[]          │   │
│                     │ • relationships[]    │   │
│                     └──────────────────────┘   │
└─────────────────────────────────────────────────┘
```

Key modules:
- **lineMapper.ts**: Maps source lines to component paths for "jump to source"
- **schemaExtractor.ts**: Extracts schema definitions with full type information
- **endpointExtractor.ts**: Extracts operations with parameters, bodies, responses
- **componentExtractor.ts**: Extracts reusable components (responses, parameters, etc.)
- **relationshipCollector.ts**: Builds the relationship graph from extracted components

### 2. Graph Building (Web Worker)

```
ParsedSpec
     │
     ▼
┌─────────────────────────────────────────────────┐
│               Graph Builder Worker               │
│                                                  │
│  ┌──────────────────┐   ┌─────────────────────┐│
│  │  nodeBuilder     │   │  edgeBuilder        ││
│  │                  │   │                     ││
│  │ • Endpoint nodes │   │ Relationships →     ││
│  │ • Schema nodes   │   │ React Flow edges    ││
│  │ • Ref counting   │   │                     ││
│  └──────────────────┘   └─────────────────────┘│
│          │                        │             │
│          ▼                        ▼             │
│  ┌──────────────────┐   ┌─────────────────────┐│
│  │ circularDetection│   │  layout (Dagre)     ││
│  │                  │   │                     ││
│  │ Tarjan's SCC     │   │ Auto-positioning    ││
│  │ algorithm        │   │                     ││
│  └──────────────────┘   └─────────────────────┘│
│                                                  │
│                    Result                        │
│           ┌────────────────────┐                │
│           │ • nodes: Node[]    │                │
│           │ • edges: Edge[]    │                │
│           └────────────────────┘                │
└─────────────────────────────────────────────────┘
```

Key modules:
- **nodeBuilder.ts**: Creates React Flow nodes from endpoints and schemas
- **edgeBuilder.ts**: Converts relationships to React Flow edges with styling
- **circularDetection.ts**: Tarjan's algorithm for finding strongly connected components
- **layout.ts**: Dagre-based automatic graph layout

### 3. Visualization

```
React Flow Graph
     │
     ├── Custom Nodes
     │   ├── EndpointNode (method badge, path, tags)
     │   └── SchemaNode (name, type indicator, properties preview)
     │
     ├── Custom Edges
     │   ├── Color-coded by relationship type
     │   └── Dashed for circular references
     │
     └── Interactivity
         ├── Selection → Detail Panel
         ├── Double-click → Source Navigation
         └── Hover → Relationship tooltip
```

## State Management

### Store Responsibilities

| Store | Persisted | Purpose |
|-------|-----------|---------|
| `specStore` | Partial | Raw text and file name (not parsed results) |
| `graphStore` | No | React Flow nodes and edges |
| `uiStore` | Yes | View mode, theme, display settings |
| `filterStore` | No | Active filters for graph view |
| `editorStore` | No | Monaco editor instance reference |

### Persistence Strategy

Zustand's `persist` middleware is used for stores that benefit from cross-session persistence:

```typescript
// specStore - persists editor content and file name only
persist(
  (set) => ({ ... }),
  {
    name: 'openapi-viz-spec',
    partialize: (state) => ({
      rawText: state.rawText,
      fileName: state.fileName,
    }),
  }
)

// uiStore - persists all UI preferences
persist(
  (set) => ({ ... }),
  { name: 'openapi-viz-ui' }
)
```

## Web Worker Architecture

Heavy computations run in Web Workers to keep the UI responsive:

```
Main Thread                              Worker Thread
┌──────────────────┐                     ┌──────────────────┐
│                  │  postMessage        │                  │
│ WorkerClient     │ ──────────────────▶ │ worker.ts        │
│                  │  {id, type, data}   │                  │
│ • Promise-based  │                     │ • Message handler│
│ • Request IDs    │                     │ • Error catching │
│ • Cancellation   │                     │ • Serialization  │
│                  │  postMessage        │                  │
│                  │ ◀────────────────── │                  │
│                  │  {id, result/error} │                  │
└──────────────────┘                     └──────────────────┘
```

### Message Protocol

```typescript
// Request (main → worker)
interface ParseRequest {
  id: string;
  type: 'parse';
  content: string;
}

// Response (worker → main)
interface ParseResponse {
  id: string;
  type: 'result' | 'error';
  result?: SerializableParseResult;
  error?: string;
}
```

### Worker Client Pattern

```typescript
class ParserWorkerClient {
  private static instance: ParserWorkerClient;
  private worker: Worker;
  private pending: Map<string, { resolve, reject }>;

  static getInstance(): ParserWorkerClient {
    if (!this.instance) {
      this.instance = new ParserWorkerClient();
    }
    return this.instance;
  }

  async parse(content: string): Promise<ParseResult> {
    const id = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type: 'parse', content });
    });
  }

  cancelPending(id?: string): void {
    // Cancel specific or all pending requests
  }
}
```

## Circular Reference Handling

### Detection

Tarjan's Strongly Connected Components algorithm identifies circular reference chains:

```typescript
function detectCircularRelationships(relationships: Relationship[]): Set<string> {
  // Build adjacency list from relationships
  // Run Tarjan's algorithm
  // Return IDs of relationships that form cycles
}
```

### Visualization

Circular relationships are styled distinctly:
- Dashed edge line
- "Circular" badge on edge label
- Warning indicator in detail panel

## Extending the Application

### Adding a New Relationship Type

1. Add type to `RelationshipType` union in `src/types/relationships.ts`
2. Add context fields if needed to `RelationshipContext`
3. Extract relationships in the appropriate collector function
4. Add edge styling in `edgeBuilder.ts`
5. Add tests for the new relationship type

### Adding a New Node Type

1. Create node component in `src/features/graph/components/`
2. Register in React Flow's `nodeTypes` prop
3. Add node creation logic in `nodeBuilder.ts`
4. Update detail panel to handle new node type

### Adding a New Store

1. Create store file in `src/stores/`
2. Export from `src/stores/index.ts`
3. Add persistence if needed using `persist` middleware
4. Consider which state should reset vs. persist

## Performance Considerations

1. **Debounced Parsing**: 500ms debounce prevents excessive parsing during typing
2. **Web Workers**: Heavy computation doesn't block UI
3. **Memoized Selectors**: Zustand selectors prevent unnecessary re-renders
4. **Virtualization Ready**: React Flow handles large graphs efficiently

## Testing Strategy

```
tests/
├── parser.test.ts          # Parser functionality (57 tests)
├── graphBuilder.test.ts    # Graph building logic (31 tests)
├── parserWorker.test.ts    # Worker integration (22 tests)
└── graphWorker.test.ts     # Worker integration (21 tests)
```

Tests focus on:
- Correct relationship extraction for complex OpenAPI patterns
- Circular reference detection accuracy
- Worker message handling and error propagation
- Edge cases (empty specs, invalid YAML, large files)
