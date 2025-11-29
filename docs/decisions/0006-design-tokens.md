# ADR-0006: Design Tokens System

**Date:** 2025-11-28
**Status:** Accepted

## Context

The Flonest application is a mobile-first PWA that requires consistent visual design across components. Initial development used a mix of:

1. **Hardcoded Tailwind classes**: `bg-white`, `text-black`, `p-4`, `rounded-lg`
2. **Inline styles**: `style={{ backgroundColor: '#E2C33D' }}`
3. **Magic numbers**: Spacing values scattered throughout components
4. **Inconsistent colors**: Multiple shades of yellow, gray, etc.

This approach caused several problems:

- **Inconsistency**: Same concept (e.g., "primary color") used different values in different files
- **Hard to Change**: Changing brand colors required find/replace across dozens of files
- **No Single Source of Truth**: No central place to see all design values
- **Cognitive Load**: Developers had to remember arbitrary values
- **Design Drift**: Small variations accumulated over time

For a SaaS product aiming for a polished, professional appearance, this lack of design system was a liability.

## Decision

We will implement a **design tokens system** using CSS custom properties (CSS variables):

### Structure

```css
/* src/styles/design-tokens.css */
:root {
  /* Colors - Brand */
  --color-primary: #E2C33D;       /* Flonest yellow */
  --color-secondary: #1F2937;     /* Dark slate */

  /* Colors - Semantic */
  --text-primary: #000000;
  --text-secondary: #374151;
  --bg-page: #F5F7FA;
  --bg-card: #FFFFFF;

  /* Spacing (8pt grid) */
  --spacing-xs: 0.25rem;   /* 4px */
  --spacing-sm: 0.5rem;    /* 8px */
  --spacing-md: 1rem;      /* 16px */
  --spacing-lg: 1.5rem;    /* 24px */
  --spacing-xl: 2rem;      /* 32px */

  /* Typography */
  --font-size-sm: 0.875rem;  /* 14px */
  --font-size-base: 1rem;    /* 16px */
  --font-size-lg: 1.125rem;  /* 18px */
  --font-size-xl: 1.25rem;   /* 20px */

  /* Border Radius */
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 1rem;      /* 16px */
}
```

### Utility Classes

```css
/* src/styles/design-token-classes.css */
.bg-bg-card { background-color: var(--bg-card); }
.bg-bg-page { background-color: var(--bg-page); }
.text-text-primary { color: var(--text-primary); }
.p-md { padding: var(--spacing-md); }
.rounded-md { border-radius: var(--radius-md); }
```

### Usage Rules

**ALWAYS:**
- ✅ Use utility classes from design-token-classes.css
- ✅ Use CSS variables directly if needed: `var(--color-primary)`
- ✅ Follow the 8pt spacing grid

**NEVER:**
- ❌ Hardcode colors: `bg-white`, `bg-[#E2C33D]`
- ❌ Hardcode spacing: `p-4`, `m-6`
- ❌ Inline styles with hardcoded values

### Examples

```tsx
// ✅ CORRECT - Use utility classes from design tokens
<div className="bg-bg-card text-text-primary p-md rounded-md">
  <h1 className="text-xl font-bold">Title</h1>
</div>

// ✅ CORRECT - Use CSS variables directly if needed
<div style={{ backgroundColor: 'var(--color-primary)' }}>

// ❌ WRONG - Hardcoded Tailwind values
<div className="bg-white text-black p-4 rounded">

// ❌ WRONG - Inline hardcoded values
<div style={{ backgroundColor: '#E2C33D', padding: '16px' }}>
```

## Alternatives Considered

### Alternative 1: Tailwind Config Customization
- **Pros**: Integrates with Tailwind, familiar syntax
- **Cons**: Locked into Tailwind, harder to migrate, less explicit
- **Why rejected**: Want design tokens to be framework-agnostic

### Alternative 2: CSS-in-JS (styled-components, emotion)
- **Pros**: Component-scoped styles, dynamic theming
- **Cons**: Runtime overhead, larger bundle, adds complexity
- **Why rejected**: CSS variables provide theming without JS overhead

### Alternative 3: SCSS Variables
- **Pros**: Powerful preprocessor features
- **Cons**: Requires build step, not runtime-dynamic, less browser support for advanced features
- **Why rejected**: CSS custom properties are native and runtime-dynamic

### Alternative 4: No Design System (Continue as-is)
- **Pros**: No migration effort, full flexibility
- **Cons**: Inconsistency, hard to maintain, unprofessional appearance
- **Why rejected**: Not viable for professional SaaS product

