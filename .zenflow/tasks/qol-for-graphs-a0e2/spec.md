# Technical Specification: QoL for Graphs

## Task Overview

Implement quality-of-life improvements for the OpenAPI graph visualization tool:
1. Add "Select Highlighted" action in highlight filter mode
2. Add node header size scaling option (industry standard research)
3. Add layout algorithm options (spacing controls)
4. Analyze bundle size impact of additional layout algorithms

## Difficulty Assessment: **Medium**

- Multiple related features with moderate complexity
- Requires UI/UX design decisions for new controls
- Some performance considerations for layout algorithms
- Need to maintain existing filter/highlight behavior while extending it

---

## Technical Context

### Current Stack
- **Framework**: React 19 + TypeScript 5.9
- **Graph Library**: @xyflow/react v12.10.0 (React Flow)
- **Layout**: dagre 0.8.5 (hierarchical layout)
- **State Management**: Zustand 5
- **Styling**: Tailwind CSS 4.0
- **Build**: Vite 7 with esbuild minification

### Current Bundle Size
```
dist/index.html                          0.80 kB
dist/assets/graph.worker-DGIczWNL.js   104.42 kB
dist/assets/parser.worker-C6eflbg3.js  486.75 kB
dist/assets/index-BwMN78I7.css          67.58 kB │ gzip:  12.17 kB
dist/assets/index-DUsj_32Y.js          856.32 kB │ gzip: 273.80 kB
```
Total main bundle: ~856 KB minified (~274 KB gzipped)

### Relevant Files
- `src/features/graph/components/FilterToolbar.tsx` - Filter UI controls
- `src/features/graph/components/BulkActionsToolbar.tsx` - Selection action toolbar
- `src/features/graph/hooks/useFilteredGraph.ts` - Filter/highlight logic
- `src/stores/filterStore.ts` - Filter state
- `src/stores/graphStore.ts` - Graph/selection state
- `src/stores/uiStore.ts` - UI preferences (persisted)
- `src/core/graph-builder/layout.ts` - Dagre layout algorithm
- `src/features/graph/components/EndpointNode.tsx` - Endpoint node display
- `src/features/graph/components/SchemaNode.tsx` - Schema node display

---

## Feature 1: Select Highlighted Items

### Requirements
When filter display mode is "highlight" (non-matching nodes are dimmed), add a button to **select all highlighted (non-dimmed) nodes**. This enables bulk actions on filtered results.

### Implementation Approach

1. **Add "Select Highlighted" button to FilterToolbar**
   - Only visible when `filterDisplayMode === 'highlight'`
   - Position near the filter mode toggle for logical grouping
   - Icon: `CheckSquareIcon` or `MousePointer2Icon` from lucide-react

2. **Add `selectHighlighted` action to graphStore**
   - Selects all nodes where `visible: true` and `dimmed: false`
   - Needs access to filtered node state from `useFilteredGraph`

3. **Alternative: Use existing graph store + filter store**
   - Compute highlighted node IDs in the action handler
   - Re-run same filter logic used in `useFilteredGraph`

### Data Flow
```
FilterToolbar -> selectHighlighted() -> graphStore.setSelectedNodeIds(highlightedIds)
```

### Files to Modify
- `src/stores/graphStore.ts` - Add `selectHighlighted(highlightedNodeIds: string[])` action
- `src/features/graph/components/FilterToolbar.tsx` - Add select button with onClick handler
- `src/features/graph/hooks/useFilteredGraph.ts` - Export a utility to get matching node IDs (or compute inline)

---

## Feature 2: Node Header Size Scaling

### Requirements
Allow users to adjust node size/scale since at certain zoom levels, node text becomes too small to read.

### Industry Standard Research

