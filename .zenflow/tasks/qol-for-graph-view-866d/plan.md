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
<!-- chat-id: 5387f548-fc7b-431f-8de1-054f1fd3faec -->

Assess the task's difficulty, as underestimating it leads to poor outcomes.
- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:
- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `{@artifacts_path}/spec.md`:
- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Save to `{@artifacts_path}/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

**Completed**: Difficulty assessed as **medium**. Technical specification saved to `spec.md`.

---

### [x] Step: Create display utilities
<!-- chat-id: 3ebfc485-4e8c-4065-ab96-56f394233dcc -->
- Create `src/utils/displayUtils.ts` with truncation functions:
  - `truncateSchemaName(name: string, mode: DisplayMode): string`
  - `truncateEndpointPath(path: string, mode: DisplayMode): string`
- Export `DisplayMode` type

**Completed**: Created `src/utils/displayUtils.ts` with `DisplayMode` type and both truncation functions.

### [x] Step: Update UI store
<!-- chat-id: 197385dd-3fea-4d61-b3cf-0baa43137007 -->
- Add new state properties to `src/stores/uiStore.ts`:
  - `schemaNameDisplayMode: DisplayMode`
  - `endpointPathDisplayMode: DisplayMode`
  - `compactMode: boolean`
  - `maxNodeWidth: number`
- Add setter actions
- Ensure persistence works with existing `persist` middleware

**Completed**: Added all state properties with defaults (`short` mode, `compactMode: true`, `maxNodeWidth: 250`), setter actions (`setSchemaNameDisplayMode`, `setEndpointPathDisplayMode`, `setCompactMode`, `toggleCompactMode`, `setMaxNodeWidth`), and verified persistence works with existing middleware. Build passes.

### [x] Step: Update SchemaNode component
<!-- chat-id: d1f78fe9-8fb1-4c39-9d04-d44e6432e669 -->
- Import display utilities and UI store
- Apply truncation to schema name display
- Add tooltip showing full name on hover
- Add max-width constraint (`max-w-[250px]`)

**Completed**: Updated `src/features/graph/components/SchemaNode.tsx`:
- Imported `useUIStore` and `truncateSchemaName`
- Added logic to compute `displayName` based on `compactMode` and `schemaNameDisplayMode`
- Added tooltip that shows full schema name when name is truncated
- Applied `maxNodeWidth` as max-width style when compact mode is enabled
- Build passes

### [x] Step: Update EndpointNode component
<!-- chat-id: 375b928d-e08f-488a-b78b-5259a23765a2 -->
- Apply truncation to endpoint path display
- Add tooltip showing full path on hover
- Add max-width constraint

**Completed**: Updated `src/features/graph/components/EndpointNode.tsx`:
- Imported `useUIStore`, `truncateEndpointPath`, and Tooltip components
- Added logic to compute `displayPath` based on `compactMode` and `endpointPathDisplayMode`
- Added tooltip that shows full endpoint path when path is truncated
- Applied `maxNodeWidth` as max-width style when compact mode is enabled
- Build passes

### [x] Step: Update FilterToolbar
<!-- chat-id: c54b5795-0410-414d-8a1e-b513e38585c7 -->
- Add compact mode toggle button with appropriate icon
- Add display mode dropdown for fine-grained control (schema name mode, endpoint path mode)

**Completed**: Updated `src/features/graph/components/FilterToolbar.tsx`:
- Added compact mode toggle button with Minimize2Icon/Maximize2Icon icons that toggle based on current state
- Added visual separators to distinguish display controls from filter controls
- Added display settings dropdown (gear icon) with radio groups for:
  - Schema Name Display: Full / Medium (last 2 parts) / Short (last part only)
  - Endpoint Path Display: Full / Medium (last 2 segments) / Short (last segment only)
- All controls connected to UI store state and persist correctly
- Build passes

### [x] Step: Testing and polish
<!-- chat-id: 47384786-73a7-4bdf-a0e4-d717f9ae1869 -->
- Test with `evidence-proven-data-api-spec.yaml` file
- Verify tooltips work correctly
- Verify persistence of settings
- Run `npm test` and `npm run lint`
- Adjust default values if needed

**Completed**: All verification steps passed:
- All 88 tests pass (`npm test`)
- No lint errors (`npm run lint`)
- Build succeeds (`npm run build`)
- Display utilities correctly truncate long schema names like `Force.Mortgages.Evidence.Services.Api.V1.ProvenData.RealEstate.RealEstate`:
  - Full: Full name
  - Medium: `RealEstate.RealEstate`
  - Short: `RealEstate`
- Endpoint path truncation works correctly for `/api/v1/dossiers/{dossierReference}/proven-data/real-estate`:
  - Full: Full path
  - Medium: `…/proven-data/real-estate`
  - Short: `…/real-estate`
- Persistence configured via zustand's `persist` middleware with storage key `'openapi-viz-ui'`
- SchemaNode and EndpointNode components show tooltips with full names when truncated
- FilterToolbar has compact mode toggle and display settings dropdown for fine-grained control
