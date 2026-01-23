# Implementation Report: LSP for the Editor

## Summary

This task implemented YAML Language Server Protocol (LSP) support for the Monaco editor using the `monaco-yaml` package. The goal was to provide intelligent editing features for OpenAPI specifications including autocomplete, hover documentation, schema validation, and `$ref` navigation.

## What Was Implemented

### New Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/features/editor/monacoSetup.ts` | 30 | Monaco environment configuration with YAML worker support |
| `src/features/editor/monacoYamlSetup.ts` | 33 | monaco-yaml configuration with OpenAPI 3.0/3.1 schemas |

### Files Modified

| File | Changes |
|------|---------|
| `src/features/editor/components/TextEditor.tsx` | Added `beforeMount` callback to initialize monaco-yaml |
| `vite.config.ts` | Added worker format and optimizeDeps configuration for monaco-yaml |
| `package.json` | Added `monaco-yaml` v5.4.0 dependency |

### Implementation Details

**1. Monaco Environment Setup (`monacoSetup.ts`)**
- Configured `window.MonacoEnvironment.getWorker()` to return appropriate workers
- YAML worker (`YamlWorker`) for YAML language features
- Editor worker (`EditorWorker`) for general editor services
- Used Vite's `?worker` import syntax for worker bundling
- Configured `@monaco-editor/react` loader to use local Monaco instance

**2. Monaco YAML Configuration (`monacoYamlSetup.ts`)**
- Enabled schema-based autocomplete, hover, validation, and formatting
- Configured OpenAPI 3.1 schema: `https://spec.openapis.org/oas/3.1/schema-base/2022-10-07`
- Configured OpenAPI 3.0 schema: `https://spec.openapis.org/oas/3.0/schema/2021-09-28`
- Enabled remote schema fetching via `enableSchemaRequest: true`

**3. TextEditor Integration**
- Added `beforeMount` callback that calls `setupMonacoYaml()`
- Imported `monacoSetup.ts` at the top to ensure worker configuration runs first
- Existing custom parser validation (`parseErrors` markers) continues to work alongside

**4. Vite Configuration**
- Set worker format to `'es'` for ES module workers
- Added `monaco-yaml` and `monaco-editor` to `optimizeDeps.include`
- Excluded `monaco-yaml/yaml.worker` from pre-bundling

## Testing Results

### Build Verification
```
pnpm lint      # ✓ Pass
pnpm typecheck # ✓ Pass
pnpm test      # ✓ Pass (88 tests)
pnpm build     # ✓ Pass
```

### Build Output
- `editor.worker-0XRYpotG.js` (312KB)
- `yaml.worker-BY-B96Dv.js` (783KB)
- Both workers properly bundled

### Existing Functionality
- Custom OpenAPI parser validation continues to work
- Editor theming (light/dark/system) unaffected
- All 88 existing tests pass

## Known Issue: Worker Initialization

**Problem**: The monaco-yaml worker fails to initialize at runtime with the error:
```
Could not create web worker(s). Falling back to loading web worker code in main thread
```

**Root Cause**: Incompatibility between:
- `@monaco-editor/react` which manages its own Monaco loader lifecycle
- `monaco-yaml` which uses `monaco-worker-manager` for worker creation
- The timing of `MonacoEnvironment.getWorker()` configuration vs Monaco initialization

**Impact**:
- LSP features (autocomplete, hover, schema validation) do not activate
- Editor functions normally with basic YAML syntax highlighting
- Existing custom parser validation works correctly
- No runtime errors or crashes

**Why This Happens**:
The `@monaco-editor/react` library initializes Monaco asynchronously via its loader, but `monaco-yaml` expects the `MonacoEnvironment` to be configured before Monaco's worker manager initializes. Even though we configure it early, the race condition persists.

## Recommendations for Resolution

### Option 1: Replace `@monaco-editor/react` with Direct Monaco Usage (Recommended)
The official monaco-yaml Vite example uses Monaco Editor directly without the React wrapper. This gives full control over initialization order.

```tsx
// Instead of @monaco-editor/react
import * as monaco from 'monaco-editor';
// Initialize workers, then create editor
```

**Effort**: ~100 lines to refactor TextEditor.tsx

### Option 2: Custom Monaco Wrapper
Create a custom React component that:
1. Waits for Monaco and workers to fully initialize
2. Only then renders the editor
3. Uses refs to manage lifecycle

**Effort**: ~150 lines

### Option 3: Wait for Upstream Fixes
Monitor these repositories for compatibility improvements:
- `@monaco-editor/react` - Monaco lifecycle control
- `monaco-yaml` - Alternative initialization methods

## Conclusion

The implementation successfully added the monaco-yaml integration at the code level:
- All files are properly configured
- Build produces both editor and YAML workers
- TypeScript compiles without errors
- All tests pass

However, a runtime worker initialization issue prevents the LSP features from activating. The editor remains fully functional with existing features. Resolution requires either replacing the React wrapper library or implementing custom worker initialization logic.

## Files Changed Summary

```
src/features/editor/monacoSetup.ts       (new)     - 30 lines
src/features/editor/monacoYamlSetup.ts   (new)     - 33 lines
src/features/editor/components/TextEditor.tsx     - +5 lines
vite.config.ts                                     - +7 lines
package.json                                       - +1 dependency
```

**Total**: ~75 lines of new/changed code
