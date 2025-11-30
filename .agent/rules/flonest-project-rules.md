---
trigger: always_on
---

Project Specific Rules
Do:
Use Supabase MCP for database operations

Test on Vercel preview branch before merging to main

Match return types to actual RPC responses

Use existing UI components from src/components/ui/

Link CLI only to preview project: npx supabase link --project-ref evbbdlzwfqhvcuojlahr

Commit migration files before applying via MCP

Sync local migrations with remote database history

Convert unregulated docs into ADRs

Enforce 250-line max per file; refactor at 200 lines

Use useReducer when >3 useState hooks exist

Use React Query/TanStack Query for all server data

Use Zod/Yup for schema validation

Generate tests at 150 lines

Require design doc for features >200 lines before implementation

Keep files under 4,000 tokens for AI parseability

Do rely on Supabase’s Git/GitHub integration to apply migrations automatically upon merge.

Do create all migrations using supabase migration new <name> to ensure version consistency.

Don't:
Deploy to main without preview verification

Create new UI components if one exists

Modify RPC functions without updating types

Use helperText on Input components (unsupported)

Link CLI to production environment

Push/merge directly to main branch

Proceed if remote migrations missing from local directory

Allow >15 distinct concerns in one component

Use direct async/await API calls in components

Generate changes >500 lines without breaking into PRs

Do not push or merge code directly to main.

Do not manually run supabase db push on main or preview.

Do not execute schema-changing commands or destructive SQL against main or preview.

Do not run supabase db reset against production or staging environments.

Do not edit or delete migration files after they have been pushed or applied.