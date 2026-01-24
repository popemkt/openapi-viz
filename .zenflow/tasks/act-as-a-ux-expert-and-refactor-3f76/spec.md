# UX Audit and Controls Refactor - Technical Specification

## Task Difficulty: **Medium-Hard**

This task involves significant UI refactoring across multiple components with architectural considerations for information hierarchy, progressive disclosure, and consistent interaction patterns.

---

## Technical Context

- **Framework**: React 19.2.3 with TypeScript
- **UI Library**: Radix UI primitives + Tailwind CSS 4.1.18
- **State Management**: Zustand 5.0.10
- **Component Pattern**: CVA-based variants with memo optimization
- **Icon Library**: Lucide React

---

## Current UX Problems Identified

### 1. **FilterToolbar Overwhelm** (`src/features/graph/components/FilterToolbar.tsx`)

The 458-line FilterToolbar presents **15+ controls in a flat horizontal layout**:

**Issues:**
- **No visual hierarchy**: Search, toggles, settings dropdowns, filters, and actions all compete for attention at the same level
- **Cryptic icon-only buttons**: Compact level (Maximize2/Square/Minus icons), filter mode (Highlighter/EyeOff) require tooltips to understand
- **Duplicate functionality**: "Show hidden nodes" appears in both FilterToolbar and BulkActionsToolbar
- **Settings buried in dropdowns**: Display settings and Layout settings are hidden behind generic icons (Settings, LayoutGrid)
- **Path pattern input lacks context**: Just shows "/api/*" placeholder with no explanation
- **Inconsistent button styles**: Mix of Toggle, Button with icon-only, Button with text

**Current Layout:**
```
[Search] [PathPattern] [Toggle:Endpoints] [Toggle:Schemas] [Toggle:FilterMode] [SelectHighlighted] | [CompactCycle] [DisplaySettings] [LayoutSettings] | [Methods] [Tags] [HiddenNodes] [ActiveFilters]
```

### 2. **BulkActionsToolbar Positioning & Clarity** (`src/features/graph/components/BulkActionsToolbar.tsx`)

**Issues:**
- **Floating position conflicts**: Bottom-center floating toolbar can overlap with graph content
- **Action icons unclear**: Target, Maximize2 icons for "Focus" and "Expand" are not intuitive
- **Relayout always visible**: Shows even when no reason to relayout exists
- **Duplicate "hidden nodes" controls**: Same info shown in FilterToolbar

### 3. **Top Toolbar (Layout.tsx) Density**

**Issues:**
- **Icon-only file operations**: New, Open, Save, Export are all icon-only with no labels
- **Parse status cluttered**: Error/warning counts, endpoint/schema counts all compete
- **View mode toggle icons**: PanelLeft, Columns, PanelRight need explanation

### 4. **General UX Anti-patterns**

1. **Too many toggles that look the same** - Hard to scan and understand state
2. **Settings scattered across multiple dropdowns** - No mental model of where to find things
3. **No progressive disclosure** - Everything shown at once, overwhelming new users
4. **Inconsistent keyboard hints** - Some buttons show "(Del)", others don't
5. **Badge overload** - Multiple small badges (filter counts, hidden counts, selection counts)

---

## UX Design Principles for Refactor

### 1. **Progressive Disclosure**
- Show primary actions prominently
- Group secondary/advanced options in expandable sections or panels
- Hide rarely-used options behind "Advanced" or contextual menus

### 2. **Clear Visual Hierarchy**
- Primary actions: Prominent buttons with labels
- Secondary actions: Icon buttons with clear tooltips
- Tertiary/settings: Grouped in collapsible panels

### 3. **Consistent Interaction Patterns**
- All similar actions should look and behave the same way
- Use labels for actions that require understanding, icons for familiar operations

### 4. **Reduce Cognitive Load**
- Group related controls together
- Use descriptive labels instead of abstract icons
- Provide visual feedback for current state

### 5. **Contextual Visibility**
- Show controls only when relevant
- Hide empty states or zero-count indicators

---

## Implementation Approach

### Strategy: **Reorganize into Logical Groupings with Progressive Disclosure**

#### A. FilterToolbar Restructure

**New Mental Model - 3 Sections:**

1. **Search & Filter** (Primary - Always visible)
   - Search input (keep as-is, already clear)
   - Quick filter buttons with labels when space allows

2. **Display Options** (Secondary - Collapsible)
   - Node types visibility (Endpoints/Schemas)
   - Compact level with clear states
   - Display modes in one organized panel

