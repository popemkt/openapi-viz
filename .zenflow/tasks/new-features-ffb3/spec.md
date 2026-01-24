# Technical Specification: Advanced Selection & Bulk Actions

## Difficulty Assessment: **Hard**

This task involves:
- Complex state management changes across multiple stores
- React Flow API integration (marquee selection, selection change handlers)
- New UI components with animations
- Layout strategy with position persistence
- Editor sync for source highlighting
- Multiple interacting features that must work cohesively

---

## 1. Technical Context

### Stack
- **Framework**: React 19 + TypeScript 5.9
- **State Management**: Zustand 5.0 (with persistence middleware)
- **Graph Library**: @xyflow/react 12.10 (React Flow)
- **UI Components**: Radix UI (dialog, dropdown, toggle, tooltip)
- **Editor**: Monaco Editor (@monaco-editor/react 4.7)
- **Styling**: Tailwind CSS 4.1
- **Build**: Vite 7.2
- **Testing**: Vitest

### Relevant Dependencies
```json
{
  "@xyflow/react": "^12.10.0",
  "@radix-ui/react-dropdown-menu": "^2.1.16",
  "@radix-ui/react-tooltip": "^1.2.8",
  "zustand": "^5.0.10",
  "dagre": "^0.8.5"
}
```

---

## 2. Current Architecture Analysis

### Existing Selection System
- `selectedNodeIds: Set<string>` in graphStore already supports multi-selection
- `selectNode(id, additive)` handles Shift+Click toggle logic
- Delete/Backspace key hides selected nodes via `hideNodes()`
- Selection styling applied via `selected` prop on React Flow nodes

### Existing Visibility System
- `hiddenNodeIds: Set<string>` tracks manually hidden nodes
- `useFilteredGraph` respects `hiddenNodeIds` and applies `hidden: true`
- `showAllHiddenNodes()` exists but no individual unhide

### Existing Layout System
- `layout: { positions, zoom, pan }` stores positions
- `updateNodePosition(id, position)` called on drag end
- No "base layout" or auto-layout toggle concept exists

### Gaps to Address
1. No marquee (box) selection support
2. No `onSelectionChange` sync with React Flow
3. No bulk actions UI
4. No "Focus" functionality (show only selection + neighbors)
5. No animated layout transitions
6. No source highlighting for selections
7. No auto-layout toggle

---

## 3. Implementation Approach

### 3.1 Graph State Management (graphStore.ts)

**New State Fields:**
```typescript
interface GraphState {
  // ... existing

  // Layout persistence
  baseLayout: Record<string, { x: number; y: number }>; // Canonical positions
  isAutoLayoutEnabled: boolean; // Toggle for auto-layout on changes
}
```

**New Methods:**
```typescript
// Bulk visibility
toggleVisibility: (ids: string[]) => void;  // Toggle hidden state for multiple nodes
focusOnNodes: (ids: string[]) => void;      // Hide all except ids and their neighbors

// Layout
saveBaseLayout: () => void;                  // Snapshot current positions as base
restoreBaseLayout: () => void;               // Restore positions from base
setAutoLayout: (enabled: boolean) => void;

// Selection utilities
selectAll: () => void;                       // Select all visible nodes
invertSelection: () => void;                 // Invert current selection
selectConnected: (ids: string[]) => void;    // Expand selection to connected nodes
```

### 3.2 Graph Canvas Enhancement (GraphCanvas.tsx)

**React Flow Props to Add:**
```tsx
<ReactFlow
  // ... existing

  // Marquee selection
  selectionOnDrag={true}
  selectionMode={SelectionMode.Partial}

  // Selection sync
  onSelectionChange={handleSelectionChange}

  // Multi-select key
  multiSelectionKeyCode={['Shift', 'Meta', 'Control']}

  // Prevent pane drag during selection
  panOnDrag={[1, 2]} // Only middle/right mouse

  // Connection for keyboard shortcuts
  onKeyDown={handleKeyDown}
/>
```

**Selection Change Handler:**
```typescript
const handleSelectionChange = useCallback(
  ({ nodes }: OnSelectionChangeParams) => {
    const newSelection = new Set(nodes.map(n => n.id));
    // Only update if changed to avoid infinite loops
    if (!setsEqual(newSelection, selectedNodeIds)) {
      setSelectedNodeIds(newSelection);
    }
  },
  [selectedNodeIds, setSelectedNodeIds]
);
```

### 3.3 Bulk Actions Toolbar (NEW Component)

**Location**: `src/features/graph/components/BulkActionsToolbar.tsx`

**Design:**
- Floating toolbar at bottom-center of canvas
- Only visible when `selectedNodeIds.size > 0`
- Smooth fade-in/out animation
- Uses existing Radix UI patterns

