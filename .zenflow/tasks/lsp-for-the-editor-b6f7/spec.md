# Technical Specification: LSP for the Editor

## Task Difficulty Assessment

**Difficulty: Medium**

Rationale:
- The codebase already has Monaco Editor properly configured with `@monaco-editor/react`
- The `monaco-yaml` package provides a simpler integration path than full `monaco-languageclient`
- Web worker setup requires Vite-specific configuration
- OpenAPI schema validation needs custom schema configuration
- Some edge cases around worker initialization and schema loading

## Technical Context

### Current State
- **Framework**: React 19.2.3 with TypeScript 5.9.3
- **Editor**: Monaco Editor 0.55.1 via `@monaco-editor/react` 4.7.0
- **Build**: Vite 7.2.4
- **Current Validation**: Custom parser using `@readme/openapi-parser` with inline error markers

### Relevant Files
- `src/features/editor/components/TextEditor.tsx` - Main editor component (102 lines)
- `src/features/editor/hooks/useSpecParser.ts` - Current parsing hook
- `vite.config.ts` - Build configuration
- `package.json` - Dependencies

## Solution Analysis

### Option 1: `monaco-yaml` package (Recommended)

**Pros:**
- Purpose-built for Monaco + YAML
- Uses `yaml-language-server` under the hood
- Simpler integration than full LSP setup
- Supports JSON Schema validation (can use OpenAPI schemas)
- Built-in features: completion, hover, validation, formatting
- Active maintenance, compatible with Monaco 0.55.x

**Cons:**
- No built-in OpenAPI schema (must configure manually)
- Requires Vite worker workaround
- Less control than full LSP setup

### Option 2: Full `monaco-languageclient` setup

**Pros:**
- More flexibility and control
- Can connect to external language servers
- Better for complex multi-language setups

**Cons:**
- Much more complex setup (~300+ lines)
- Requires `@codingame/monaco-vscode-api` (100+ sub-packages)
- Heavier bundle size
- Overkill for single-language YAML/OpenAPI editing

### Recommendation

**Use `monaco-yaml`** - It provides all requested features (smart rename, go-to-definition for $ref, autocomplete, hover docs, validation) with significantly less complexity than the full LSP approach.

## Implementation Approach

### Package Installation

```bash
pnpm add monaco-yaml
```

That's it. No additional packages needed. The package includes:
- YAML language worker
- JSON Schema validation
- All LSP-like features

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    TextEditor.tsx                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Monaco Editor                       │   │
│  │  - YAML language mode                           │   │
│  │  - OpenAPI schema validation                    │   │
│  │  - Autocomplete, hover, diagnostics             │   │
│  └─────────────────────────────────────────────────┘   │
│                         ▲                               │
│                         │ configureMonacoYaml()         │
└─────────────────────────┼───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   yaml.worker.ts                        │
│  - yaml-language-server                                 │
│  - Schema validation                                    │
│  - Completions, hover, formatting                       │
└─────────────────────────────────────────────────────────┘
                          ▲
                          │ JSON Schema
┌─────────────────────────▼───────────────────────────────┐
│              OpenAPI 3.x JSON Schema                    │
│  - https://spec.openapis.org/oas/3.1/schema-base       │
│  - https://spec.openapis.org/oas/3.0/schema            │
└─────────────────────────────────────────────────────────┘
```

### File Changes

#### 1. New File: `src/features/editor/yaml.worker.ts`

Required for Vite compatibility with monaco-yaml's web worker.

```typescript
// Vite workaround for monaco-yaml worker
import 'monaco-yaml/yaml.worker.js';
```

#### 2. New File: `src/features/editor/monacoYamlSetup.ts`

Centralized configuration for monaco-yaml with OpenAPI schemas.

```typescript
import { configureMonacoYaml } from 'monaco-yaml';
import type { Monaco } from '@monaco-editor/react';

export function setupMonacoYaml(monaco: Monaco): void {
  configureMonacoYaml(monaco, {
    enableSchemaRequest: true,
    hover: true,
    completion: true,
    validate: true,
    format: true,
    schemas: [
      {
        uri: 'https://spec.openapis.org/oas/3.1/schema-base/2022-10-07',
        fileMatch: ['*'],
      },
      {
        uri: 'https://spec.openapis.org/oas/3.0/schema/2021-09-28',
        fileMatch: ['*'],
      },
    ],
  });
}
```

#### 3. Modified File: `src/features/editor/components/TextEditor.tsx`

- Import and call `setupMonacoYaml` in `beforeMount` callback
- Configure Monaco environment for YAML worker
- Integrate with existing error marker system

#### 4. Modified File: `vite.config.ts`

Add worker configuration for monaco-yaml.

### Integration with Existing Features

#### Error Markers (Current System)

The existing `parseErrors` from `useSpecParser` will continue to work alongside monaco-yaml validation:

1. **monaco-yaml validation**: Schema-based validation (OpenAPI structure)
2. **Custom parser validation**: Semantic validation (references, relationships)

Both will display as Monaco markers. The marker owner names distinguish them:
- `'openapi'` - Custom parser errors (existing)
- `'yaml'` - monaco-yaml schema errors (new)

#### Source Navigation

The existing `editorStore.revealLine()` and `selectRange()` methods remain unchanged. monaco-yaml adds:
- **Go to Definition**: Click on `$ref` to jump to referenced schema
- **Find References**: Right-click to find all usages

### OpenAPI Schema Configuration

monaco-yaml supports JSON Schema validation. OpenAPI specs are validated against:

| OpenAPI Version | Schema URL |
|-----------------|------------|
| 3.1.x | `https://spec.openapis.org/oas/3.1/schema-base/2022-10-07` |
| 3.0.x | `https://spec.openapis.org/oas/3.0/schema/2021-09-28` |

