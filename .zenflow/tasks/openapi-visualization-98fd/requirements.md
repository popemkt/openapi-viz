# Product Requirements Document: OpenAPI Visualization Editor

## Overview

### Problem Statement
OpenAPI specifications, while powerful for API documentation and tooling, suffer from poor human readability:
- Specs are typically large (thousands of lines)
- YAML/JSON format is not intuitive for understanding API structure
- Relationships between endpoints and schemas are hard to trace
- No visual overview of the entire API surface

### Solution
A web-based editor that combines:
1. Traditional text editing for precise control
2. Interactive graph visualization for understanding structure and relationships
3. Toggleable views to focus on specific aspects (endpoints, schemas, or both)

### Target Users
- **API Developers**: Creating and maintaining OpenAPI specifications
- **Frontend Developers**: Understanding APIs they need to consume
- **Technical Writers**: Documenting and reviewing API designs

---

## Core Features

### F1: Text Editor
A full-featured code editor for direct OpenAPI spec editing.

**Requirements:**
- F1.1: Syntax highlighting for YAML and JSON formats
- F1.2: Auto-completion for OpenAPI 3.1 keywords and structures
- F1.3: Real-time validation with inline error indicators
- F1.4: Line numbers and code folding
- F1.5: Search and replace functionality
- F1.6: Undo/redo support

**Acceptance Criteria:**
- Editor loads files up to 10MB without performance degradation
- Syntax errors are highlighted within 500ms of typing
- Auto-completion suggestions appear within 200ms

### F2: Graph Visualization
Interactive visual representation of the OpenAPI spec structure.

**Requirements:**
- F2.1: Display endpoints as nodes, grouped by tags or path segments
- F2.2: Display schemas (components/schemas) as nodes
- F2.3: Show relationships between endpoints and their request/response schemas
- F2.4: Show relationships between schemas (e.g., $ref, allOf, oneOf, anyOf)
- F2.5: Visual distinction between HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.)
- F2.6: Zoom and pan controls for large graphs
- F2.7: Auto-layout with manual repositioning capability
- F2.8: Minimap for navigation in large specs

**Acceptance Criteria:**
- Graph renders within 2 seconds for specs with up to 200 endpoints
- Smooth 60fps interactions (zoom, pan, drag)
- Clear visual hierarchy even with 50+ nodes visible

### F3: Entity Filtering
Toggle visibility of different entity types in the graph.

**Requirements:**
- F3.1: Toggle endpoints visibility (show/hide all endpoints)
- F3.2: Toggle schemas visibility (show/hide all schemas)
- F3.3: Filter by HTTP method (e.g., show only GET endpoints)
- F3.4: Filter by tag (show only endpoints with specific tags)
- F3.5: Filter by path pattern (e.g., `/users/*`)
- F3.6: Search to highlight matching nodes

**Acceptance Criteria:**
- Filters apply instantly (<100ms)
- Filter state is preserved during editing session
- Clear indication of active filters

### F4: Detail Panel
Expandable details when selecting entities in the graph.

**Requirements:**
- F4.1: Click on endpoint node to show full endpoint details (path, method, parameters, request/response bodies, description)
- F4.2: Click on schema node to show full schema definition (properties, types, constraints, examples)
- F4.3: Navigate to related entities from detail panel (e.g., click on referenced schema)
- F4.4: "Jump to source" button to highlight corresponding location in text editor
- F4.5: Collapsible sections for complex nested structures

**Acceptance Criteria:**
- Details panel opens within 100ms of click
- All information from the spec is accessible in the panel
- Bidirectional navigation between graph and text editor works reliably

### F5: File Management
Load and save OpenAPI specifications.

**Requirements:**
- F5.1: Open file from local file system (file picker)
- F5.2: Drag and drop file to load
- F5.3: Save file to local file system (download)
- F5.4: Create new blank OpenAPI 3.1 spec from template
- F5.5: Recent files list (stored in browser localStorage)
- F5.6: Unsaved changes indicator and confirmation before close/navigate away

**Acceptance Criteria:**
- Supports both YAML and JSON formats
- Preserves formatting and comments when possible (for YAML)
- File operations complete within 1 second for typical specs

### F6: Portable Sharing
Enable sharing specs with colleagues without requiring a server.

**Requirements:**
- F6.1: Export current spec as shareable HTML file (self-contained with embedded viewer)
- F6.2: Copy shareable link with spec encoded in URL (for smaller specs)
- F6.3: Export graph view as PNG/SVG image

