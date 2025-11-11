# Supabase CLI Setup

> **Note:** This project uses **MCP (Model Context Protocol)** as the primary method for Supabase operations. Use CLI only when MCP cannot perform the task (e.g., creating migration files).

## Quick Start

### 1. Login to Supabase CLI (One-time setup)

```bash
npx supabase login
```

This opens your browser to authenticate and stores your access token.

### 2. Set Environment Variables

Add these to your `.env` file:

```env
# CLI Authentication (from npx supabase login)
SUPABASE_ACCESS_TOKEN=your-access-token-here

# Database password for CLI operations
SUPABASE_DB_PASSWORD=your-database-password-here
```

**Get these from:**
- `SUPABASE_ACCESS_TOKEN`: Automatically stored after `npx supabase login`
- `SUPABASE_DB_PASSWORD`: Supabase Dashboard → Project Settings → Database

### 3. Link Project (One-time setup)

```bash
npm run supabase:link
```

This links your local project to the cloud Supabase project using direct connection (no Docker required).

## MCP vs CLI: When to Use What

### ✅ Use MCP (Recommended for daily operations)

| Operation | MCP Method | CLI Alternative |
|-----------|-----------|-----------------|
| Apply migrations | Use Cursor chat: "Apply migration X" | `npm run supabase:db:push` |
| Generate TypeScript types | Use Cursor chat: "Generate TypeScript types" | `npm run supabase:types` |
| Query database | Use Cursor chat: "Query my database..." | N/A |
| List tables | Use Cursor chat: "List my tables" | N/A |
| View logs | Use Cursor chat: "Show Supabase logs" | N/A |

**Benefits:**
- Faster workflow (no terminal needed)
- Integrated with Cursor chat
- Direct database access
- See [MCP Setup Guide](.cursor/MCP_SETUP.md) for details

### ⚙️ Use CLI (Required for specific tasks)

| Operation | CLI Command | Why CLI is needed |
|-----------|-------------|-------------------|
| Create migration file | `npm run supabase:migration:new <name>` | Creates local file in `supabase/migrations/` |
| Generate schema diff | `npm run supabase:db:diff` | Compares local vs remote schema |
| Check status | `npm run supabase:status` | Shows local Supabase status |

## Available Commands

### CLI Commands (Use when MCP can't do it)

```bash
# Link to cloud project (one-time)
npm run supabase:link

# Check status
npm run supabase:status

# Create new migration file (CLI only)
npm run supabase:migration:new <name>

# Generate schema diff (CLI only)
npm run supabase:db:diff
```

### MCP Operations (Use via Cursor chat)

- Apply migrations: Ask Cursor to apply a migration
- Generate types: Ask Cursor to generate TypeScript types
- Query database: Ask Cursor to run SQL queries
- List tables: Ask Cursor to show database tables
- View logs: Ask Cursor to show service logs

See [MCP Setup Guide](.cursor/MCP_SETUP.md) for complete list.

## Project Details

- **Project Ref**: `yzrwkznkfisfpnwzbwfw`
- **Connection**: Direct connection (--skip-pooler) - No Docker required
- **Migrations**: Stored in `supabase/migrations/`

## Troubleshooting

### Missing Environment Variables

If you see "Missing required environment variables":
1. Check your `.env` file exists
2. Ensure `SUPABASE_DB_PASSWORD` and `SUPABASE_ACCESS_TOKEN` are set
3. Run `npx supabase login` if access token is missing

### Connection Timeout

The CLI uses direct connection (--skip-pooler) to avoid timeout issues. If you still experience problems:
1. Check your network connection
2. Verify database password is correct
3. Try unlink and re-link: `npx supabase unlink && npm run supabase:link`
