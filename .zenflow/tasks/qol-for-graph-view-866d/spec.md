# Technical Specification: QoL Improvements for Graph View

## Task Difficulty Assessment: **Medium**

The task involves adding UI controls and display logic to existing React components. The core challenges are:
- Truncation/abbreviation of long schema names that preserves meaning
- Adding UI toggles to the filter toolbar
- State management for new display preferences
- Ensuring changes work well with existing layout algorithms

## Problem Analysis

When loading OpenAPI specs with long namespace-style schema names (e.g., `Force.Mortgages.Evidence.Services.Api.V1.ProvenData.RealEstate.RealEstate`), the graph view becomes cluttered because:

1. **Schema node names overflow**: Names like `Force.Mortgages.Evidence.Services.Api.V1.ProvenData.RealEstate.RealEstate` are 70+ characters
2. **Endpoint paths overlap**: Long paths like `/api/v1/dossiers/{dossierReference}/proven-data/real-estate` also contribute
3. **Layout becomes cramped**: Long names make nodes wider, causing overlap even with dagre layout

## Technical Context

- **Framework**: React with TypeScript
- **Graph Library**: @xyflow/react (React Flow)
- **State Management**: Zustand with persistence
- **UI Components**: shadcn/ui (Radix primitives)
- **Layout**: Dagre for automatic positioning

## Proposed QoL Features

### 1. Schema Name Truncation (Primary Feature)

**Approach**: Extract meaningful suffix from dot-separated namespace names.

For `Force.Mortgages.Evidence.Services.Api.V1.ProvenData.RealEstate.RealEstate`:
- Full: `Force.Mortgages.Evidence.Services.Api.V1.ProvenData.RealEstate.RealEstate`
- Short: `RealEstate` (last segment)
- Medium: `RealEstate.RealEstate` (last 2 segments)

**Implementation**:
- Add `schemaNameDisplayMode: 'full' | 'short' | 'medium'` to UI store
- Create utility function `truncateSchemaName(name: string, mode: DisplayMode): string`
- Update `SchemaNode.tsx` to use truncated names
- Show full name in tooltip on hover

### 2. Endpoint Path Truncation

**Approach**: Similar strategy for endpoint paths.

For `/api/v1/dossiers/{dossierReference}/proven-data/real-estate`:
- Full: `/api/v1/dossiers/{dossierReference}/proven-data/real-estate`
- Short: `…/real-estate` (last segment)
- Medium: `…/proven-data/real-estate` (last 2 segments)

**Implementation**:
- Add `endpointPathDisplayMode: 'full' | 'short' | 'medium'` to UI store
- Create utility function `truncateEndpointPath(path: string, mode: DisplayMode): string`
- Update `EndpointNode.tsx` to use truncated paths

### 3. Compact Mode Toggle

**Approach**: A single toggle that enables both name truncation modes for quick cleanup.

**Implementation**:
- Add `compactMode: boolean` to UI store
- When enabled, defaults to 'short' display mode for both schemas and endpoints
- Quick toggle in FilterToolbar

### 4. Node Width Constraints

**Approach**: Add CSS max-width constraints to prevent excessive node growth.

**Implementation**:
- Add `max-w-[250px]` or similar to node containers
- Use `text-ellipsis` and `overflow-hidden` for text that exceeds container
- Configurable via UI store: `maxNodeWidth: number`

### 5. Improved Layout Spacing

**Approach**: Adjust dagre layout parameters for better spacing with complex specs.

**Implementation**:
- Increase default `rankSpacing` and `nodeSpacing` when many nodes exist
- Make layout options accessible via settings dropdown

## Source Code Changes

### New Files

1. **`src/utils/displayUtils.ts`**
   - `truncateSchemaName(name: string, mode: DisplayMode): string`
   - `truncateEndpointPath(path: string, mode: DisplayMode): string`

### Modified Files

1. **`src/stores/uiStore.ts`**
   - Add display mode state and actions
   - New state: `schemaNameDisplayMode`, `endpointPathDisplayMode`, `compactMode`, `maxNodeWidth`

2. **`src/features/graph/components/SchemaNode.tsx`**
   - Use `truncateSchemaName` for display
   - Add tooltip with full name
   - Apply max-width constraint

3. **`src/features/graph/components/EndpointNode.tsx`**
   - Use `truncateEndpointPath` for display
   - Add tooltip with full path
   - Apply max-width constraint

4. **`src/features/graph/components/FilterToolbar.tsx`**
   - Add compact mode toggle
   - Add display mode dropdown (optional, for fine-grained control)

5. **`src/core/graph-builder/buildGraph.ts`**
   - Optionally adjust layout parameters based on node count

## Interface Changes

### UIStore Interface Updates

```typescript
export type DisplayMode = 'full' | 'short' | 'medium';

interface UIState {
  // Existing...

  // New display options
  schemaNameDisplayMode: DisplayMode;
  endpointPathDisplayMode: DisplayMode;
  compactMode: boolean;
  maxNodeWidth: number;

  // Actions
  setSchemaNameDisplayMode: (mode: DisplayMode) => void;
  setEndpointPathDisplayMode: (mode: DisplayMode) => void;
  toggleCompactMode: () => void;
  setMaxNodeWidth: (width: number) => void;
}
```

### Display Utility Functions

```typescript
function truncateSchemaName(name: string, mode: DisplayMode): string;
function truncateEndpointPath(path: string, mode: DisplayMode): string;
```

## Verification Approach

1. **Manual Testing**:
   - Load the `evidence-proven-data-api-spec.yaml` file
   - Toggle compact mode and verify names are shortened
   - Hover over nodes to verify full names appear in tooltips
   - Verify layout is less cluttered

2. **Visual Verification**:
   - Nodes should not exceed max width
   - Text should be readable and meaningful even when truncated
   - Tooltips should show full context

3. **Persistence Testing**:
   - Change display settings
   - Reload page
   - Verify settings are preserved

4. **Existing Tests**:
   - Run `npm test` to ensure no regressions
   - Run `npm run lint` for code quality

## Implementation Plan

### Step 1: Create display utilities
- Create `src/utils/displayUtils.ts` with truncation functions
- Write unit tests for truncation logic

### Step 2: Update UI store
- Add new state properties to `uiStore.ts`
- Add setter actions
- Ensure persistence works

### Step 3: Update SchemaNode component
- Import display utilities and UI store
- Apply truncation to schema name display
- Add tooltip for full name
- Add max-width constraint

### Step 4: Update EndpointNode component
- Apply truncation to endpoint path display
- Add tooltip for full path
- Add max-width constraint

### Step 5: Update FilterToolbar
- Add compact mode toggle button
- Optionally add display mode dropdown for granular control

### Step 6: Testing and polish
- Test with the problematic YAML file
- Adjust default values as needed
- Ensure good UX
