# Technical Specification: Graph Enhancements and Bugs

## Difficulty Assessment: Medium

This task involves multiple moderate-complexity changes across the graph visualization system:
- Fixing a React Flow node initialization bug (requires understanding React Flow internals)
- Adding filter mode options (UI + state management + styling)
- Implementing high-compact mode for schema nodes
- Fixing minimap node rendering (React Flow custom node integration)
- Implementing animated edge selection (CSS + React Flow edge configuration)
- Fixing a missing relationship edge case in the parser (nested allOf with properties)

---

## Technical Context

### Language & Framework
- **TypeScript** + **React 19**
- **@xyflow/react** v12.10.0 (React Flow)
- **Zustand** for state management
- **Tailwind CSS** for styling
- **Vite** for bundling

### Key Dependencies
- `@xyflow/react`: Graph visualization library
- `zustand`: State management with persistence
- `dagre`: Automatic graph layout
- `lucide-react`: Icons

---

## Issues to Resolve

### Issue 1: Node Dragging Error #015

**Problem**: When trying to drag a node, React Flow warns:
> "It seems that you are trying to drag a node that is not initialized."

**Root Cause Analysis**:
Looking at `GraphCanvas.tsx:40-69`, the `handleNodesChange` callback only handles position changes. However, React Flow requires the callback to also process **initialization changes** (`change.type === 'init'` or similar). When nodes are first rendered, React Flow sends initialization events that must be processed to mark nodes as "measured" internally.

The current implementation filters to only position changes:
```typescript
const positionChanges = changes.filter(
  (change): change is NodeChange & { type: 'position' } =>
    change.type === 'position' && 'position' in change
);
```

**Solution**: Use `applyNodeChanges` from React Flow to properly handle all change types, including `add`, `remove`, `dimensions`, and initialization changes. The custom position update logic can be maintained but should use React Flow's standard approach.

**Files to modify**:
- `src/features/graph/components/GraphCanvas.tsx`

---

### Issue 2: Filter Mode Options (Highlight vs Hide)

**Problem**: Currently, filtered nodes are hidden. User wants two modes:
1. **Hide mode** (current behavior): Non-matching nodes are removed from view
2. **Highlight mode** (new): Non-matching nodes are dimmed, matching nodes highlighted

**Current Implementation**:
- `useFilteredGraph.ts` sets `hidden: !visible` on non-matching nodes
- Nodes with `hidden: true` are not rendered by React Flow

**Solution**:
1. Add `filterDisplayMode: 'hide' | 'highlight'` to `filterStore.ts`
2. Modify `useFilteredGraph.ts` to:
   - In 'hide' mode: Keep current behavior (`hidden: true`)
   - In 'highlight' mode: Set `hidden: false` but add `dimmed: true` to node data
3. Modify `EndpointNode.tsx` and `SchemaNode.tsx` to apply dimmed styling (opacity, grayscale)
4. Modify edge styling similarly - dimmed edges when both nodes are dimmed
5. Add toggle in `FilterToolbar.tsx`

**Files to modify**:
- `src/stores/filterStore.ts` - Add `filterDisplayMode` state
- `src/features/graph/hooks/useFilteredGraph.ts` - Implement highlight mode logic
- `src/features/graph/components/EndpointNode.tsx` - Add dimmed styling
- `src/features/graph/components/SchemaNode.tsx` - Add dimmed styling
- `src/features/graph/components/FilterToolbar.tsx` - Add mode toggle UI

---

### Issue 3: High Compact Schema Display (Title Only)

**Problem**: User wants an even more compact schema display mode showing only the title.

**Current Implementation**:
- `compactMode: boolean` in `uiStore.ts` controls width constraints and name truncation
- `SchemaNode.tsx` always shows: header, composition badges, properties preview, description

**Solution**:
1. Add `schemaCompactLevel: 'normal' | 'compact' | 'minimal'` to `uiStore.ts`
2. Modify `SchemaNode.tsx`:
   - `normal`: Full display (current behavior when compactMode=false)
   - `compact`: Current compactMode behavior
   - `minimal`: Only header with name, hide all other sections
3. Add UI control in `FilterToolbar.tsx` or display settings dropdown

**Files to modify**:
- `src/stores/uiStore.ts` - Replace/extend `compactMode` with `schemaCompactLevel`
- `src/features/graph/components/SchemaNode.tsx` - Conditional rendering based on level
- `src/features/graph/components/EndpointNode.tsx` - Apply same logic for consistency
- `src/features/graph/components/FilterToolbar.tsx` - Add compact level control

---

### Issue 4: Minimap Not Showing Custom Nodes

**Problem**: The React Flow MiniMap doesn't display the custom endpoint and schema nodes.

**Root Cause Analysis**:
Looking at `GraphCanvas.tsx:102-107`:
```tsx
<MiniMap
  nodeStrokeWidth={3}
  pannable
  zoomable
  className="!bg-card !border-border"
/>
```

The MiniMap requires either:
1. `nodeColor` prop to define colors for node types, OR
2. `nodeComponent` prop to render custom minimap nodes

Currently neither is provided, so the minimap renders default styling which may not be visible.

**Solution**:
Add `nodeColor` callback that returns appropriate colors based on node type:
```tsx
nodeColor={(node) => {
  if (node.type === 'endpoint') {
    return METHOD_COLORS[endpoint.method].hex; // or a default
  }
  if (node.type === 'schema') {
    return '#64748b'; // slate for schemas
  }
  return '#94a3b8'; // default slate
}}
```

