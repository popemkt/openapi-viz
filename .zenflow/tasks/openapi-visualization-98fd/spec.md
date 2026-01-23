# Technical Specification: OpenAPI Visualization Editor

## 1. Technical Context

### 1.1 Technology Stack

| Category | Choice | Rationale |
|----------|--------|-----------|
| **Framework** | React 18 | Industry standard, excellent ecosystem, hooks for state management |
| **Language** | TypeScript 5.x (strict mode) | Type safety critical for OpenAPI structures |
| **Build Tool** | Vite 5.x | Fast HMR, optimized production builds, excellent TypeScript support |
| **Package Manager** | pnpm | Fast, disk-efficient, strict dependency resolution |
| **State Management** | Zustand | Lightweight, TypeScript-friendly, no boilerplate |
| **Code Editor** | Monaco Editor | Same engine as VS Code, excellent YAML/JSON support, built-in features |
| **Graph Visualization** | React Flow | React-native, performant, great DX, handles large graphs well |
| **Graph Layout** | Dagre | Automatic graph layouting for directed graphs, integrates with React Flow |
| **YAML Parser** | yaml (eemeli/yaml) | Preserves comments, handles streaming, good error reporting |
| **OpenAPI Validation** | @readme/openapi-parser | Robust OpenAPI 3.1 validation, good error messages |
| **Markdown Rendering** | react-markdown | Render OpenAPI descriptions with Markdown formatting |
| **Styling** | Tailwind CSS | Rapid development, consistent design, small bundle with purging |
| **Testing** | Vitest + React Testing Library | Fast, Vite-native, good React support |
| **Linting** | ESLint + Prettier | Code quality and consistency |

### 1.2 Key Library Decisions

#### Monaco Editor vs CodeMirror 6
**Choice: Monaco Editor**
- Built-in YAML/JSON language support with syntax highlighting
- Auto-completion infrastructure ready to extend
- Familiar to developers (VS Code)
- Better documentation and community support
- Trade-off: Larger bundle (~500KB), but acceptable for this use case

#### React Flow vs Cytoscape.js vs D3
**Choice: React Flow**
- Native React integration (no wrapper needed)
- Built-in minimap, controls, node types
- Excellent performance with virtualization
- Active development and good documentation
- Supports custom node components (essential for our design)
- Trade-off: Less flexible than D3, but better for our specific use case

#### Zustand vs Redux Toolkit
**Choice: Zustand**
- Minimal boilerplate
- Excellent TypeScript inference
- Easy to split stores by feature
- No providers needed
- Built-in persist middleware for localStorage
- Trade-off: Less structured than Redux, but sufficient for this scope

#### Dagre for Graph Layout
**Choice: Dagre**
- Automatic directed graph layout algorithm
- Well-tested hierarchical layout
- Integrates seamlessly with React Flow via `dagre` package
- Handles complex graphs with minimal configuration
- Trade-off: Less control than manual positioning, but essential for automatic visualization

### 1.3 Browser Support

- Chrome 90+
- Firefox 90+
- Safari 15+
- Edge 90+

No polyfills for older browsers. Uses modern APIs: ResizeObserver, Intl, CSS Grid/Flexbox.

---

## 2. Implementation Approach

### 2.1 Architecture Pattern

**Layered Architecture with Feature Modules**

```
src/
├── app/                    # Application shell, routing, providers
├── features/               # Feature modules (vertical slices)
│   ├── editor/             # Text editor feature
│   ├── graph/              # Graph visualization feature
│   ├── detail-panel/       # Entity detail panel
│   ├── file-manager/       # File operations
│   └── sharing/            # Export and sharing
├── shared/                 # Shared code across features
│   ├── components/         # Reusable UI components
│   ├── hooks/              # Shared React hooks
│   ├── utils/              # Utility functions
│   └── types/              # Shared TypeScript types
├── core/                   # Core business logic
│   ├── parser/             # OpenAPI parsing and validation
│   ├── graph-builder/      # Transform spec to graph structure
│   └── sync/               # Text ↔ Graph synchronization
└── stores/                 # Zustand stores
```

### 2.2 Data Flow

