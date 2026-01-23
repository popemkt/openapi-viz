# Technical Specification: OpenAPI Visualization Bug Fixes and Enhancements

## Task Overview

**Difficulty Level: Medium**

This task involves fixing bugs and enhancing functionality in an OpenAPI visualization tool built with React, TypeScript, Vite, and @xyflow/react (React Flow).

## Technical Context

- **Language**: TypeScript 5.9.3
- **Framework**: React 19.2.3
- **Build Tool**: Vite 7.2.4
- **Graph Library**: @xyflow/react 12.10.0
- **OpenAPI Parser**: @readme/openapi-parser 5.5.0
- **State Management**: Zustand 5.0.10

---

## Issue 1: "Buffer is not defined" Validation Error

### Problem Analysis

The `@readme/openapi-parser` library uses Node.js-specific APIs (like `Buffer`) that aren't available in browsers. This error always appears when validating OpenAPI specs because:

1. The parser was designed for Node.js environments
2. Vite 4+ removed automatic Node.js polyfills
3. The error surfaces at `src/core/parser/parseSpec.ts:343` during validation

**Current Code** (`parseSpec.ts:324-346`):
```typescript
try {
  const validationResult = await validateOpenAPI(structuredClone(parsed) as any);
  // ...
} catch (error) {
  errors.push({
    message: `Validation Error: ${(error as Error).message}`,
    severity: 'error',
  });
}
```

### Solution

Install and configure `vite-plugin-node-polyfills` to provide browser-compatible polyfills for Node.js APIs.

### Files to Modify

1. `package.json` - Add `vite-plugin-node-polyfills` dependency
2. `vite.config.ts` - Configure the polyfill plugin

### Implementation Approach

```typescript
// vite.config.ts
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream'],
      globals: {
        Buffer: true,
        process: true,
      },
    }),
  ],
})
```

---

## Issue 2: Composite Types Handling

### Problem Analysis

The parser and graph builder have **partial support** for composite types but don't fully extract or visualize them:

#### Current State

**Types defined** (`src/types/openapi.ts:42-56`):
```typescript
export interface Schema {
  // ... other fields
  allOf?: Schema[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  items?: Schema;  // for arrays
  $ref?: string;
}
```

**Graph builder handles refs** (`src/core/graph-builder/buildGraph.ts:188-198`):
```typescript
// Check allOf, oneOf, anyOf
for (const composition of [schema.allOf, schema.oneOf, schema.anyOf]) {
  if (composition) {
    for (const subSchema of composition) {
      if (subSchema.$ref) {
        const refName = extractSchemaRef(subSchema.$ref);
        if (refName) refs.push(refName);
      }
    }
  }
}
```

**Parser does NOT extract composite types** (`src/core/parser/parseSpec.ts:68-86`):
- `extractSchema()` function ignores `allOf`, `oneOf`, `anyOf` properties
- Only extracts basic type, properties, required fields, enum, and $ref

#### Comprehensive List of Composite/Connection Types

| Type | Description | Current Support |
|------|-------------|-----------------|
| `$ref` | Reference to another schema | ✅ Parsed & visualized |
| `allOf` | Inheritance/composition (must satisfy all) | ❌ Not parsed, ⚠️ Partially visualized |
| `oneOf` | Union type (must satisfy exactly one) | ❌ Not parsed, ⚠️ Partially visualized |
| `anyOf` | Union type (must satisfy at least one) | ❌ Not parsed, ⚠️ Partially visualized |
| `items` | Array item type | ✅ Parsed, ⚠️ Partial visualization |
| `additionalProperties` | Map/dictionary value type | ❌ Not supported |
| `discriminator` | Polymorphism indicator | ❌ Not supported |
| `not` | Negation constraint | ❌ Not supported |
| Inline schemas | Nested schema definitions | ⚠️ Partially supported |

### Solution

#### Phase 1: Complete Parser Extraction

Modify `extractSchema()` to properly extract:
- `allOf`, `oneOf`, `anyOf` arrays with their sub-schemas
- `additionalProperties` for maps
- Recursive inline schema handling

#### Phase 2: Enhance Graph Visualization

Add new edge types to distinguish composition relationships:
- `allOf` edges (inheritance style)
- `oneOf` edges (alternative style)
- `anyOf` edges (flexible union style)
- `array-items` edges (for array types)

#### Phase 3: UI Enhancement

Update SchemaNode to show composition indicators and add visual cues for different relationship types.

### Files to Modify

1. `src/core/parser/parseSpec.ts` - Enhance schema extraction
2. `src/types/graph.ts` - Add new edge types
3. `src/core/graph-builder/buildGraph.ts` - Create edges for composite types
4. `src/constants/colors.ts` - Add colors for new edge types
5. `src/features/graph/components/SchemaNode.tsx` - Show composition badges