**Files to modify**:
- `src/features/graph/components/GraphCanvas.tsx` - Add `nodeColor` prop to MiniMap

---

### Issue 5: Animated Edges on Node Selection

**Problem**: When selecting node(s), connecting edges should show flowing dashed animation in the arrow direction.

**Current Implementation**:
- `selectedNodeId` tracked in `graphStore.ts`
- Only circular edges have `animated: true` in `edgeBuilder.ts`
- Node selection applies ring styling, but no edge highlighting

**Solution**:
1. Extend selection to support multiple nodes: `selectedNodeIds: Set<string>` in `graphStore.ts`
2. In `GraphCanvas.tsx`, pass `selectedNodeIds` to the edges filtering/styling
3. Create a memoized edge list that applies:
   - `animated: true` for edges connected to selected nodes
   - `strokeDasharray: '5,5'` for dashed appearance
   - Increased `strokeWidth` for visibility
4. Edge animation direction is already correct (flows source→target, same as arrow)

**Files to modify**:
- `src/stores/graphStore.ts` - Support multi-select with `selectedNodeIds: Set<string>`
- `src/features/graph/components/GraphCanvas.tsx` - Apply animated styling to selection edges

---

### Issue 6: Missing Connection (Nested allOf with properties)

**Problem**: The parser doesn't create a connection between schemas in this pattern:
```yaml
RealEstate:
  type: object
  properties:
    cadastralPlots:
      allOf:
        - $ref: '#/components/schemas/PropertyMetadata'
      properties:
        value:
          type: array
          items:
            $ref: '#/components/schemas/CadastralPlot'
```

The connection `RealEstate → CadastralPlot` is missing because:
1. `collectSchemaRelationships` handles `prop.allOf` for nested allOf
2. BUT it doesn't look at **sibling `properties`** within the allOf combined schema

**Root Cause**:
In `relationshipCollector.ts:103-117`, when processing property-level `allOf`:
```typescript
if (prop.allOf) {
  collectCompositionRelationships(schema.name, prop.allOf, 'schema-allOf', relationships, propName);
}
// Recursively collect from nested items schema
if (prop.items && !prop.items.$ref) {
  collectSchemaRelationships(prop.items, relationships);
}
```

The code handles `prop.allOf` but doesn't examine if the property itself has `properties` containing refs (the OpenAPI spec allows combining allOf with additional inline properties).

**Solution**:
After processing `prop.allOf`, also check if `prop.properties` exists and recursively collect refs from it. This is a combined schema pattern where allOf merges with inline properties.

Add in `collectSchemaRelationships`:
```typescript
// Handle property-level properties (merged with allOf)
if (prop.properties) {
  for (const [nestedPropName, nestedProp] of Object.entries(prop.properties)) {
    // Check for direct refs
    if (nestedProp.$ref) { ... }
    // Check for array items refs
    if (nestedProp.items?.$ref) { ... }
    // ... similar to main property processing
  }
}
```

**Files to modify**:
- `src/core/parser/relationshipCollector.ts` - Handle nested properties in allOf combined schema

---

## Implementation Plan

The plan.md will be updated with the following concrete steps:

### Step 1: Fix Node Dragging (Issue #1)
- Refactor `handleNodesChange` to use `applyNodeChanges` from React Flow
- Maintain store sync for persisted positions
- Test dragging works without error

### Step 2: Fix Minimap (Issue #4)
- Add `nodeColor` callback to MiniMap component
- Define colors based on node type (method colors for endpoints, slate for schemas)
- Verify minimap displays nodes correctly

### Step 3: Add Filter Display Modes (Issue #2)
- Add `filterDisplayMode` to filterStore
- Implement highlight mode in useFilteredGraph
- Add dimmed styling to node components
- Add toggle UI in FilterToolbar

### Step 4: Add High Compact Mode (Issue #3)
- Add `schemaCompactLevel` to uiStore (or extend compactMode)
- Implement minimal mode rendering in SchemaNode/EndpointNode
- Add UI control in display settings

### Step 5: Implement Edge Selection Animation (Issue #5)
- Extend graphStore for multi-select
- Apply animated styling to edges of selected nodes
- Ensure animation direction matches arrow direction

### Step 6: Fix Missing allOf+properties Connection (Issue #6)
- Update relationshipCollector to handle nested properties in allOf
- Add test case for this pattern
- Verify edge is created

---

## Verification Approach

1. **Type checking**: `pnpm typecheck`
2. **Linting**: `pnpm lint`
3. **Unit tests**: `pnpm test`
4. **Manual testing**:
   - Load an OpenAPI spec with the RealEstate/CadastralPlot pattern
   - Verify drag works without console errors
   - Verify minimap shows colored nodes
   - Test filter highlight vs hide modes
   - Test compact levels
   - Select nodes and verify edge animation

---

## Data Model Changes

### filterStore.ts
```typescript
// Add new state
filterDisplayMode: 'hide' | 'highlight';
setFilterDisplayMode: (mode: 'hide' | 'highlight') => void;
```

### uiStore.ts
```typescript
// Add or replace
schemaCompactLevel: 'normal' | 'compact' | 'minimal';
setSchemaCompactLevel: (level: 'normal' | 'compact' | 'minimal') => void;
```

### graphStore.ts
```typescript
// Replace single selection with multi-select
selectedNodeIds: Set<string>;
selectNode: (id: string | null, additive?: boolean) => void;
selectNodes: (ids: string[]) => void;
clearSelection: () => void;
```

---

## No API Changes

This is a frontend-only application with no backend API. All changes are to the React components, hooks, and stores.