```
┌──────────────┐     parse      ┌─────────────────┐
│  Raw YAML/   │ ───────────▶  │  OpenAPI AST    │
│  JSON Text   │                │  (validated)     │
└──────────────┘                └─────────────────┘
       │                               │
       │                               │ transform
       │                               ▼
       │                        ┌─────────────────┐
       │                        │  Graph Model    │
       │                        │  (nodes/edges)  │
       │                        │  + Dagre Layout │
       │                        └─────────────────┘
       │                               │
       │ Monaco                        │ React Flow
       │ Editor                        ▼
       ▼                        ┌─────────────────┐
┌──────────────┐               │  Visual Graph   │
│  Text View   │◀─────────────▶│  (rendered)     │
└──────────────┘   selection    └─────────────────┘
                   sync
```

**Performance Strategy:**
- Debounced parsing (500ms) to avoid excessive re-parses during typing
- React Flow handles virtualization for large graphs automatically

### 2.3 State Architecture

**Stores (Zustand)**

1. **specStore** - Source of truth for the OpenAPI spec
   - `rawText: string` - Current text content
   - `parsedSpec: OpenAPISpec | null` - Parsed and validated spec
   - `parseErrors: ParseError[]` - Validation errors
   - `isDirty: boolean` - Unsaved changes flag
   - `filePath: string | null` - Current file name

2. **graphStore** - Graph visualization state
   - `nodes: GraphNode[]` - All graph nodes
   - `edges: GraphEdge[]` - All graph edges
   - `layout: LayoutState` - Node positions
   - `selectedNodeId: string | null` - Currently selected node

3. **filterStore** - Filter and search state (persisted to localStorage)
   - `showEndpoints: boolean`
   - `showSchemas: boolean`
   - `methodFilters: HttpMethod[]`
   - `tagFilters: string[]`
   - `searchQuery: string`

4. **uiStore** - UI state (persisted to localStorage)
   - `viewMode: 'editor' | 'graph' | 'split'`
   - `splitPosition: number` - Percentage for split view
   - `detailPanelOpen: boolean`
   - `theme: 'light' | 'dark'`

**Persistence Strategy:**
- `filterStore` and `uiStore` use Zustand's `persist` middleware
- Preferences automatically saved to `localStorage` on change
- `specStore` and `graphStore` are NOT persisted (session-only for security)

---

## 3. Source Code Structure

