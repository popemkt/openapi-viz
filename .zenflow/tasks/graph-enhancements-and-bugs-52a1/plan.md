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

Technical specification completed. See `spec.md` for full details.

**Difficulty**: Medium

**Summary of Issues**:
1. Node dragging error #015 - needs proper React Flow change handling
2. Filter display modes (hide vs highlight) - new UI option
3. High compact mode (title only) - new display level
4. Minimap not showing nodes - needs nodeColor callback
5. Animated edges on selection - edge styling enhancement
6. Missing allOf+properties connection - parser fix

---

### [x] Step: Fix Node Dragging (Bug #1)
<!-- chat-id: 0da00df4-5e62-4f88-820a-7dcba0ad3378 -->

**Goal**: Resolve React Flow error #015 when dragging nodes

**Files**: `src/features/graph/components/GraphCanvas.tsx`

**Tasks**:
1. Import `applyNodeChanges` from `@xyflow/react`
2. Refactor `handleNodesChange` to properly apply all change types
3. Keep position sync with store for persistence
4. Test that nodes can be dragged without console warnings

**Verification**:
- `pnpm typecheck`
- Manual test: drag nodes in the graph, verify no console error

---

### [x] Step: Fix Minimap Node Display (Bug #4)
<!-- chat-id: 18bac3d0-b2cb-48ae-8b5b-395fc9605aef -->

**Goal**: Make custom nodes visible in the minimap

**Files**: `src/features/graph/components/GraphCanvas.tsx`

**Tasks**:
1. Add `nodeColor` callback prop to `<MiniMap>`
2. Return appropriate colors based on node type:
   - Endpoints: Use method color (GET=green, POST=blue, etc.)
   - Schemas: Use slate color (#64748b)
3. Optionally add `nodeStrokeColor` for better visibility

**Verification**:
- Manual test: load a spec and verify minimap shows colored nodes

---

### [x] Step: Add Filter Display Modes (Enhancement #2a)
<!-- chat-id: 36a6b98d-0c3e-4d6b-95da-8449af37d7b9 -->

**Goal**: Add highlight mode as alternative to hide mode for filters

**Files**:
- `src/stores/filterStore.ts`
- `src/features/graph/hooks/useFilteredGraph.ts`
- `src/features/graph/components/EndpointNode.tsx`
- `src/features/graph/components/SchemaNode.tsx`
- `src/features/graph/components/FilterToolbar.tsx`

**Tasks**:
1. Add `filterDisplayMode: 'hide' | 'highlight'` state to filterStore
2. Modify useFilteredGraph:
   - In 'hide' mode: set `hidden: true` on non-matching (current behavior)
   - In 'highlight' mode: set `dimmed: true` in node data, `hidden: false`
3. Add dimmed styling to node components (opacity-40, grayscale)
4. Apply similar dimming to edges connecting dimmed nodes
5. Add toggle button in FilterToolbar with icon

**Verification**:
- `pnpm typecheck && pnpm lint`
- Manual test: apply filter, toggle between modes

---

### [x] Step: Add High Compact Mode (Enhancement #2b)
<!-- chat-id: d99abd29-0ea7-489e-93cd-01de51687474 -->

**Goal**: Add minimal display mode showing only node titles

**Files**:
- `src/stores/uiStore.ts`
- `src/features/graph/components/SchemaNode.tsx`
- `src/features/graph/components/EndpointNode.tsx`
- `src/features/graph/components/FilterToolbar.tsx`

**Tasks**:
1. Add `compactLevel: 'normal' | 'compact' | 'minimal'` to uiStore
   - Migrate from boolean `compactMode` to enum
2. Update SchemaNode rendering:
   - `normal`: Full display (all sections)
   - `compact`: Current compact behavior (truncated, limited props)
   - `minimal`: Header only (name + icon)
3. Update EndpointNode similarly
4. Add dropdown or segmented control in FilterToolbar

**Verification**:
- `pnpm typecheck && pnpm lint`
- Manual test: cycle through compact levels

---

### [x] Step: Add Edge Selection Animation (Enhancement #4)
<!-- chat-id: f7a8f979-5979-49eb-9002-d9c87db9f5f2 -->

**Goal**: Animate edges connected to selected nodes

**Files**:
- `src/stores/graphStore.ts`
- `src/features/graph/components/GraphCanvas.tsx`

**Tasks**:
1. Extend graphStore selection:
   - Change `selectedNodeId: string | null` to `selectedNodeIds: Set<string>`
   - Support multi-select with Shift+Click (optional)
2. In GraphCanvas, create memoized edges with selection styling:
   - For edges where source OR target is selected:
     - Set `animated: true`
     - Set `style.strokeDasharray: '5,5'`
     - Optionally increase strokeWidth
3. Animation direction is already correct (React Flow animates in source→target direction)

**Verification**:
- Manual test: click node, verify connected edges animate

---

### [x] Step: Fix Missing allOf+properties Connection (Bug #5)
<!-- chat-id: b95f1daa-37d6-4c25-b09d-c4cfde08a596 -->

**Goal**: Create edge for refs inside inline properties of allOf combined schema

**Files**: `src/core/parser/relationshipCollector.ts`

**Tasks**:
1. In `collectSchemaRelationships`, after processing `prop.allOf`:
   - Check if `prop.properties` exists
   - Iterate nested properties and collect refs ($ref, items.$ref)
2. Create relationships for any refs found in nested properties
3. This handles the pattern:
   ```yaml
   propertyName:
     allOf:
       - $ref: ...
     properties:
       value:
         items:
           $ref: '#/components/schemas/Target'  # <- this was missed
   ```

**Verification**:
- `pnpm test` - add unit test for this pattern
- Manual test: load spec with RealEstate/CadastralPlot pattern, verify edge exists

---

### [x] Step: Final Verification
<!-- chat-id: 17eb7519-39c9-46cb-96c8-d15a93091d40 -->

**Goal**: Ensure all changes work together and no regressions

**Tasks**:
1. Run full verification: `pnpm verify` (lint + typecheck + test)
2. Manual testing checklist:
   - [x] Drag nodes without errors
   - [x] Minimap shows colored nodes
   - [x] Filter highlight mode works
   - [x] Minimal compact mode works
   - [x] Edge animation on selection works
   - [x] allOf+properties edge created
3. Write report to `report.md`

**Verification Results**:
- `pnpm verify`: All 132 tests passed, lint clean, typecheck clean
- `pnpm build`: Production build successful

---

### [x] Step: Write Report
<!-- chat-id: aae33c86-8d11-41d9-88ce-16dd669c9257 -->

Write completion report to `{@artifacts_path}/report.md` describing:
- What was implemented
- How the solution was tested
- The biggest issues or challenges encountered

**Completed**: Report written to `report.md` with full details on all 6 issues implemented, testing approach, and challenges encountered.