**Actions:**
| Action | Icon | Description |
|--------|------|-------------|
| Hide | EyeOff | Hide selected nodes |
| Focus | Target | Hide all except selection + neighbors |
| Expand | Maximize2 | Select all connected nodes recursively |
| Relayout | LayoutGrid | Run Dagre on visible nodes |
| Clear | X | Clear selection |
| Unhide All | Eye | Show all hidden nodes |

**Implementation Pattern:**
```tsx
export function BulkActionsToolbar() {
  const { selectedNodeIds, hiddenNodeIds } = useGraphStore();

  if (selectedNodeIds.size === 0 && hiddenNodeIds.size === 0) {
    return null;
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-1 rounded-lg border bg-card p-1 shadow-lg">
        {selectedNodeIds.size > 0 && (
          <>
            <ActionButton icon={EyeOff} label="Hide" onClick={handleHide} />
            <ActionButton icon={Target} label="Focus" onClick={handleFocus} />
            <ActionButton icon={Maximize2} label="Expand" onClick={handleExpand} />
            <Separator orientation="vertical" />
            <ActionButton icon={X} label="Clear" onClick={handleClear} />
          </>
        )}
        {hiddenNodeIds.size > 0 && (
          <ActionButton icon={Eye} label="Unhide All" onClick={handleUnhideAll} />
        )}
        <Separator orientation="vertical" />
        <ActionButton icon={LayoutGrid} label="Relayout" onClick={handleRelayout} />
      </div>
    </div>
  );
}
```

### 3.4 Layout Strategy

**Problem**: Hiding nodes causes jarring repositioning if auto-layout is enabled.

**Solution**: "Stable Positions" as Default
1. Hiding a node just makes it invisible - other nodes stay put
2. Manual "Relayout" button packs visible nodes efficiently
3. Animated transitions using React Flow's built-in animation

**Implementation:**
```typescript
// In graphStore
const applyDagreLayout = (nodes: GraphNode[], edges: GraphEdge[]) => {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 100 });

  nodes.forEach(node => {
    g.setNode(node.id, { width: node.width ?? 200, height: node.height ?? 100 });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map(node => {
    const pos = g.node(node.id);
    return { ...node, position: { x: pos.x - pos.width / 2, y: pos.y - pos.height / 2 } };
  });
};
```

**Animated Transitions:**
React Flow supports smooth transitions via the `animated` option on `setNodes`:
```typescript
// Use React Flow's useReactFlow hook
const { setNodes } = useReactFlow();

const handleRelayout = () => {
  const newNodes = applyDagreLayout(visibleNodes, visibleEdges);
  setNodes(newNodes); // React Flow handles animation
};
```

### 3.5 Source Highlighting Hook (NEW)

**Location**: `src/shared/hooks/useSourceHighlight.ts`

**Purpose**: Sync selection to Monaco editor decorations

**Implementation:**
```typescript
import { useEffect, useRef } from 'react';
import { useEditorStore, useSpecStore, useGraphStore } from '@/stores';
import type * as monaco from 'monaco-editor';

export function useSourceHighlight() {
  const { editor } = useEditorStore();
  const { sourceMap } = useSpecStore();
  const { selectedNodeIds } = useGraphStore();
  const decorationsRef = useRef<string[]>([]);

  useEffect(() => {
    if (!editor || !sourceMap) return;

    // Collect ranges for selected nodes
    const ranges: monaco.IRange[] = [];
    for (const nodeId of selectedNodeIds) {
      const location = sourceMap.nodeToLocation.get(nodeId);
      if (location) {
        ranges.push({
          startLineNumber: location.startLine,
          startColumn: location.startColumn,
          endLineNumber: location.endLine,
          endColumn: location.endColumn,
        });
      }
    }

    // Apply decorations
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      ranges.map(range => ({
        range,
        options: {
          className: 'source-highlight-selection',
          isWholeLine: false,
          overviewRuler: {
            color: 'hsl(var(--primary))',
            position: monaco.editor.OverviewRulerLane.Center,
          },
        },
      }))
    );

    return () => {
      // Cleanup on unmount
      if (editor) {
        decorationsRef.current = editor.deltaDecorations(decorationsRef.current, []);
      }
    };
  }, [editor, sourceMap, selectedNodeIds]);
}
```

**CSS for Highlight:**
```css
.source-highlight-selection {
  background-color: hsl(var(--primary) / 0.15);
  border-left: 3px solid hsl(var(--primary));
}
```

---

## 4. Source Code Structure Changes

### Files to Modify

| File | Changes |
|------|---------|
| `src/stores/graphStore.ts` | Add `baseLayout`, `isAutoLayoutEnabled`, bulk methods |
| `src/features/graph/components/GraphCanvas.tsx` | Add marquee selection props, `onSelectionChange`, keyboard shortcuts |
| `src/features/graph/hooks/useFilteredGraph.ts` | No changes needed (already respects `hiddenNodeIds`) |
| `src/features/graph/components/FilterToolbar.tsx` | Add "Unhide All" button if `hiddenNodeIds.size > 0` |
| `src/index.css` | Add `.source-highlight-selection` class |