```
openapi-visualization/
├── .github/
│   └── workflows/
│       └── ci.yml                 # CI pipeline
├── public/
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── App.tsx                # Root component
│   │   ├── Layout.tsx             # Main layout with toolbar
│   │   └── providers.tsx          # Context providers
│   │
│   ├── features/
│   │   ├── editor/
│   │   │   ├── components/
│   │   │   │   ├── TextEditor.tsx       # Monaco wrapper
│   │   │   │   └── EditorToolbar.tsx    # Editor-specific controls
│   │   │   ├── hooks/
│   │   │   │   └── useEditorSync.ts     # Sync with graph selection
│   │   │   └── index.ts
│   │   │
│   │   ├── graph/
│   │   │   ├── components/
│   │   │   │   ├── GraphCanvas.tsx      # React Flow wrapper
│   │   │   │   ├── EndpointNode.tsx     # Custom endpoint node
│   │   │   │   ├── SchemaNode.tsx       # Custom schema node
│   │   │   │   ├── FilterControls.tsx   # Filter panel
│   │   │   │   └── GraphMinimap.tsx     # Minimap overlay
│   │   │   ├── hooks/
│   │   │   │   ├── useGraphLayout.ts    # Auto-layout logic
│   │   │   │   └── useNodeFiltering.ts  # Filter application
│   │   │   └── index.ts
│   │   │
│   │   ├── detail-panel/
│   │   │   ├── components/
│   │   │   │   ├── DetailPanel.tsx      # Main panel component
│   │   │   │   ├── EndpointDetail.tsx   # Endpoint details view
│   │   │   │   ├── SchemaDetail.tsx     # Schema details view
│   │   │   │   ├── PropertyTree.tsx     # Recursive property display
│   │   │   │   └── MarkdownDescription.tsx  # Renders markdown descriptions
│   │   │   └── index.ts
│   │   │
│   │   ├── file-manager/
│   │   │   ├── components/
│   │   │   │   ├── FileToolbar.tsx      # Open/Save/New buttons
│   │   │   │   └── RecentFiles.tsx      # Recent files dropdown
│   │   │   ├── hooks/
│   │   │   │   ├── useFileOperations.ts # File I/O logic
│   │   │   │   └── useUnsavedWarning.ts # Before unload handler
│   │   │   └── index.ts
│   │   │
│   │   └── sharing/
│   │       ├── components/
│   │       │   ├── ExportMenu.tsx       # Export options dropdown
│   │       │   └── ShareDialog.tsx      # Share link dialog
│   │       ├── utils/
│   │       │   ├── htmlExporter.ts      # Self-contained HTML export
│   │       │   ├── imageExporter.ts     # PNG/SVG export
│   │       │   └── urlEncoder.ts        # URL-based sharing
│   │       └── index.ts
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Button.tsx
│   │   │   ├── Dropdown.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   └── ResizablePanels.tsx
│   │   ├── hooks/
│   │   │   ├── useLocalStorage.ts
│   │   │   └── useDebounce.ts
│   │   └── utils/
│   │       └── cn.ts                    # className utility
│   │
│   ├── core/
│   │   ├── parser/
│   │   │   ├── parseSpec.ts             # Main parse function
│   │   │   ├── validateSpec.ts          # OpenAPI validation
│   │   │   └── yamlUtils.ts             # YAML-specific utilities
│   │   │
│   │   ├── graph-builder/
│   │   │   ├── buildGraph.ts            # Spec → Graph transformation
│   │   │   ├── extractEndpoints.ts      # Extract path/operation nodes
│   │   │   ├── extractSchemas.ts        # Extract component schemas
│   │   │   └── buildEdges.ts            # Create relationship edges
│   │   │
│   │   └── sync/
│   │       ├── textToPosition.ts        # Find text position for node
│   │       └── positionToNode.ts        # Find node for cursor position
│   │
│   ├── stores/
│   │   ├── specStore.ts
│   │   ├── graphStore.ts
│   │   ├── filterStore.ts
│   │   └── uiStore.ts
│   │
│   ├── types/
│   │   ├── openapi.ts                   # OpenAPI type definitions
│   │   ├── graph.ts                     # Graph model types
│   │   └── common.ts                    # Shared types
│   │
│   ├── constants/
│   │   ├── httpMethods.ts               # HTTP method definitions
│   │   ├── colors.ts                    # Color scheme
│   │   └── templates.ts                 # New file templates
│   │
│   ├── main.tsx                         # Entry point
│   └── index.css                        # Global styles + Tailwind
│
├── tests/
│   ├── unit/
│   │   ├── parser/
│   │   └── graph-builder/
│   ├── integration/
│   │   └── sync.test.ts
│   └── fixtures/
│       ├── petstore.yaml                # Test OpenAPI spec
│       └── complex-api.yaml             # Large test spec
│
├── .eslintrc.cjs
├── .prettierrc
├── .gitignore
├── index.html
├── package.json
├── pnpm-lock.yaml
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

---

## 4. Data Models & Interfaces

### 4.1 Core Types

```typescript
// types/openapi.ts

/**
 * Supported HTTP methods
 */
export type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head';

/**
 * Parsed OpenAPI specification (subset of full spec, focused on our needs)
 */
export interface ParsedSpec {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  endpoints: Endpoint[];
  schemas: Schema[];
  tags: Tag[];
}

/**
 * Represents a single API endpoint
 */
export interface Endpoint {
  id: string;                     // Unique identifier (e.g., "get-/users/{id}")
  path: string;                   // e.g., "/users/{id}"
  method: HttpMethod;
  operationId?: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  deprecated?: boolean;
  sourceLocation: SourceLocation; // For text↔graph sync
}

/**
 * Represents a schema definition from components/schemas
 */