**Acceptance Criteria:**
- Exported HTML works offline in modern browsers
- URL sharing works for specs up to 50KB (URL length limits)
- Image export captures current zoom/filter state

### F7: Bidirectional Sync (Text ↔ Graph)
Keep text editor and graph visualization synchronized.

**Requirements:**
- F7.1: Changes in text editor reflect immediately in graph
- F7.2: Selecting node in graph highlights corresponding text
- F7.3: Future: Edit entities via graph UI (add endpoint, modify schema) - updates text

**Acceptance Criteria:**
- Sync delay is imperceptible (<200ms) for small changes
- Invalid YAML/JSON shows error state but doesn't crash graph
- Graph gracefully handles partial/incomplete specs during editing

---

## Technical Requirements

### T1: Technology Stack
- **Framework**: React 18+ with TypeScript (strict mode)
- **State Management**: Modular architecture (consider Zustand or Redux Toolkit)
- **Build Tool**: Vite (for fast development and optimized builds)
- **Code Quality**: ESLint, Prettier, strict TypeScript configuration

### T2: Architecture Principles
- **Modular Separation**: Clear boundaries between editor, parser, visualization, and UI components
- **Type Safety**: Strict TypeScript with comprehensive type definitions for OpenAPI structures
- **Testability**: Components designed for unit and integration testing
- **Performance**: Lazy loading, virtualization for large lists, efficient graph rendering

### T3: Browser Support
- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

### T4: Performance Targets
- Initial load: < 3 seconds on 3G connection
- Time to interactive: < 5 seconds
- Bundle size: < 500KB gzipped (initial load)

---

## User Interface

### Layout
```
┌─────────────────────────────────────────────────────────────────┐
│  Toolbar: [New] [Open] [Save] [Export] | View: [Editor] [Graph] [Split] │
├─────────────────────────────────────────────────────────────────┤
│                           │                                     │
│                           │         Graph Visualization         │
│      Text Editor          │  ┌─────────────────────────────┐   │
│                           │  │  [Filter: Endpoints ▼]      │   │
│  paths:                   │  │  [Filter: Schemas ▼]        │   │
│    /users:                │  │  [Search...]                │   │
│      get:                 │  ├─────────────────────────────┤   │
│        summary: ...       │  │                             │   │
│                           │  │    ┌───┐     ┌───┐          │   │
│                           │  │    │GET│────▶│User│         │   │
│                           │  │    └───┘     └───┘          │   │
│                           │  │                             │   │
│                           │  └─────────────────────────────┘   │
│                           │                                     │
├─────────────────────────────────────────────────────────────────┤
│  Detail Panel (expandable): Endpoint: GET /users                │
│  Parameters: page (query), limit (query)                        │
│  Response 200: UserList schema [Jump to schema] [Jump to source]│
└─────────────────────────────────────────────────────────────────┘
```

### View Modes
1. **Editor Only**: Full-width text editor
2. **Graph Only**: Full-width visualization
3. **Split View**: Side-by-side (default, resizable)

---

## Out of Scope (Future Considerations)

1. **Authentication Flow Visualization**: Diagram security schemes and OAuth flows
2. **API Testing**: Send requests directly from the editor
3. **Diff View**: Compare two versions of a spec
4. **Collaborative Editing**: Real-time multi-user editing
5. **Server Component**: Backend for storage, team features
6. **OpenAPI 3.0 / Swagger 2.0 Support**: May add via automatic conversion
7. **Code Generation**: Generate client/server stubs
8. **Mock Server**: Generate mock responses from spec

---

## Success Metrics

1. **Usability**: Users can understand an unfamiliar API's structure in under 2 minutes
2. **Performance**: No perceivable lag when editing specs under 5000 lines
3. **Adoption**: Positive feedback on readability improvement vs raw YAML/JSON

---

## Assumptions & Decisions

1. **Local-first**: No server required; all processing happens in browser
2. **OpenAPI 3.1 only**: Focus on latest spec version for MVP; older versions can be converted externally
3. **Read-first visualization**: Graph editing (F7.3) is future scope; MVP focuses on visualization with text-based editing
4. **Modern browsers only**: No IE11 or legacy browser support

---

## Glossary

- **OpenAPI**: A specification for describing REST APIs (formerly Swagger)
- **Endpoint**: A combination of HTTP method and path (e.g., GET /users)
- **Schema**: A data structure definition in components/schemas
- **Tag**: A grouping mechanism for endpoints in OpenAPI
- **$ref**: A JSON reference used to link to reusable components
