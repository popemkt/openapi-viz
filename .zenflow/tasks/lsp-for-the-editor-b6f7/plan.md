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

### [ ] Step: Integrate with TextEditor Component

Modify `src/features/editor/components/TextEditor.tsx` to:
- Import and configure Monaco environment for YAML worker
- Call `setupMonacoYaml()` in `beforeMount` callback
- Ensure existing error markers continue to work

**Files**:
- `src/features/editor/components/TextEditor.tsx` (modify, ~15 lines)
- `src/features/editor/index.ts` (modify if needed for exports)

**Verification**:
- Editor loads without console errors
- YAML worker initializes

---

### [ ] Step: Verification and Testing

Run full verification suite:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Manual testing:
- [ ] Autocomplete works for OpenAPI properties
- [ ] Hover shows documentation
- [ ] Invalid schema shows validation errors
- [ ] $ref navigation works
- [ ] Existing custom parser errors still display
- [ ] Light/dark theme works

---

### [ ] Step: Write Implementation Report

Create `report.md` with:
- What was implemented
- How the solution was tested
- Any issues or challenges encountered