export interface Schema {
  id: string;                     // Schema name (e.g., "User")
  name: string;
  type: SchemaType;
  description?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  enum?: unknown[];
  items?: Schema;                 // For array types
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  $ref?: string;                  // Reference to another schema
  sourceLocation: SourceLocation;
}

export interface SchemaProperty {
  name: string;
  type: SchemaType;
  description?: string;
  required: boolean;
  format?: string;
  enum?: unknown[];
  $ref?: string;
  items?: Schema;
}

export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required: boolean;
  schema?: Schema;
  description?: string;
}

export interface RequestBody {
  description?: string;
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, Header>;
}

export interface MediaType {
  schema?: Schema;
  example?: unknown;
}

export interface Tag {
  name: string;
  description?: string;
}

/**
 * Location in source text for bidirectional sync
 */
export interface SourceLocation {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}
```

### 4.2 Graph Types

```typescript
// types/graph.ts

import type { Node, Edge } from '@xyflow/react';

/**
 * Node types in the graph
 */
export type GraphNodeType = 'endpoint' | 'schema';

/**
 * Extended node data for endpoints
 */
export interface EndpointNodeData {
  type: 'endpoint';
  endpoint: Endpoint;
  visible: boolean;       // Controlled by filters
}

/**
 * Extended node data for schemas
 */
export interface SchemaNodeData {
  type: 'schema';
  schema: Schema;
  visible: boolean;
}

export type GraphNodeData = EndpointNodeData | SchemaNodeData;

/**
 * Graph node with our custom data
 */
export type GraphNode = Node<GraphNodeData>;

/**
 * Edge types
 */
export type EdgeType =
  | 'request-body'      // Endpoint uses schema for request body
  | 'response'          // Endpoint uses schema for response
  | 'parameter'         // Endpoint uses schema for parameter
  | 'schema-ref'        // Schema references another schema
  | 'circular';         // Circular reference (special styling)

/**
 * Extended edge data
 */
export interface GraphEdgeData {
  type: EdgeType;
  label?: string;        // e.g., "200 OK", "request body"
}

export type GraphEdge = Edge<GraphEdgeData>;

/**
 * Graph layout state (for saving/restoring positions)
 */
export interface LayoutState {
  positions: Record<string, { x: number; y: number }>;
  zoom: number;
  pan: { x: number; y: number };
}
```

### 4.3 Store Types

```typescript
// stores/specStore.ts

import type { ParsedSpec, SourceLocation } from '../types/openapi';

export interface ParseError {
  message: string;
  location?: SourceLocation;
  severity: 'error' | 'warning';
}

export interface SpecState {
  // Data
  rawText: string;
  parsedSpec: ParsedSpec | null;
  parseErrors: ParseError[];

  // File state
  fileName: string | null;
  isDirty: boolean;

  // Actions
  setText: (text: string) => void;
  loadFile: (content: string, fileName: string) => void;
  markSaved: () => void;
  reset: () => void;
}
```

```typescript
// stores/graphStore.ts

import type { GraphNode, GraphEdge, LayoutState } from '../types/graph';

export interface GraphState {
  // Data
  nodes: GraphNode[];
  edges: GraphEdge[];
  layout: LayoutState;

  // Selection
  selectedNodeId: string | null;
  hoveredNodeId: string | null;

  // Actions
  setNodes: (nodes: GraphNode[]) => void;
  setEdges: (edges: GraphEdge[]) => void;
  selectNode: (id: string | null) => void;
  hoverNode: (id: string | null) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  setLayout: (layout: Partial<LayoutState>) => void;
}
```

```typescript
// stores/filterStore.ts

import type { HttpMethod } from '../types/openapi';

export interface FilterState {
  // Toggle filters
  showEndpoints: boolean;
  showSchemas: boolean;

  // Method filter
  methodFilters: HttpMethod[];  // Empty = all methods

  // Tag filter
  tagFilters: string[];         // Empty = all tags

  // Path filter
  pathPattern: string;          // Regex pattern

  // Search
  searchQuery: string;

  // Actions
  toggleEndpoints: () => void;
  toggleSchemas: () => void;
  setMethodFilters: (methods: HttpMethod[]) => void;
  setTagFilters: (tags: string[]) => void;
  setPathPattern: (pattern: string) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;
}
```

```typescript
// stores/uiStore.ts