## Consequences

### Positive

- **Consistency**: Single source of truth for all design values
- **Easy Theming**: Change one variable to update entire app
- **Better Naming**: Semantic names like `--text-primary` vs `#000000`
- **8pt Grid**: Enforced spacing system creates visual harmony
- **Easier Maintenance**: Design changes centralized in one file
- **Framework Agnostic**: CSS variables work with any framework
- **No Runtime Cost**: CSS variables are native, zero JS overhead
- **Inspector Friendly**: Easy to debug in browser DevTools
- **Future-Proof**: Foundation for dark mode, custom themes

### Negative

- **Migration Effort**: Must update all existing components
- **Learning Curve**: Team must learn design token names
- **Verbosity**: Class names slightly longer (`bg-bg-card` vs `bg-white`)
- **Enforcement**: Requires code review to prevent hardcoded values
- **Limited Coverage**: Not all Tailwind utilities have token equivalents

### Neutral

- **Two Systems**: Design tokens + Tailwind utilities coexist
- **New Imports**: Must import design token CSS files
- **Documentation**: Need to maintain token reference

## Implementation Notes

### File Structure

```
src/
└── styles/
    ├── design-tokens.css         # CSS custom properties
    ├── design-token-classes.css  # Utility classes
    └── index.css                 # Global styles (imports above)
```

### Migration Strategy

**Phase 1: Create Token System** ✅
- Define CSS variables
- Create utility classes
- Document usage

**Phase 2: Update New Components** ✅
- All new components use design tokens
- Code review enforces tokens

**Phase 3: Migrate Existing Components** (Gradual)
- Update components as they're modified
- No rush, gradual migration
- Focus on high-visibility pages first

### Code Review Checklist

When reviewing PRs, check:
- [ ] No hardcoded colors (`#HEX`, `rgb()`, color names)
- [ ] No hardcoded spacing (`p-4`, `m-6`, inline px values)
- [ ] No hardcoded border radius (`rounded`, `rounded-lg`)
- [ ] Uses design token utility classes or CSS variables
- [ ] Follows 8pt spacing grid

### ESLint Rule (Future)

Consider adding custom ESLint rule to detect hardcoded values:

```javascript
// .eslintrc.js (future)
rules: {
  'no-hardcoded-styles': 'error', // Custom rule
}
```

## Token Categories

### Color Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--color-primary` | #E2C33D | Brand yellow, CTAs, highlights |
| `--color-secondary` | #1F2937 | Dark slate, headers, emphasis |
| `--text-primary` | #000000 | Body text |
| `--text-secondary` | #374151 | Secondary text, labels |
| `--bg-page` | #F5F7FA | Page background |
| `--bg-card` | #FFFFFF | Card/modal background |

### Spacing Tokens (8pt Grid)

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--spacing-xs` | 0.25rem | 4px | Tight spacing |
| `--spacing-sm` | 0.5rem | 8px | Small gaps |
| `--spacing-md` | 1rem | 16px | Default spacing |
| `--spacing-lg` | 1.5rem | 24px | Section spacing |
| `--spacing-xl` | 2rem | 32px | Large gaps |

### Typography Tokens

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--font-size-sm` | 0.875rem | 14px | Small text, labels |
| `--font-size-base` | 1rem | 16px | Body text |
| `--font-size-lg` | 1.125rem | 18px | Subheadings |
| `--font-size-xl` | 1.25rem | 20px | Headings |

### Border Radius Tokens

| Token | Value | Pixels | Usage |
|-------|-------|--------|-------|
| `--radius-sm` | 0.25rem | 4px | Small elements |
| `--radius-md` | 0.5rem | 8px | Cards, buttons |
| `--radius-lg` | 1rem | 16px | Modals, large cards |

## Future Enhancements

**Dark Mode Support**:
```css
@media (prefers-color-scheme: dark) {
  :root {
    --bg-page: #1F2937;
    --bg-card: #374151;
    --text-primary: #FFFFFF;
    /* ... */
  }
}
```

**Custom Themes per Org**:
```css
[data-theme="org-123"] {
  --color-primary: #FF6B6B; /* Custom org color */
}
```

## References

- [design-tokens.css](../../src/styles/design-tokens.css) - Token definitions
- [design-token-classes.css](../../src/styles/design-token-classes.css) - Utility classes
- [CSS Custom Properties (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [Design Tokens W3C Spec](https://tr.designtokens.org/format/)

---

**Author**: Development Team
**Last Updated**: 2025-11-28
