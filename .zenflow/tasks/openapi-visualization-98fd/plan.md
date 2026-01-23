# Full SDD workflow

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Workflow Steps

### [x] Step: Requirements
<!-- chat-id: def01758-d094-47f0-9f41-7ce58cdff9bb -->

Create a Product Requirements Document (PRD) based on the feature description.

1. Review existing codebase to understand current architecture and patterns
2. Analyze the feature definition and identify unclear aspects
3. Ask the user for clarifications on aspects that significantly impact scope or user experience
4. Make reasonable decisions for minor details based on context and conventions
5. If user can't clarify, make a decision, state the assumption, and continue

Save the PRD to `{@artifacts_path}/requirements.md`.

### [x] Step: Technical Specification
<!-- chat-id: 336f5e7d-de28-4372-996a-c52b0bc8967a -->

Create a technical specification based on the PRD in `{@artifacts_path}/requirements.md`.

1. Review existing codebase architecture and identify reusable components
2. Define the implementation approach

Save to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach referencing existing code patterns
- Source code structure changes
- Data model / API / interface changes
- Delivery phases (incremental, testable milestones)
- Verification approach using project lint/test commands

### [x] Step: Planning
<!-- chat-id: 9f2a091e-a840-4901-b1c6-aebfdfc7dce5 -->

Create a detailed implementation plan based on `{@artifacts_path}/spec.md`.

1. Break down the work into concrete tasks
2. Each task should reference relevant contracts and include verification steps
3. Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function) or too broad (entire feature).

If the feature is trivial and doesn't warrant full specification, update this workflow to remove unnecessary steps and explain the reasoning to the user.

Save to `{@artifacts_path}/plan.md`.


### [x] Step: Implement
<!-- chat-id: ac60a7e8-17ab-44ae-afff-628b5caccd1d -->
<!-- agent: claude-code -->
## Implementation Tasks

### Phase 1: Foundation (MVP Core)

- [x] ### Step: Project Initialization
  Initialize the project using pnpm, setup Tailwind CSS, install all core dependencies, and establish the project structure.
  - Run `pnpm create vite@latest . -- --template react-ts`
  - Install production dependencies: `pnpm install @xyflow/react @monaco-editor/react yaml @readme/openapi-parser zustand clsx tailwind-merge dagre react-markdown lucide-react`
  - Install development dependencies: `pnpm install -D @types/dagre vitest @testing-library/react @testing-library/jest-dom @vitejs/plugin-react jsdom tailwindcss postcss autoprefixer`
  - Run `npx tailwindcss init -p`
  - Setup ESLint and Prettier.
  - Create the directory structure: `src/{components,hooks,store,core,types,assets}`.
  - **Verification**: Run `pnpm build` to ensure the scaffolded project compiles.

- [x] ### Step: State Management & Layout
  Implement the basic application shell and the full state management architecture.
  - Create `uiStore.ts`, `specStore.ts`, `graphStore.ts`, and `filterStore.ts` using Zustand.
  - Implement the main layout with a toolbar and a split-view resizable panel system.
  - **Verification**: Use React DevTools to verify all four stores are initialized and accessible.

- [x] ### Step: Text Editor Integration
  Integrate the Monaco editor for spec editing.
  - Create the `TextEditor` component using `@monaco-editor/react`.
  - Implement synchronization between the editor content and `specStore`.
  - **Verification**: Typing in the editor updates the `specStore` state.

- [x] ### Step: OpenAPI Parser (Web Worker) & Validator
  Implement robust, non-blocking parsing and validation using Web Workers.
  - Create `src/core/parser/worker.ts` to handle parsing logic using `@readme/openapi-parser`.
  - Implement `core/parser/parseSpec.ts` to communicate with the worker.
  - Ensure real-time parsing and error reporting (validation) in the `specStore`.
  - **Verification**: Test with a large (5MB+) OpenAPI spec to ensure the UI remains responsive during parsing.

- [x] ### Step: Graph Visualization Foundation
  Setup the graph canvas and custom nodes.
  - Setup React Flow in `GraphCanvas.tsx`.
  - Implement `EndpointNode.tsx` and `SchemaNode.tsx` custom components.
  - **Verification**: Manually add custom nodes to the canvas to verify rendering and styling.

- [x] ### Step: Graph Builder Logic (with Dagre & Circular Ref Handling)
  Implement the transformation from spec to graph with automatic layout and circular reference safety.
  - Implement `core/graph-builder/buildGraph.ts` with circular reference detection.
  - Integrate `Dagre` for automatic node positioning and layouting.
  - **Verification**: Pass a spec with circular `$ref` dependencies and verify the graph builds without infinite loops and Dagre positions nodes orderly.

### Phase 2: Interactivity

- [x] ### Step: Bidirectional Synchronization
  Implement seamless navigation between the text editor and the graph.
  - Implement logic to map graph nodes to line numbers (`textToPosition.ts`) and vice versa.
  - Ensure selecting a node scrolls the editor to the relevant definition.
  - **Verification**: Clicking a "User" schema node in the graph scrolls the Monaco editor to `components/schemas/User`.

- [x] ### Step: Detail Panel Implementation
  Create the detail panel for deep-diving into spec entities with Markdown support.
  - Implement `DetailPanel.tsx` using `react-markdown` for descriptions.
  - Add "Jump to source" and cross-reference navigation within the panel.
  - **Verification**: Verify that descriptions in the spec are rendered correctly as Markdown in the panel.

- [x] ### Step: Graph Controls & Search
  Enhance graph navigation and searchability.
  - Add Minimap, Controls (zoom/fit), and a search bar in the toolbar to highlight nodes.
  - **Verification**: Searching for an endpoint path highlights the corresponding node on the canvas.

### Phase 3: File Management & Polish

- [x] ### Step: File Operations
  Implement standard file handling.
  - Add Open, Save, and New functionality to the toolbar.
  - Implement drag-and-drop file loading and unsaved changes warnings.
  - **Verification**: Successfully open a local `.yaml` file, edit it, and save the changes.

- [x] ### Step: UI Polish & Enhanced Visualization
  Refine the look and feel and add descriptive visualization elements.
  - Add method-based coloring for endpoint nodes.
  - Add labels to graph edges to clarify relationships (e.g., "references", "returns").
  - **Verification**: Visual audit of the graph to ensure clear distinction between methods and relationship types.

### Phase 4: Sharing & Export

- [x] ### Step: Export Functionality
  Implement ways to share the spec and visualization.
  - Implement self-contained HTML export.
  - Implement PNG/SVG image export of the current graph view.
  - **Verification**: Export the graph as a PNG and verify the image quality and content.

- [x] ### Step: Advanced Filtering
  Add powerful filtering options to the graph view.
  - Implement filtering by HTTP methods, tags, and path patterns in the `filterStore`.
  - **Verification**: Filter for `GET` requests and verify that only `GET` endpoint nodes are visible.