Based on research from [Cytoscape.js](https://js.cytoscape.org/) and [React Flow documentation](https://reactflow.dev/learn/layouting/layouting):

1. **Semantic Zoom (Most Common)**
   - Different detail levels shown at different zoom levels
   - At low zoom: show only essential info (icon, abbreviated label)
   - At high zoom: show full details
   - **Already implemented via `compactLevel` (normal/compact/minimal)**

2. **Fixed-Size Elements Option**
   - Some tools allow nodes to maintain constant screen size regardless of zoom
   - Implemented via CSS `transform: scale(1/zoom)` on node contents
   - Trade-off: loses spatial context at low zoom

3. **Min/Max Node Constraints**
   - Set minimum readable size and maximum size
   - Nodes scale within these bounds

4. **User-Adjustable Base Font Size**
   - Simple slider to scale all text proportionally
   - Easy to implement, user-controlled

### Recommended Implementation

Add a **Node Scale slider** (0.75x - 2.0x) that scales the base node dimensions:

1. **Add `nodeScale` to uiStore** (persisted)
   - Default: 1.0
   - Range: 0.75 - 2.0 (step 0.25)

2. **Apply scale to node components**
   - Scale `maxNodeWidth` by `nodeScale`
   - Scale font sizes in node components
   - Scale layout `nodeWidth`/`nodeHeight` parameters

3. **Add UI control in Display Settings dropdown**
   - Slider or radio buttons for scale presets
   - Label: "Node Size" with values like "Small (0.75x)", "Normal (1x)", "Large (1.5x)", "Extra Large (2x)"

### Files to Modify
- `src/stores/uiStore.ts` - Add `nodeScale` state
- `src/features/graph/components/FilterToolbar.tsx` - Add scale control in settings dropdown
- `src/features/graph/components/EndpointNode.tsx` - Apply scale to dimensions/fonts
- `src/features/graph/components/SchemaNode.tsx` - Apply scale to dimensions/fonts
- `src/core/graph-builder/layout.ts` - Consider scale in layout calculations

---

## Feature 3: Layout Options

### Requirements
Provide layout customization options (spacing, direction, algorithm) similar to popular graph applications.

### Popular Graph App Comparison

| App | Layout Features |
|-----|-----------------|
| **Cytoscape** | Multiple algorithms (dagre, cola, cose, grid), spacing sliders, direction |
| **yEd** | Hierarchical, organic, orthogonal, circular, tree layouts |
| **Gephi** | Force-directed, ForceAtlas2, Yifan Hu, spacing |
| **Draw.io** | Auto-layout direction, spacing controls |

### Recommended Implementation

#### Phase 1: Expose Dagre Parameters (Minimal Complexity)

1. **Add layout settings to uiStore** (persisted):
   ```typescript
   layoutDirection: 'LR' | 'TB' | 'RL' | 'BT'  // default: 'LR'
   rankSpacing: number  // default: 100, range: 50-300
   nodeSpacing: number  // default: 50, range: 20-150
   ```

2. **Add Layout Settings section in Display Settings dropdown or separate dropdown**:
   - Direction: Left-to-Right, Top-to-Bottom, Right-to-Left, Bottom-to-Top
   - Rank Spacing (vertical between layers): Small/Medium/Large or slider
   - Node Spacing (horizontal within layers): Small/Medium/Large or slider

3. **Trigger relayout on settings change**
   - Option A: Auto-relayout when settings change
   - Option B: Manual "Apply Layout" button

#### Phase 2: Additional Layout Algorithms (Future, Optional)

**NOT recommended for this task** due to bundle size impact:

| Algorithm | Bundle Size Impact | Value |
|-----------|-------------------|-------|
| D3-Force | ~15 KB gzipped | Organic layouts, good for exploration |
| ELK.js | ~1.3 MB | Too large, significant bundle bloat |
| Cola.js | ~50 KB | Constraint-based, moderate value |

**Recommendation**: Stick with Dagre for now. The existing 274 KB gzipped bundle is already at the warning threshold. Adding ELK.js would nearly double the bundle size.

If additional algorithms are desired in the future:
- Use dynamic imports to load on-demand
- Consider web worker for computation
- D3-Force is the best cost/benefit ratio

### Files to Modify
- `src/stores/uiStore.ts` - Add layout settings state
- `src/features/graph/components/FilterToolbar.tsx` - Add layout controls UI
- `src/core/graph-builder/layout.ts` - Read settings from store, apply to Dagre
- `src/stores/graphStore.ts` - Trigger relayout on settings change (if auto-relayout)

---

## Feature 4: Bundle Size Analysis

### Current State
- Main JS bundle: 856 KB minified, 274 KB gzipped
- Graph worker: 104 KB (includes dagre)
- Parser worker: 487 KB (includes OpenAPI parser)

### Impact of Additional Layout Algorithms

| Change | Size Impact | Notes |
|--------|-------------|-------|
| Current (Dagre only) | Baseline | ~30-40 KB for dagre |
| + D3-Force | +15 KB gzipped | Moderate, acceptable |
| + Cola.js | +50 KB gzipped | Moderate-high |
| + ELK.js | +300-400 KB gzipped | **Unacceptable** - would nearly double bundle |

### Recommendations

1. **Dagre spacing controls add 0 KB** - just exposing existing parameters
2. **Node scale controls add ~0 KB** - pure CSS/state changes
3. **Select highlighted adds ~0.5 KB** - minimal new code
4. **D3-Force (future)**: Consider dynamic import if needed
5. **ELK.js**: Do not add unless absolutely necessary and use dynamic import

### Optimization Opportunities (Out of Scope)
- Code-split Monaco editor (large dependency)
- Move OpenAPI parser fully to worker (already done)
- Add `manualChunks` for vendor separation

---

## Implementation Plan

### Step 1: Select Highlighted Feature
- Add `selectMatchingNodes` action to graphStore
- Add "Select Highlighted" button to FilterToolbar
- Only show when `filterDisplayMode === 'highlight'` and filters are active

### Step 2: Layout Spacing Controls
- Add layout settings to uiStore (`layoutDirection`, `rankSpacing`, `nodeSpacing`)
- Update `applyDagreLayout` to use these settings
- Add Layout Settings UI in FilterToolbar settings dropdown
- Wire up relayout trigger

### Step 3: Node Scale Control
- Add `nodeScale` to uiStore
- Add scale UI control in settings dropdown
- Apply scale to EndpointNode and SchemaNode dimensions

### Step 4: Testing & Verification
- Verify select highlighted works with various filter combinations
- Test layout changes apply correctly
- Test node scale at various levels
- Run existing tests
- Check bundle size hasn't increased significantly

---

## Verification Approach

1. **Lint & Typecheck**: `pnpm lint && pnpm typecheck`
2. **Tests**: `pnpm test`
3. **Manual Testing**:
   - Apply filters in highlight mode → click "Select Highlighted" → verify correct nodes selected
   - Change layout direction/spacing → verify graph relayouts correctly
   - Adjust node scale → verify readability improves at zoom out
4. **Bundle Size**: `pnpm build` → verify bundle size hasn't grown significantly

---

## API/Interface Changes

### New uiStore State
```typescript
// Layout settings
layoutDirection: 'LR' | 'TB' | 'RL' | 'BT'
rankSpacing: number  // 50-300
nodeSpacing: number  // 20-150

// Node display
nodeScale: number  // 0.75-2.0
```

### New graphStore Actions
```typescript
selectMatchingNodes: (matchingNodeIds: string[]) => void
```

### New UI Components
- "Select Highlighted" button in FilterToolbar (conditional)
- Layout Settings section in Display Settings dropdown
- Node Scale control in Display Settings dropdown

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Layout changes cause jank | Debounce relayout, show loading indicator |
| Node scale breaks layout overlap | Adjust layout dimensions alongside scale |
| Select highlighted misses edge cases | Reuse exact filter logic from useFilteredGraph |
| Bundle size creep | Avoid adding new heavy dependencies |

---

## Out of Scope

- Additional layout algorithms (ELK, D3-Force, Cola) - bundle size concern
- Automatic semantic zoom based on zoom level
- Node clustering/grouping
- Export layout presets
- Undo/redo for layout changes