### Files to Create

| File | Purpose |
|------|---------|
| `src/features/graph/components/BulkActionsToolbar.tsx` | Floating toolbar for bulk actions |
| `src/shared/hooks/useSourceHighlight.ts` | Monaco editor selection sync |
| `src/features/graph/utils/layout.ts` | Dagre layout utilities |

---

## 5. Data Model / API Changes

### GraphState Extensions

```typescript
// Addition to existing interface
interface GraphState {
  // ... existing fields

  // New fields
  baseLayout: Record<string, { x: number; y: number }>;
  isAutoLayoutEnabled: boolean;

  // New methods
  setSelectedNodeIds: (ids: Set<string>) => void;  // Direct set for React Flow sync
  toggleVisibility: (ids: string[]) => void;
  focusOnNodes: (ids: string[]) => void;
  selectAll: () => void;
  invertSelection: () => void;
  selectConnected: (ids: string[]) => void;
  saveBaseLayout: () => void;
  restoreBaseLayout: () => void;
  setAutoLayout: (enabled: boolean) => void;
  relayout: () => void;
}
```

### No Breaking Changes
- All existing methods remain unchanged
- New fields have sensible defaults
- Selection continues to work as before (additive behavior preserved)

---

## 6. Verification Approach

### Automated Tests

**Commands:**
```bash
pnpm test          # Run all tests
pnpm lint          # ESLint check
pnpm typecheck     # TypeScript check
pnpm verify        # All checks combined
```

**New Tests to Add:**
1. `src/stores/__tests__/graphStore.bulk.test.ts`
   - Test `toggleVisibility` with various node sets
   - Test `focusOnNodes` correctly identifies neighbors
   - Test `selectConnected` recursively expands
   - Test `saveBaseLayout` and `restoreBaseLayout`

2. `src/features/graph/components/__tests__/BulkActionsToolbar.test.tsx`
   - Test visibility based on selection state
   - Test action button callbacks

### Manual Verification Checklist

1. **Marquee Selection**
   - [ ] Hold Shift and drag to create selection box
   - [ ] Partial overlap selects nodes (not just full containment)
   - [ ] Selection box visual feedback appears
   - [ ] Release completes selection

2. **Multi-Select Interaction**
   - [ ] Shift+Click toggles individual nodes
   - [ ] Ctrl/Cmd+Click also works for toggle
   - [ ] Click on canvas clears selection
   - [ ] Click on node without modifier replaces selection

3. **Bulk Actions Toolbar**
   - [ ] Appears when nodes are selected
   - [ ] Disappears when selection is cleared
   - [ ] "Hide" button hides selected nodes
   - [ ] "Focus" shows only selection + neighbors
   - [ ] "Expand" adds connected nodes to selection
   - [ ] "Clear" clears selection
   - [ ] "Unhide All" shows hidden nodes
   - [ ] "Relayout" reorganizes visible nodes

4. **Layout Stability**
   - [ ] Hiding nodes does NOT move other nodes
   - [ ] "Relayout" smoothly animates nodes
   - [ ] Positions persist after hide/show cycle

5. **Source Highlighting**
   - [ ] Selected nodes highlight in Monaco editor
   - [ ] Multiple selections show multiple highlights
   - [ ] Clearing selection removes highlights

6. **Performance**
   - [ ] Load Petstore spec (~40 nodes)
   - [ ] Marquee select all - remains responsive
   - [ ] Bulk hide/show - no lag
   - [ ] Relayout animates smoothly

---

## 7. Dependencies & Risks

### Dependencies
- Dagre library already in project (used by graph builder)
- React Flow's selection APIs are stable in v12

### Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| React Flow selection sync infinite loops | High | Use equality check before updating store |
| Layout animation performance on large graphs | Medium | Batch updates, use `requestAnimationFrame` |
| Monaco decoration cleanup | Low | Use `deltaDecorations` with tracked IDs |
| Mobile touch support for marquee | Low | Out of scope for initial implementation |

---

## 8. Implementation Order

The features should be implemented in this order to minimize integration issues:

1. **Phase 1: State Foundation**
   - Extend graphStore with new fields and methods
   - Add tests for new store methods

2. **Phase 2: Selection Enhancement**
   - Enable marquee selection in GraphCanvas
   - Add `onSelectionChange` handler
   - Test selection sync

3. **Phase 3: Bulk Actions UI**
   - Create BulkActionsToolbar component
   - Wire up to store methods
   - Test visibility and actions

4. **Phase 4: Layout Features**
   - Add Dagre layout utility
   - Implement relayout with animation
   - Add base layout save/restore

5. **Phase 5: Source Highlighting**
   - Create useSourceHighlight hook
   - Add CSS for decorations
   - Integrate into app

6. **Phase 6: Polish & Testing**
   - Run full test suite
   - Manual verification
   - Performance testing