export type ViewMode = 'editor' | 'graph' | 'split';
export type Theme = 'light' | 'dark' | 'system';

export interface UIState {
  // View
  viewMode: ViewMode;
  splitPosition: number;        // 0-100 percentage

  // Panels
  detailPanelOpen: boolean;
  detailPanelHeight: number;    // pixels

  // Theme
  theme: Theme;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSplitPosition: (position: number) => void;
  toggleDetailPanel: () => void;
  setDetailPanelHeight: (height: number) => void;
  setTheme: (theme: Theme) => void;
}
```

---

## 5. API & Interface Contracts

### 5.1 Core Parser API

```typescript
// core/parser/parseSpec.ts

import type { ParsedSpec, ParseError } from '../types';

export interface ParseResult {
  spec: ParsedSpec | null;
  errors: ParseError[];
  sourceMap: SourceMap;  // For text↔node sync
}

/**
 * Parse raw YAML/JSON text into structured OpenAPI spec
 */
export function parseSpec(text: string): ParseResult;

/**
 * Validate parsed spec against OpenAPI 3.1
 */
export function validateSpec(spec: unknown): ParseError[];
```

### 5.2 Graph Builder API

```typescript
// core/graph-builder/buildGraph.ts

import type { ParsedSpec, GraphNode, GraphEdge } from '../types';

export interface GraphBuildResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/**
 * Transform parsed OpenAPI spec into graph structure
 * Handles circular references via visited set tracking
 */
export function buildGraph(spec: ParsedSpec): GraphBuildResult;

/**
 * Apply automatic layout to nodes using Dagre
 */
export function applyLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options?: LayoutOptions
): GraphNode[];

export interface LayoutOptions {
  direction: 'LR' | 'TB';       // Left-right or top-bottom
  nodeSpacing: number;
  rankSpacing: number;
}

/**
 * Circular Reference Handling Strategy:
 *
 * OpenAPI specs frequently contain circular references (e.g., recursive schemas).
 * Implementation approach:
 *
 * 1. Track visited schemas during traversal using a Set<string>
 * 2. When encountering a $ref already in the visited set:
 *    - Create edge to existing node instead of re-processing
 *    - Mark edge as "circular" for visual distinction
 * 3. Limit recursion depth to prevent infinite loops (max depth: 10)
 * 4. Example circular reference:
 *    Schema "User" has property "manager" → $ref: "#/components/schemas/User"
 *
 * This ensures graphs remain finite and performant while accurately
 * representing the spec structure.
 */
```

### 5.3 Sync API

```typescript
// core/sync/textToPosition.ts

import type { SourceLocation } from '../types';

/**
 * Find the text position for a given node ID
 */
export function getPositionForNode(
  nodeId: string,
  sourceMap: SourceMap
): SourceLocation | null;

/**
 * Find the node ID at a given cursor position
 */
