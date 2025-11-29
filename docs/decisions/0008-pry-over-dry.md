# ADR-0008: PRY (Prefer Repeating Yourself) Over DRY

**Date:** 2025-11-28
**Status:** Accepted

## Context

The software engineering principle "Don't Repeat Yourself" (DRY) is widely taught and practiced. DRY advocates abstracting common patterns into reusable functions, components, and modules. The goal is to reduce duplication and make code easier to maintain.

However, DRY can be misapplied, leading to:

1. **Premature Abstraction**: Creating helpers for patterns that only appear 2-3 times
2. **Cognitive Overhead**: Abstractions require understanding the abstraction layer itself
3. **Indirection**: Following code through multiple abstraction layers
4. **Brittleness**: Generic abstractions break when requirements diverge
5. **Over-Engineering**: Building for hypothetical future requirements

For the Flonest project, we observed these anti-patterns:

```typescript
// Example 1: Over-abstracted utility
function getFieldOrDefault(obj: any, field: string, defaultValue: string) {
  return obj?.[field] ?? defaultValue
}
const firstName = getFieldOrDefault(user, 'firstName', 'Unknown')
const lastName = getFieldOrDefault(user, 'lastName', 'Unknown')
const email = getFieldOrDefault(user, 'email', 'Unknown')

// Example 2: Premature helper for one-time operation
function formatProductName(product: Product): string {
  return `${product.brand} ${product.model}`.trim()
}
const displayName = formatProductName(product)
// Used only once in the codebase
```

These abstractions don't reduce complexity—they **add** it by creating indirection without meaningful benefit.

## Decision

We will adopt the **PRY (Prefer Repeating Yourself) principle** as a guideline:

### Core Principle

**Optimize for local clarity over global deduplication.**

### Guidelines

1. **Repeat Code When It Reduces Cognitive Load**
   - Three similar lines are clearer than one abstract helper
   - Copy-paste is acceptable if it improves readability

2. **Defer Abstraction Until Clear Patterns Emerge**
   - Wait for 3-4 genuine uses before abstracting
   - Abstract when the pattern is truly universal, not "might be reused"

3. **Prefer Local Context Over Deep Abstractions**
   - Inline logic is easier to understand than chasing through imports
   - Keep related code close together

4. **Avoid Helpers for One-Time Operations**
   - Don't create `formatX`, `getY`, `validateZ` for single use
   - Inline the logic instead

5. **Don't Design for Hypothetical Futures**
   - Build what's needed **now**, not what "might" be needed
   - Refactor when actual requirements emerge

### When to Abstract

Abstract **only when**:

- **Used 4+ times** across different contexts
- **Complex logic** that benefits from isolation (e.g., GST calculation)
- **Cross-cutting concerns** (logging, auth, error handling)
- **Third-party integration** (Supabase client, API wrappers)
- **Domain models** (Product, Invoice, etc.)

### Examples

**✅ GOOD - Local clarity via repetition:**
```typescript
const firstName = user.firstName || 'Unknown'
const lastName = user.lastName || 'Unknown'
const email = user.email || 'Unknown'
const phone = user.phone || 'Unknown'
```

**❌ BAD - Premature abstraction:**
```typescript
const getFieldOrDefault = (obj: any, field: string) => obj?.[field] || 'Unknown'
const firstName = getFieldOrDefault(user, 'firstName')
const lastName = getFieldOrDefault(user, 'lastName')
const email = getFieldOrDefault(user, 'email')
const phone = getFieldOrDefault(user, 'phone')
```

**✅ GOOD - Inline for one-time use:**
```typescript
const displayName = `${product.brand} ${product.model}`.trim()
```

**❌ BAD - Helper for one-time use:**
```typescript
function formatProductName(product: Product): string {
  return `${product.brand} ${product.model}`.trim()
}
const displayName = formatProductName(product)
```

**✅ GOOD - Abstraction for complex/reused logic:**
```typescript
// Used 10+ times across invoicing system
export function calculateGST(amount: number, gstRate: number, isSameState: boolean) {
  const gstAmount = (amount * gstRate) / 100
  if (isSameState) {
    return {
      cgst: gstAmount / 2,
      sgst: gstAmount / 2,
      igst: 0,
      total: gstAmount,
    }
  }
  return {
    cgst: 0,
    sgst: 0,
    igst: gstAmount,
    total: gstAmount,
  }
}
```

**❌ BAD - Over-abstracted validation:**
```typescript
function validateField(value: string, validators: Validator[]) {
  return validators.every(v => v.fn(value))
}
const isValidEmail = validateField(email, [
  { fn: (v) => v.includes('@'), msg: 'Must include @' },
  { fn: (v) => v.length > 3, msg: 'Too short' },
])
```

