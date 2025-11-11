# MCP-First Workflow Guide

This project uses **MCP (Model Context Protocol)** as the primary method for Supabase and GitHub operations. Use CLI only when MCP cannot perform the task.

## Quick Reference

### ✅ Use MCP (Via Cursor Chat)

| Task | MCP Command (in Cursor chat) | Old CLI Command |
|------|------------------------------|-----------------|
| Apply migration | "Apply migration [name]" | `npm run supabase:db:push` |
| Generate types | "Generate TypeScript types" | `npm run supabase:types` |
| Query database | "Query my database: SELECT..." | N/A |
| List tables | "List my tables" | N/A |
| View logs | "Show Supabase logs" | N/A |
| List migrations | "List all migrations" | N/A |

### ⚙️ Use CLI (When MCP Can't Do It)

| Task | CLI Command | Why CLI? |
|------|-------------|----------|
| Create migration | `npm run supabase:migration:new <name>` | Creates local file |
| Schema diff | `npm run supabase:db:diff` | Compares local vs remote |
| Link project | `npm run supabase:link` | One-time setup |

## Common Workflows

### Daily Development

**Apply a Migration:**
```
In Cursor: "Apply migration 20251110000000_add_tax_rate"
```

**Generate Types After Schema Change:**
```
In Cursor: "Generate TypeScript types for my database"
```

**Check Database State:**
```
In Cursor: "List all tables in my database"
In Cursor: "Query my database: SELECT COUNT(*) FROM products"
```

### Creating New Migrations

**Step 1: Create Migration File (CLI required)**
```bash
npm run supabase:migration:new add_new_feature
```

**Step 2: Write SQL in the migration file**

**Step 3: Apply Migration (Use MCP)**
```
In Cursor: "Apply migration add_new_feature"
```

**Step 4: Generate Types (Use MCP)**
```
In Cursor: "Generate TypeScript types"
```

## Benefits of MCP-First Approach

1. **Faster**: No terminal switching needed
2. **Integrated**: Works directly in Cursor chat
3. **Context-aware**: AI understands your codebase
4. **Less error-prone**: No copy-paste of commands
5. **Documented**: Chat history serves as documentation

## Setup

See:
- [MCP Setup Guide](../.cursor/MCP_SETUP.md) - MCP configuration
- [Supabase CLI Setup](../SUPABASE_CLI_SETUP.md) - CLI setup (for tasks MCP can't do)

