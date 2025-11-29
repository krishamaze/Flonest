# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for the Flonest project. ADRs document significant architectural and technical decisions made during development.

## What is an ADR?

An Architecture Decision Record (ADR) is a document that captures an important architectural decision made along with its context and consequences. ADRs help:

- **Preserve Context**: Understand why decisions were made months or years later
- **Onboard New Team Members**: Quickly understand the architectural evolution
- **Avoid Revisiting Settled Debates**: Prevent re-discussing already-decided topics
- **Document Trade-offs**: Explicitly capture the pros and cons of each decision

## ADR Format

Each ADR follows this structure:

```markdown
# ADR-XXXX: Title in Title Case

**Date:** YYYY-MM-DD
**Status:** [Proposed | Accepted | Deprecated | Superseded]
**Supersedes:** ADR-YYYY (if applicable)

## Context

What is the issue we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

### Positive
- Benefits and advantages of this decision

### Negative
- Drawbacks and trade-offs
- Technical debt or complexity introduced
```

## Index of ADRs

### Active Decisions

| ADR | Title | Date | Status |
|-----|-------|------|--------|
| [0000](./0000-branch-hygiene.md) | Zero-Orphan Branch Policy | 2025-11-28 | Active |
| [0001](./0001-cloud-only-development.md) | Cloud-Only Development (No Local Supabase) | 2025-11-28 | Accepted |
| [0002](./0002-smart-identifier-input.md) | Smart Identifier Input | 2025-11-28 | Accepted |
| [0003](./0003-react-query-auth.md) | React Query for Auth State Management | 2025-11-27 | Accepted |
| [0004](./0004-git-based-migrations.md) | Git-Based Database Migrations | 2025-11-28 | Accepted |
| [0005](./0005-mock-auth-testing.md) | Mock Authentication for E2E Testing | 2025-11-27 | Accepted |
| [0006](./0006-design-tokens.md) | Design Tokens System | 2025-11-28 | Accepted |
| [0007](./0007-multi-tenant-rls.md) | Multi-Tenant Architecture with RLS | 2025-11-28 | Accepted |
| [0008](./0008-pry-over-dry.md) | PRY (Prefer Repeating Yourself) Over DRY | 2025-11-28 | Accepted |

### Superseded/Deprecated

| ADR | Title | Date | Status | Reason |
|-----|-------|------|--------|--------|
| - | Local Supabase Development | 2025-11-25 | Deprecated | Replaced by ADR-0001 (Cloud-Only) |

## Creating a New ADR

1. **Determine the Next Number**: Check the index above for the next available ADR number
2. **Copy the Template**: Use [TEMPLATE.md](./TEMPLATE.md) as a starting point
3. **Name the File**: Use format `XXXX-kebab-case-title.md`
4. **Fill in All Sections**: Ensure context, decision, and consequences are clear
5. **Update This Index**: Add your ADR to the table above
6. **Commit with Descriptive Message**: `docs: add ADR-XXXX for [decision title]`

## When to Create an ADR

Create an ADR when:

- **Choosing between architectural patterns** (e.g., Context vs Redux, REST vs GraphQL)
- **Adopting new technologies** (e.g., React Query, Supabase, Vercel)
- **Changing development workflows** (e.g., cloud-only, git-based migrations)
- **Establishing coding conventions** (e.g., PRY over DRY, design tokens)
- **Making security decisions** (e.g., RLS policies, auth patterns)
- **Defining deployment strategies** (e.g., branch-to-environment mapping)

Don't create an ADR for:

- **Bug fixes** (use commit messages)
- **Routine refactoring** (use commit messages)
- **Minor UI tweaks** (use commit messages)
- **Temporary decisions** (use comments in code)

## Changing an ADR

ADRs are **immutable once accepted**. If you need to change a decision:

1. **Create a New ADR**: Write a new ADR that supersedes the old one
2. **Link the ADRs**: Reference the old ADR in the new one
3. **Update Status**: Mark the old ADR as "Superseded by ADR-XXXX"
4. **Update the Index**: Move the old ADR to "Superseded/Deprecated" section

## Reviewing ADRs

ADRs should be:

- **Reviewed periodically** (quarterly or when major changes occur)
- **Referenced in code** (link to ADRs in comments for context)
- **Discussed in onboarding** (new team members should read key ADRs)
- **Updated** (add notes/amendments if new information emerges)

## Questions?

If you're unsure whether to create an ADR or have questions about the format, ask in the team chat or create a draft for review.

---

**Last Updated**: 2025-11-28