export function getNodeAtPosition(
  line: number,
  column: number,
  sourceMap: SourceMap
): string | null;
```

---

## 6. Delivery Phases

### Phase 1: Foundation (MVP Core)
**Goal**: Basic editor + graph visualization with static display

**Deliverables**:
1. Project setup (Vite, React, TypeScript, Tailwind)
2. Basic layout with toolbar and split view
3. Monaco editor integration with YAML/JSON support
4. OpenAPI parser with validation
5. Graph builder (endpoints + schemas as nodes)
6. React Flow integration with custom nodes
7. Basic filtering (show/hide endpoints, schemas)

**Verification**:
- Load a sample OpenAPI spec and see it in both views
- Toggle between editor/graph/split modes
- Filter nodes by type

### Phase 2: Interactivity
**Goal**: Full bidirectional sync and interaction

**Deliverables**:
1. Click node → highlight in editor
2. Cursor in editor → highlight node
3. Detail panel with endpoint/schema information
4. Node selection with full details
5. Zoom, pan, minimap controls
6. Search/highlight functionality

**Verification**:
- Select endpoint in graph, editor scrolls to position
- Click in editor, corresponding node highlights
- Search for "user" highlights matching nodes

### Phase 3: File Management & Polish
**Goal**: Complete file workflow

**Deliverables**:
1. File open (picker + drag-drop)
2. File save (download)
3. New file from template
4. Recent files list
5. Unsaved changes warning
6. Edge relationship labels
7. Method-based coloring

**Verification**:
- Open local file, edit, save
- Close tab with unsaved changes shows warning
- Recent files persists across sessions

### Phase 4: Sharing & Export
**Goal**: Enable sharing without server

**Deliverables**:
1. Export as self-contained HTML
2. Export graph as PNG/SVG
3. Copy shareable URL (for small specs)
4. Filter by HTTP method
5. Filter by tag
6. Filter by path pattern

**Verification**:
- Export HTML, open in new browser, verify it works offline
- Export PNG matches current view
- URL sharing works for petstore spec

---

## 7. Verification Approach

### 7.1 Automated Testing

**Unit Tests** (Vitest)
- Parser: Valid/invalid YAML/JSON handling
- Graph builder: Correct node/edge generation
- Filters: Correct node visibility
- Sync: Position ↔ node mapping accuracy

**Integration Tests** (Vitest + React Testing Library)
- Editor ↔ Graph sync workflow
- Filter application on graph
- File operations (mock File API)

**E2E Tests** (Playwright) - Future consideration
- Full user workflows
- Cross-browser verification

### 7.2 Test Commands

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run with coverage
pnpm test:coverage

# Lint check
pnpm lint

# Type check
pnpm typecheck

# Full verification
pnpm verify  # runs lint, typecheck, test
```

### 7.3 CI Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
```

### 7.4 Manual Testing Checklist

For each phase completion:
- [ ] Load petstore.yaml (standard example)
- [ ] Load a large spec (200+ endpoints)
- [ ] Verify no console errors
- [ ] Check performance (no jank on interactions)
- [ ] Test in Chrome, Firefox, Safari
- [ ] Verify responsive behavior at different widths

### 7.5 Performance Benchmarks

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial load | < 3s (3G) | Lighthouse |
| Graph render (200 nodes) | < 2s | Performance API |
| Filter application | < 100ms | Performance API |
| Text→Graph sync | < 200ms | Performance API |
| Bundle size | < 500KB gzip | Build output |

---

## 8. Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Monaco bundle size | Large initial load | Code splitting, lazy load editor |
| Large spec performance | Poor UX | Debounced parsing, React Flow virtualization |
| Complex schema visualization | Cluttered graph | Collapsible nested schemas, smart edge routing, Dagre layout |
| Circular references | Infinite loops | Visited set tracking, max recursion depth (10 levels) |
| YAML comment preservation | Data loss | Use eemeli/yaml which preserves comments |
| Cross-browser compatibility | Broken features | CI testing, progressive enhancement |
| Markdown in descriptions | Broken display | Use react-markdown for proper rendering |

---

## 9. Dependencies Summary

### Production Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "@xyflow/react": "^12.0.0",
    "@monaco-editor/react": "^4.6.0",
    "dagre": "^0.8.5",
    "yaml": "^2.4.0",
    "@readme/openapi-parser": "^2.6.0",
    "zustand": "^4.5.0",
    "react-markdown": "^9.0.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.3.0"
  }
}
```

### Development Dependencies

```json
{
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "prettier": "^3.2.0",
    "prettier-plugin-tailwindcss": "^0.5.0",
    "vitest": "^1.4.0",
    "@testing-library/react": "^14.2.0",
    "@testing-library/user-event": "^14.5.0",
    "jsdom": "^24.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@types/dagre": "^0.7.52"
  }
}
```

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **AST** | Abstract Syntax Tree - parsed structure of the YAML/JSON |
| **Monaco** | The code editor that powers VS Code |
| **React Flow** | React library for building node-based graphs |
| **Source Map** | Mapping between parsed entities and their text locations |
| **Zustand** | Lightweight state management library for React |
| **Node** | Visual element in the graph (endpoint or schema) |
| **Edge** | Connection between nodes (relationship) |
