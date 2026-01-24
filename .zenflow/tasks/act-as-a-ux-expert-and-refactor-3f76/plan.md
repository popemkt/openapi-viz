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
<!-- chat-id: ddbb8843-9bee-4301-a9d5-5772afe27f8b -->

**Completed**: Created comprehensive UX audit with findings documented in `spec.md`:
- Identified FilterToolbar overwhelm (15+ controls, no hierarchy)
- Identified BulkActionsToolbar positioning and clarity issues
- Identified top toolbar density problems
- Defined UX design principles (progressive disclosure, visual hierarchy)
- Created detailed implementation approach with 4 phases
- Mapped all files to modify

**Difficulty Assessment**: Medium-Hard

---

### [x] Step: Create Segmented Control Component
<!-- chat-id: 461c38bf-3186-417c-a4c6-3a63cd2b9207 -->

Create a reusable segmented control component as an alternative to icon-only toggles.

**Files to create:**
- `src/components/ui/segmented-control.tsx`

**Requirements:**
- Support for 2-3 options
- Clear visual indication of selected state
- Labels (not just icons)
- Consistent with existing Radix UI + Tailwind patterns
- Support for icon + label combinations

**Verification:**
- Component builds without errors
- Component can be imported and used in FilterToolbar

**Completed**: Created `src/components/ui/segmented-control.tsx` with:
- Generic TypeScript support for type-safe option values
- CVA-based variants consistent with existing button/toggle patterns
- Uses Radix UI ToggleGroup primitive for accessibility
- Supports icon + label combinations with `iconOnly` prop
- Three sizes (sm, default, lg)
- Clear active/inactive visual states with subtle shadow on active
- Prevents deselection (always requires a selected value)
- Verified: TypeScript compiles, lint passes

---

### [x] Step: Refactor FilterToolbar Layout
<!-- chat-id: 110f8cf3-6d25-403e-afc5-d6d134d93383 -->

Restructure the FilterToolbar from a flat horizontal layout to organized sections.

**Files to modify:**
- `src/features/graph/components/FilterToolbar.tsx`

**Changes:**
1. Reorganize into 3 logical sections:
   - Search section (search input + path pattern with label)
   - Node visibility section (Endpoints/Schemas as segmented control)
   - Filter mode section (Highlight/Hide as segmented control)
2. Consolidate display settings:
   - Create "View" dropdown combining compact level + display modes
   - Create "Layout" dropdown with direction + spacing
3. Clean up HTTP Methods and Tags dropdowns (add labels)
4. Remove duplicate hidden nodes indicator (defer to BulkActionsToolbar)
5. Simplify active filters indicator

**Verification:**
- All existing filter functionality works
- Controls are labeled and understandable without tooltips
- Visual grouping is clear

**Completed**: Refactored `src/features/graph/components/FilterToolbar.tsx` with:
- **Section 1 (Search & Path Filter)**: Search input with wider min-width + Path pattern with "Path:" label
- **Section 2 (Node Visibility & Filter Mode)**:
  - Replaced icon-only toggles with labeled SegmentedControl for node visibility (All/Endpoints/Schemas)
  - Replaced filter mode toggle with labeled SegmentedControl (Highlight/Hide)
  - Added "Show:" and "Filter:" labels for clarity
- **Section 3 (View & Layout Settings)**:
  - Combined compact level cycle button + display settings into single "View" dropdown with SegmentedControl for detail level
  - Added labels to "View" and "Layout" dropdown buttons
  - Simplified spacing presets in Layout dropdown (removed parenthetical numbers)
- **Section 4 (HTTP Methods & Tags)**: Kept existing dropdowns with clear labels
- Removed duplicate hidden nodes indicator (now only in BulkActionsToolbar)
- Replaced badge+X button filter indicator with simpler "Clear (N)" ghost button
- Added `setShowEndpoints` and `setShowSchemas` functions to filterStore
- Verified: Build and lint pass

---

### [ ] Step: Improve BulkActionsToolbar

Improve clarity and reduce duplication in the bulk actions toolbar.

**Files to modify:**
- `src/features/graph/components/BulkActionsToolbar.tsx`

**Changes:**
1. Add text labels to action buttons (Hide, Focus, Expand, Clear)
2. Consolidate as the single location for hidden nodes indicator
3. Improve visual design of action buttons
4. Consider repositioning if overlap issues persist

**Verification:**
- All selection actions work correctly
- Hidden nodes indicator is clear and functional
- Keyboard shortcuts still work (Del, Esc)

---

### [ ] Step: Polish Top Toolbar

Improve the header toolbar with clearer labels and reduced density.

**Files to modify:**
- `src/app/Layout.tsx`

**Changes:**
1. Add text labels to file operations (New, Open, Save)
2. Create labeled "Export" dropdown button
3. Simplify parse status display (icon + hover for details)
4. Add labels to view mode toggle (Editor, Split, Graph)

**Verification:**
- All file operations work correctly
- Export functionality preserved
- View mode switching works
- Parse status information accessible

---

### [ ] Step: Final Testing and Verification

Comprehensive testing of all changes.

**Verification steps:**
1. Run `npm run build` - no errors
2. Run `npm run lint` - no warnings
3. Run `npm run test` - all tests pass
4. Manual testing:
   - Filter by search, path pattern
   - Toggle node types
   - Change filter display mode
   - Adjust compact level and display modes
   - Change layout direction and spacing
   - Filter by HTTP methods and tags
   - Select nodes and use bulk actions
   - Hide/unhide nodes
   - File operations (new, open, save)
   - Export operations
   - View mode switching
   - Theme switching
5. Verify no regression in functionality
6. Write report to `report.md`

---

### [ ] Step: Implementation Report

Write final implementation report.

**File to create:**
- `.zenflow/tasks/act-as-a-ux-expert-and-refactor-3f76/report.md`

**Contents:**
- What was implemented
- How the solution was tested
- Before/after comparison
- Challenges encountered
