# MCP Server Configuration

This project uses Model Context Protocol (MCP) servers for GitHub and Supabase integration in Cursor.

## Configuration Location

MCP servers are configured in `.cursor/mcp.json` (project-specific).

**Note:** This file is gitignored to protect sensitive tokens.

## Current Setup

- **GitHub MCP Server**: Connected to `krishamaze/biz.finetune.store`
- **Supabase MCP Server**: Connected to project `yzrwkznkfisfpnwzbwfw`

## Setup for New Projects

1. Create `.cursor/mcp.json` in project root
2. Add GitHub fine-grained PAT (scoped to specific repository)
3. Add Supabase access token and project_ref
4. Restart Cursor

## Security

- Tokens are stored directly in `.cursor/mcp.json` (not in `.env`)
- File is gitignored to prevent committing tokens
- Use fine-grained GitHub PATs scoped to single repositories
- Each project can have its own MCP configuration

## Available MCP Tools

### GitHub
- List/search repositories
- Create/update pull requests
- Manage issues
- Search code
- And more...

### Supabase (Primary Method for Database Operations)

#### Daily Operations (Use MCP instead of CLI)

**Apply Migrations:**
```
"Apply migration 20251110000000_add_tax_rate_to_products"
```
- Replaces: `npm run supabase:db:push`
- Faster and integrated with Cursor

**Generate TypeScript Types:**
```
"Generate TypeScript types for my Supabase database"
```
- Replaces: `npm run supabase:types`
- Outputs directly to `src/types/database.ts`

**Query Database:**
```
"Query my database: SELECT * FROM products LIMIT 10"
"Show me all tables in my database"
"List all migrations"
```
- Direct SQL execution
- No CLI needed

**View Logs:**
```
"Show me Supabase API logs"
"Show me Postgres logs"
```
- Real-time log access
- Filter by service type

#### Other Available Operations

- `list_tables` - List all database tables
- `list_migrations` - View applied migrations
- `execute_sql` - Run SQL queries
- `get_logs` - View service logs
- `get_advisors` - Security/performance recommendations
- `generate_typescript_types` - Generate TypeScript types
- `list_edge_functions` - View Edge Functions
- And more...

## Workflow Examples

### Example 1: Apply a Migration

**Old way (CLI):**
```bash
npm run supabase:db:push
```

**New way (MCP):**
In Cursor chat:
```
"Apply migration 20251110000000_add_tax_rate_to_products"
```

### Example 2: Generate TypeScript Types

**Old way (CLI):**
```bash
npm run supabase:types
```

**New way (MCP):**
In Cursor chat:
```
"Generate TypeScript types for my Supabase database"
```

### Example 3: Query Database

**Old way:**
- Open Supabase Dashboard
- Navigate to SQL Editor
- Write and run query

**New way (MCP):**
In Cursor chat:
```
"Query my database: SELECT COUNT(*) FROM products WHERE status = 'active'"
```

## When to Still Use CLI

Use Supabase CLI only for:
- Creating new migration files: `npm run supabase:migration:new <name>`
- Generating schema diffs: `npm run supabase:db:diff`
- One-time setup: `npm run supabase:link`