### Implementation Approach

**Parser Changes** (`parseSpec.ts`):
```typescript
function extractSchema(name: string, schemaObj: Record<string, unknown>, lineNumber: number): Schema {
  const requiredFields = (schemaObj.required as string[]) || [];

  return {
    id: name,
    name,
    type: extractSchemaType(schemaObj),
    description: schemaObj.description as string | undefined,
    properties: extractSchemaProperties(schemaObj, requiredFields),
    required: requiredFields,
    enum: schemaObj.enum as unknown[] | undefined,
    $ref: schemaObj.$ref as string | undefined,
    // Add composition extraction
    allOf: extractCompositionSchemas(schemaObj.allOf),
    oneOf: extractCompositionSchemas(schemaObj.oneOf),
    anyOf: extractCompositionSchemas(schemaObj.anyOf),
    items: schemaObj.items ? extractSchema('items', schemaObj.items as Record<string, unknown>, lineNumber) : undefined,
    sourceLocation: createSourceLocation(lineNumber),
  };
}

function extractCompositionSchemas(composition: unknown): Schema[] | undefined {
  if (!Array.isArray(composition)) return undefined;
  return composition.map((s, i) => extractSchema(`composed-${i}`, s as Record<string, unknown>, 1));
}
```

**New Edge Types** (`graph.ts`):
```typescript
export type EdgeType =
  | 'request-body'
  | 'response'
  | 'parameter'
  | 'schema-ref'
  | 'circular'
  | 'allOf'      // NEW
  | 'oneOf'      // NEW
  | 'anyOf'      // NEW
  | 'array-items'; // NEW
```

---

## Issue 3: Node Dragging Capability

### Problem Analysis

React Flow (v12) supports node dragging out of the box, but the current implementation doesn't persist drag changes. Examining `GraphCanvas.tsx`:

```typescript
<ReactFlow
  nodes={nodesWithSelection}
  edges={filteredEdges}
  onNodeClick={handleNodeClick}
  onPaneClick={handlePaneClick}
  // Missing: onNodesChange handler for drag persistence
/>
```

The store already has `updateNodePosition()` but it's not connected to React Flow's drag events.

### Solution

Add `onNodesChange` handler to persist node position changes during drag operations.

### Files to Modify

1. `src/features/graph/components/GraphCanvas.tsx` - Add drag handlers
2. `src/stores/graphStore.ts` - May need minor adjustments

### Implementation Approach

```typescript
// GraphCanvas.tsx
import { applyNodeChanges, type NodeChange } from '@xyflow/react';

export function GraphCanvas() {
  const { nodes: storeNodes, setNodes, ... } = useGraphStore();

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes(applyNodeChanges(changes, storeNodes));
    },
    [storeNodes, setNodes]
  );

  return (
    <ReactFlow
      nodes={nodesWithSelection}
      edges={filteredEdges}
      onNodesChange={handleNodesChange}
      // ... rest
    />
  );
}
```

---

## Verification Approach

### Commands

```bash
# Type checking
pnpm typecheck

# Linting
pnpm lint

# Tests
pnpm test

# Full verification
pnpm verify

# Development testing
pnpm dev
```

### Manual Testing Checklist

1. **Buffer Error Fix**:
   - Load the app with `pnpm dev`
   - Open browser console
   - Verify no "Buffer is not defined" error appears
   - Test with valid and invalid OpenAPI specs

2. **Composite Types**:
   - Create/load OpenAPI spec with `allOf`, `oneOf`, `anyOf`
   - Verify schemas are parsed correctly (check detail panel)
   - Verify edges are drawn between schemas with correct styles
   - Test array schemas with `items.$ref`

3. **Node Dragging**:
   - Load any OpenAPI spec to generate graph
   - Drag a node and verify it moves
   - Release node and verify position persists
   - Verify edges follow the node during drag

---

## Risk Assessment

| Issue | Risk Level | Notes |
|-------|-----------|-------|
| Buffer polyfill | Low | Standard solution, minimal side effects |
| Composite types | Medium | May surface parsing edge cases in unusual OpenAPI specs |
| Node dragging | Low | React Flow v12 has built-in support |

---

## Summary of Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `package.json` | Modify | Add `vite-plugin-node-polyfills` |
| `vite.config.ts` | Modify | Configure polyfills |
| `src/core/parser/parseSpec.ts` | Modify | Extract composite types |
| `src/types/graph.ts` | Modify | Add new edge types |
| `src/core/graph-builder/buildGraph.ts` | Modify | Create edges for composite types |
| `src/constants/colors.ts` | Modify | Add colors for new edges |
| `src/features/graph/components/GraphCanvas.tsx` | Modify | Add onNodesChange handler |
| `src/features/graph/components/SchemaNode.tsx` | Modify | Show composition indicators |
