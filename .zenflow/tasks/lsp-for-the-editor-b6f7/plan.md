# LSP for the Editor - Implementation Plan

## Configuration
- **Artifacts Path**: `.zenflow/tasks/lsp-for-the-editor-b6f7`
- **Specification**: `spec.md`

---

## Summary

Add YAML Language Server Protocol (LSP) support to the Monaco editor using the `monaco-yaml` package. This provides:
- Schema-based autocomplete for OpenAPI properties
- Hover documentation
- Validation against OpenAPI 3.x JSON Schema
- Go-to-definition for `$ref` references
- YAML anchor navigation

**Difficulty**: Medium
**Estimated Changes**: ~60 lines across 4 files

---

## Workflow Steps

### [x] Step: Technical Specification

Created `spec.md` with:
- Analysis of `monaco-yaml` vs full `monaco-languageclient` approach
- Recommended `monaco-yaml` for simpler integration
- File structure changes identified
- Verification approach defined

---

### [x] Step: Install Dependencies
<!-- chat-id: a0eeeece-4b68-4e01-8bbd-6602b544774d -->

Install the `monaco-yaml` package:
```bash
pnpm add monaco-yaml
```

**Verification**:
- Package appears in `package.json` dependencies
- `pnpm install` completes without errors

---

### [x] Step: Create YAML Worker File
<!-- chat-id: 6790c3ce-62c1-4345-b743-0b273b7a6193 -->

Create `src/features/editor/yaml.worker.ts` for Vite compatibility with monaco-yaml's web worker.

**Files**:
- `src/features/editor/yaml.worker.ts` (new, ~3 lines)

**Verification**:
- File exists and imports monaco-yaml worker

---

### [x] Step: Create Monaco YAML Configuration
<!-- chat-id: cb877e5c-e139-484c-b183-b2264350cb0f -->

Create `src/features/editor/monacoYamlSetup.ts` with:
- `configureMonacoYaml()` call
- OpenAPI 3.0 and 3.1 schema configuration
- Enable autocomplete, hover, validation, formatting

**Files**:
- `src/features/editor/monacoYamlSetup.ts` (new, ~35 lines)

**Verification**:
- TypeScript compiles without errors

---

### [x] Step: Update Vite Configuration
<!-- chat-id: d5fb7b62-034b-48c1-ba99-370895582020 -->

Modify `vite.config.ts` to:
- Configure worker handling for monaco-yaml
- Add necessary aliases for worker resolution

**Files**:
- `vite.config.ts` (modify, ~10 lines)

**Verification**:
- `pnpm build` completes successfully ✓
- Worker is bundled correctly ✓

---

### [x] Step: Integrate with TextEditor Component
<!-- chat-id: d536458f-b7ef-4bf2-b275-aad68edaee59 -->

Modify `src/features/editor/components/TextEditor.tsx` to:
- Import and configure Monaco environment for YAML worker
- Call `setupMonacoYaml()` in `beforeMount` callback
- Ensure existing error markers continue to work

**Files**:
- `src/features/editor/components/TextEditor.tsx` (modify, ~20 lines)

**Changes made**:
- Added `MonacoEnvironment` configuration to handle YAML and editor workers
- Imported `setupMonacoYaml` from `monacoYamlSetup.ts`
- Added `handleBeforeMount` callback that calls `setupMonacoYaml()`
- Added `beforeMount` prop to the Editor component

**Verification**:
- `pnpm typecheck` passes ✓
- `pnpm lint` passes ✓
- `pnpm build` succeeds with yaml.worker bundled ✓

---

### [x] Step: Verification and Testing
<!-- chat-id: f61ef78d-98c6-430d-b24f-d915228b8ff7 -->

Run full verification suite:
```bash
pnpm lint      # ✓ Pass
pnpm typecheck # ✓ Pass
pnpm test      # ✓ Pass (88 tests)
pnpm build     # ✓ Pass (yaml.worker bundled at 783KB)
```

**Build Results**:
- `editor.worker-0XRYpotG.js` (312KB)
- `yaml.worker-BY-B96Dv.js` (783KB)
- All tests pass (88 tests)

**Known Issue - Worker Initialization**:
The monaco-yaml worker fails to initialize properly when used with `@monaco-editor/react` + `loader.config({ monaco })`. The error "Could not create web worker(s). Falling back to loading web worker code in main thread" appears in console.

This is a known compatibility issue between:
- `@monaco-editor/react` which uses its own Monaco loader
- `monaco-yaml` which uses `monaco-worker-manager` for worker creation
- The `monaco.editor.createWebWorker()` API expects a different worker resolution mechanism

**Impact**:
- LSP features (autocomplete, hover, validation) do not work as expected
- Editor still functions with basic YAML syntax highlighting
- Existing custom parser validation continues to work

**Recommended Next Steps**:
1. Consider replacing `@monaco-editor/react` with direct Monaco Editor usage (as shown in official monaco-yaml Vite example)
2. Or wait for upstream fixes to `@monaco-editor/react` worker handling
3. Or implement a custom Monaco wrapper that properly initializes workers before the editor loads

---

### [x] Step: Write Implementation Report
<!-- chat-id: 71c25123-64be-4bb9-b934-8a5202072d5f -->

Create `report.md` with:
- What was implemented
- How the solution was tested
- Any issues or challenges encountered

**Completed**: Created comprehensive `report.md` documenting:
- All files created and modified (~75 lines total)
- Testing results (all pass: lint, typecheck, 88 tests, build)
- Known worker initialization issue with `@monaco-editor/react`
- Three resolution options for the runtime issue
- Conclusion that code-level implementation is complete but runtime activation blocked

---

### [x] Step: Replace @monaco-editor/react with Direct Monaco Integration

Replace `@monaco-editor/react` with direct Monaco Editor usage to fix worker initialization.

**Rationale**:
- `@monaco-editor/react` manages Monaco lifecycle internally, causing race conditions with worker setup
- Direct Monaco usage gives full control over initialization order
- Official monaco-yaml Vite example uses this approach successfully

**Files Changed**:
- `src/features/editor/components/TextEditor.tsx` (rewritten, 152 lines)
- `src/main.tsx` (removed monacoSetup import)
- `package.json` (removed `@monaco-editor/react`, moved `monaco-editor` to dependencies)
- `eslint.config.js` (added `HTMLDivElement` to globals)

**Files Removed**:
- `src/features/editor/monacoSetup.ts` (merged into TextEditor.tsx)
- `src/features/editor/monacoYamlSetup.ts` (merged into TextEditor.tsx)

**Key Changes**:
1. Monaco environment and worker setup now happens at module load time in TextEditor.tsx
2. `configureMonacoYaml()` called before any editor is created
3. Editor created directly with `monaco.editor.create()`
4. Proper React lifecycle handling (mount/unmount, value sync, theme updates)
5. All existing features preserved (markers, theme switching)

**Verification**:
- `pnpm lint` ✓ Pass
- `pnpm typecheck` ✓ Pass
- `pnpm test` ✓ Pass (88 tests)
- `pnpm build` ✓ Pass (yaml.worker bundled at 783KB)