**✅ GOOD - Simple inline validation:**
```typescript
const isValidEmail = email.includes('@') && email.length > 3
```

## Alternatives Considered

### Alternative 1: Strict DRY Enforcement
- **Pros**: Maximum code reuse, smaller codebase size
- **Cons**: High abstraction overhead, harder to read/maintain
- **Why rejected**: Cognitive load outweighs LOC savings

### Alternative 2: Zero Repetition Tolerance
- **Pros**: Every pattern abstracted, "elegant" code
- **Cons**: Impossible to maintain, indirection nightmares
- **Why rejected**: Unworkable in practice

### Alternative 3: No Abstraction (Pure Repetition)
- **Pros**: Maximum local clarity, no indirection
- **Cons**: Truly shared logic duplicated (e.g., GST calculations)
- **Why rejected**: Some abstractions are beneficial

### Alternative 4: WET (Write Everything Twice)
- **Pros**: Similar to PRY, wait for duplication before abstracting
- **Cons**: "Twice" is arbitrary, doesn't capture nuance
- **Why rejected**: PRY provides clearer guidance

## Consequences

### Positive

- **Easier to Read**: Less indirection, clearer code flow
- **Easier to Change**: Modify one use case without affecting others
- **Faster Development**: No time spent designing abstractions
- **Less Brittle**: Diverging requirements don't break abstractions
- **Lower Cognitive Load**: Understand code without chasing imports
- **Better Localization**: Related logic stays together

### Negative

- **More Lines of Code**: Repetition increases LOC count
- **Copy-Paste Bugs**: Similar code may have inconsistent implementations
- **Harder to Find All Uses**: Change must be applied to multiple locations
- **Perceived "Messy"**: May feel less "elegant" to DRY purists

### Neutral

- **Judgment Required**: Developers must decide when to abstract
- **Cultural Shift**: Requires unlearning strict DRY teachings
- **Code Review Focus**: Reviewers should challenge premature abstractions

## Implementation Notes

### Code Review Guidelines

**Challenge abstractions with these questions:**

1. How many times is this used? (Need 4+ uses)
2. Is the abstraction simpler than the inline version?
3. Does this reduce cognitive load, or add it?
4. Are we designing for actual requirements, or hypothetical futures?
5. Would a developer understand this faster without the abstraction?

**Reject if:**
- Used only 1-2 times
- More complex than inline code
- Adds indirection without clear benefit
- Designed for "might need later"

### Examples from Codebase

**Accepted Abstractions**:
- `calculateGST()` - Complex logic, used 10+ times
- `useProducts()` - React Query hook, cross-cutting pattern
- `supabase` client - Third-party integration wrapper
- `AuthContext` - Cross-cutting auth state

**Rejected Abstractions** (use inline instead):
- `formatCurrency()` for single use
- `getFieldOrDefault()` for 2 uses
- `validateProductName()` for one form
- Helper components with 1 use

### Metrics to Watch

**Good signs:**
- Developers spend less time navigating code
- Fewer "what does this function do?" questions
- Faster feature development

**Bad signs:**
- Same bug appearing in multiple locations
- Large diffs when changing common patterns
- Developers copy-pasting without understanding

## Exceptions

**Always abstract these:**

1. **Security**: Auth logic, encryption, validation
2. **Compliance**: GST calculations, tax logic
3. **Third-Party APIs**: Supabase, Vercel, external services
4. **Framework Patterns**: React Query hooks, contexts
5. **Domain Models**: Core business entities (Product, Invoice)

Even if used only once, these benefit from abstraction for correctness and testability.

## Evolution of This Decision

This is **not dogma**. If we find that repetition causes real problems (e.g., same bug in 5 places), we should reconsider. The goal is pragmatism, not ideology.

**Re-evaluate if:**
- Same bug appears 3+ times due to repetition
- Developers struggle to maintain repeated patterns
- Genuine shared patterns emerge (4+ uses)

## References

- [Write Code That Is Easy to Delete, Not Easy to Extend](https://programmingisterrible.com/post/139222674273/write-code-that-is-easy-to-delete-not-easy-to)
- [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) - Sandi Metz
- [AHA Programming](https://kentcdodds.com/blog/aha-programming) - Kent C. Dodds
- [Cognitive Load is What Matters](https://github.com/zakirullin/cognitive-load)

## See Also

- `.cursorrules` - Project-specific coding conventions
- ADR-0006: Design Tokens System - Example of beneficial abstraction

---

**Author**: Development Team
**Last Updated**: 2025-11-28
