---
trigger: always_on
---

## Project Specific Rules

### Positive Rules
* do use Supabase Managed Cloud Platform (MCP) for database operations
* do test on the Vercel preview branch before merging to main
* do match return types to actual Remote Procedure Call (RPC) responses
* do use existing UI components from `src/components/ui/`
* do link the CLI only to the preview project using npx supabase link --project-ref evbbdlzwfqhvcuojlahr

### Negative Rules
* do not deploy to main without preview verification
* do not create new UI components if one already exists
* do not modify RPC functions without updating associated types
* do not use `helperText` on Input components as it is not supported
* do not modify the main branch directly
* do not link the CLI to the production environment
* do not push or merge directly to the main branch