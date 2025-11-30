# ADR-003: Component Refactoring Pattern for Large Features

**Status**: Accepted  
**Date**: 2025-12-01  
**Context**: InvoiceForm refactor (Nov 2025)

## Decision

When refactoring large, complex React components (>300 lines), we follow a three-phase pattern: **UI Decomposition → Behavioral Extraction → Validation**.

### Phase 1: UI Decomposition (Pure Components First)

**Pattern**: Split by responsibility, not by size
- Identify the natural feature boundaries (e.g., steps, sections, panels)
- Extract pure presentational components with semantic props
- Keep orchestration in a single feature container
- Move UI logic into small, testable view components

**Example**: `InvoiceForm` → `CustomerStep`, `ItemsStep`, `ReviewStep`

**Rules**:
- Each view component < 300 lines
- Props should be semantic and self-documenting
- No direct state mutations in view components
- Container component only coordinates, doesn't render complex UI

### Phase 2: Behavioral Extraction (Copy → Switch → Delete)

**Pattern**: Treat behavior subsystems as self-contained units
1. **Copy**: Implement the new abstraction (hook/lib) while old code still exists
2. **Switch**: Update the container to use the new abstraction
3. **Delete**: Remove the old implementation only after behavior is proven identical

**Example**: Draft handling → `useInvoiceDraft` hook (staged, not yet migrated)

**Anti-pattern**: ❌ "Nibbling variables" (moving state piece-by-piece while changing behavior)

**Correct approach**: ✅ Complete subsystem migration with a working reference implementation

**Rules**:
- Never change behavior and structure at the same time
- Keep the old implementation as a reference during migration
- Stub the new abstraction with clear seams (e.g., `// TODO: migrate draft state here`)
- Validate behavior identity before deleting old code

### Phase 3: Validation

**Before merging**:
- ✅ All components < 300 lines
- ✅ UI components are pure (no side effects)
- ✅ Business logic lives in hooks/libs, not in JSX
- ✅ Container only coordinates, doesn't own complex rendering
- ✅ Build passes, tests pass, types are correct

## Rationale

1. **AI-agent friendly**: Smaller files, semantic props, and clear boundaries improve tool accuracy
2. **Maintainability**: Separation of concerns makes changes safer and easier to reason about
3. **Testability**: Pure view components and isolated business logic are easier to test
4. **Iterative safety**: Staged refactors with working references reduce regression risk

## Generalization to Flonest Codebase

This pattern applies to:
- **Settings page**: Split by panels/sections, extract shared behavior into hooks
- **Large pages**: Separate read/write/action concerns into modules
- **Fat API modules**: Extract domain logic into composable functions

## Hard Rules for AI Agents

To maintain this architecture:
1. ❌ No new components > 300 lines
2. ✅ New behavior must go behind a hook or lib if reused
3. ✅ Keep "container vs view" separation explicit
4. ✅ Always stage large refactors (don't mix behavior + structure changes)

## References

- InvoiceForm refactor: See `src/components/forms/InvoiceForm.tsx`
- Stubbed hook seam: See `src/hooks/invoice/useInvoiceDraft.ts`
- Step components: See `src/components/forms/invoice-steps/`

---

**Next Application**: Apply this pattern to Settings page and InventoryPage.