3. **Layout & Advanced** (Tertiary - On-demand)
   - Layout direction and spacing
   - Method/Tag filters (often unused)

**Proposed New Layout:**

```
[Search Input (wider)] [Show: Endpoints | Schemas (segmented)] [Filter Mode: Highlight/Hide (segmented)] | [View ▼] [Layout ▼] | [Methods ▼] [Tags ▼] | [Clear Filters]
```

Key Changes:
- Replace Toggle icons with labeled segmented controls
- Combine "Display settings" and "Compact level" into one "View" dropdown with clear sections
- Move hidden nodes indicator to BulkActionsToolbar only (avoid duplication)
- Add text labels to commonly-misunderstood buttons

#### B. BulkActionsToolbar Improvements

**Changes:**
- Add text labels to action buttons: "Hide", "Focus", "Expand", "Clear"
- Move to right side to avoid blocking graph center
- Make relayout contextual (only show after layout changes)
- Consolidate as the single source for hidden nodes info

#### C. Top Toolbar Simplification

**Changes:**
- Add text labels to file operations: "New", "Open", "Save"
- Collapse export into a labeled dropdown button "Export ▼"
- Simplify parse status to just icon + count, details on hover
- Add text labels to view mode: "Editor", "Split", "Graph"

---

## Source Code Structure Changes

### Files to Modify:

1. **`src/features/graph/components/FilterToolbar.tsx`**
   - Restructure layout into 3 logical sections
   - Replace icon-only toggles with labeled segmented controls
   - Consolidate settings dropdowns
   - Remove duplicate hidden nodes indicator

2. **`src/features/graph/components/BulkActionsToolbar.tsx`**
   - Add text labels to action buttons
   - Reposition to right side of canvas
   - Add hidden nodes as primary indicator here

3. **`src/app/Layout.tsx`**
   - Add text labels to file operation buttons
   - Simplify parse status display
   - Add labels to view mode toggles

4. **`src/components/ui/` (potential new components)**
   - May need `segmented-control.tsx` for cleaner toggle groups
   - May need `labeled-icon-button.tsx` for consistent icon+label pattern

### Files to Create (if needed):

- `src/components/ui/segmented-control.tsx` - Cleaner alternative to ToggleGroup for binary/ternary choices
- `src/features/graph/components/ViewOptionsPanel.tsx` - Consolidated view options panel

---

## Data Model / API Changes

**None required** - This is a pure presentation layer refactor. All state stores remain unchanged:
- `filterStore` - Same filter state
- `uiStore` - Same UI preferences
- `graphStore` - Same graph/selection state

---

## Detailed Implementation Plan

### Phase 1: Component Restructuring (FilterToolbar)

1. **Create segmented control component** for cleaner toggle groups
2. **Reorganize FilterToolbar sections**:
   - Search section (search + path pattern)
   - Node type visibility (segmented: Endpoints/Schemas)
   - Filter mode (segmented: Highlight/Hide)
   - View options dropdown (compact level + display modes)
   - Layout dropdown (direction + spacing)
   - HTTP Methods dropdown
   - Tags dropdown
   - Clear filters button
3. **Add labels** to previously icon-only controls
4. **Remove duplicate** hidden nodes indicator

### Phase 2: BulkActionsToolbar Improvements

1. **Add text labels** to all action buttons
2. **Reposition** to avoid overlap
3. **Consolidate** hidden nodes display here
4. **Make relayout contextual**

### Phase 3: Top Toolbar Polish

1. **Add labels** to file operations
2. **Simplify** parse status
3. **Label** view mode toggles

### Phase 4: Testing & Refinement

1. **Manual testing** of all interactions
2. **Responsive behavior** verification
3. **Accessibility** check (keyboard navigation, screen reader)

---

## Verification Approach

1. **Build check**: `npm run build` - no TypeScript or build errors
2. **Lint check**: `npm run lint` - no linting errors
3. **Test suite**: `npm run test` - all existing tests pass
4. **Manual verification**:
   - All controls function identically to before
   - New labels are clear and descriptive
   - Layout is cleaner and less overwhelming
   - Responsive behavior maintained
   - Keyboard shortcuts still work

---

## Risk Assessment

- **Low Risk**: Pure UI refactor with no business logic changes
- **Medium Complexity**: Multiple components need coordinated changes
- **Testing**: Mostly manual verification needed for UX improvements

---

## Success Criteria

1. User can understand all controls at first glance without relying on tooltips
2. Related controls are visually grouped
3. No duplicate information shown in multiple places
4. Primary actions are prominent, secondary actions are discoverable
5. Existing functionality is preserved with zero regressions