The schema will be fetched on-demand via `enableSchemaRequest: true`.

## Source Code Structure Changes

### New Files

| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `src/features/editor/yaml.worker.ts` | Vite worker workaround | ~3 |
| `src/features/editor/monacoYamlSetup.ts` | monaco-yaml configuration | ~30 |

### Modified Files

| File | Changes | Lines Changed (est.) |
|------|---------|---------------------|
| `src/features/editor/components/TextEditor.tsx` | Add beforeMount, worker env | ~15 |
| `vite.config.ts` | Worker alias configuration | ~10 |
| `package.json` | Add monaco-yaml dependency | ~1 |

**Total: ~60 lines of new/changed code** (significantly less than original estimate of 200-400 lines)

## Data Model / API / Interface Changes

### No Breaking Changes

- All existing stores remain unchanged
- All existing types remain unchanged
- Existing error marker system continues to work

### New Capabilities

Features enabled by monaco-yaml:

| Feature | Description |
|---------|-------------|
| Schema Autocomplete | Suggests valid OpenAPI properties |
| Hover Documentation | Shows property descriptions from OpenAPI schema |
| Schema Validation | Validates against OpenAPI 3.x JSON Schema |
| `$ref` Navigation | Go to definition for JSON references |
| YAML Anchors | Navigate between `&anchor` and `*alias` |
| Formatting | Prettier-based YAML formatting |
| Document Symbols | Outline view of spec structure |

## Verification Approach

### 1. Build Verification

```bash
pnpm typecheck  # TypeScript compilation
pnpm build      # Production build
pnpm lint       # ESLint checks
```

### 2. Manual Testing Checklist

- [ ] Editor loads without errors
- [ ] Autocomplete appears when typing OpenAPI properties
- [ ] Hover shows documentation for known properties
- [ ] Invalid OpenAPI structure shows validation errors
- [ ] `$ref` values are clickable (go to definition)
- [ ] Existing custom parser errors still display
- [ ] Theme switching works (light/dark)
- [ ] Worker initializes correctly (check console)

### 3. Test Scenarios

**Scenario 1: Autocomplete**
1. Open editor with valid OpenAPI spec
2. Position cursor after `info:` and press Ctrl+Space
3. Expected: Autocomplete shows `title`, `version`, `description`, etc.

**Scenario 2: Validation**
1. Add invalid property `foo: bar` at root level
2. Expected: Red underline with error "Property foo is not allowed"

**Scenario 3: Hover**
1. Hover over `openapi:` property
2. Expected: Tooltip shows "This string MUST be the version number of the OpenAPI Specification..."

**Scenario 4: $ref Navigation**
1. Add `$ref: '#/components/schemas/Pet'`
2. Ctrl+Click on the `$ref` value
3. Expected: Editor navigates to `Pet` schema definition

### 4. Existing Tests

Run existing test suite to ensure no regressions:

```bash
pnpm test
```

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Worker initialization failure | Low | High | Add error boundary, fallback to basic YAML mode |
| Schema fetch failure (network) | Medium | Medium | Graceful degradation - validation still works without schema |
| Conflict with existing markers | Low | Low | Use different marker owner names |
| Bundle size increase | Low | Low | monaco-yaml is ~50KB gzipped, acceptable |

## Dependencies

### Added

| Package | Version | Purpose |
|---------|---------|---------|
| `monaco-yaml` | `^5.x` | YAML language support for Monaco |

### No Changes To

- All existing dependencies remain unchanged
- No peer dependency conflicts expected (monaco-yaml works with Monaco 0.55.x)

## References

- [monaco-yaml GitHub](https://github.com/remcohaszing/monaco-yaml)
- [monaco-yaml Demo](https://monaco-yaml.js.org/)
- [OpenAPI 3.1 Schema](https://spec.openapis.org/oas/3.1/schema-base/2022-10-07)
- [OpenAPI 3.0 Schema](https://spec.openapis.org/oas/3.0/schema/2021-09-28)
- [yaml-language-server](https://github.com/redhat-developer/yaml-language-server)
