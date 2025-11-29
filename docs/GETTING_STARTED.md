# Getting Started

Quick guide to set up and run the bill.finetune.store inventory management PWA.

## Prerequisites

- **Node.js** 18+ and npm
- **Supabase** account and project ([supabase.com](https://supabase.com))
- **Git** (optional, for version control)

> **Note:** This project uses cloud-only development (no Docker required). All database operations work directly against your cloud Supabase project via the CLI.

## Installation

### 1. Clone or Download

```bash
cd bill.finetune.store
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase CLI

Login to Supabase CLI (one-time setup):

```bash
npx supabase login
```

This will open your browser to authenticate and store your access token.

### 4. Link to Cloud Project

Link your local project to the cloud Supabase project:

```bash
npm run supabase:link
```

Or manually:

```bash
npx supabase link --project-ref yzrwkznkfisfpnwzbwfw
```

### 5. Set Up Environment Variables

Create a `.env` file from the example:

```bash
# Copy from example
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
# App Runtime (Frontend)
VITE_SUPABASE_URL=https://yzrwkznkfisfpnwzbwfw.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here

# CLI Authentication (from npx supabase login)
SUPABASE_ACCESS_TOKEN=your-access-token-here

# Database URLs (optional, for direct DB access)
DATABASE_URL=postgresql://postgres.yzrwkznkfisfpnwzbwfw:your-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
DATABASE_DIRECT_URL=postgresql://postgres:your-password@db.yzrwkznkfisfpnwzbwfw.supabase.co:5432/postgres
```

**Get these from:**
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`: Supabase Dashboard → Project Settings → API
- `SUPABASE_ACCESS_TOKEN`: Automatically stored after `npx supabase login`
- `DATABASE_URL`: Supabase Dashboard → Project Settings → Database → Connection Pooling

### 6. Set Up Database

The database schema is managed through migrations. Migrations are already set up in `supabase/migrations/`.

To apply migrations to your cloud database:

```bash
npm run db:migrate
```

Or manually:

```bash
npx supabase db push --linked
```

**For initial setup**, you can also run SQL directly in Supabase SQL Editor if needed:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  tenant_id UUID REFERENCES tenants(id),
  role TEXT CHECK (role IN ('admin', 'branch_head', 'advisor')),
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  name TEXT NOT NULL,
  sku TEXT,
  description TEXT,
  price DECIMAL(10,2),
  quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory transactions table
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID REFERENCES tenants(id),
  product_id UUID REFERENCES products(id),
  type TEXT CHECK (type IN ('in', 'out', 'adjustment')),
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (basic - expand as needed)
CREATE POLICY "Users can view their tenant" ON tenants
  FOR SELECT USING (id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view their profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view their tenant's products" ON products
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can view their tenant's transactions" ON inventory_transactions
  FOR SELECT USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));
```

### 7. Generate TypeScript Types

After setting up the database, generate TypeScript types:

```bash
npm run db:types
```

Or manually:

```bash
npx supabase gen types typescript --linked > src/types/database.ts
```

### 8. Create Test Data (Optional)

```sql
-- Insert test tenant
INSERT INTO tenants (id, name) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Test Company');

-- Create a user in Supabase Auth first, then:
INSERT INTO users (id, email, tenant_id, role, full_name) VALUES 
  ('your-auth-user-id', 'test@example.com', '00000000-0000-0000-0000-000000000001', 'admin', 'Test User');

-- Insert test products
INSERT INTO products (tenant_id, name, sku, price, quantity) VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Widget A', 'WDG-001', 99.99, 50),
  ('00000000-0000-0000-0000-000000000001', 'Widget B', 'WDG-002', 149.99, 5);
```

## Running the App

### Development Mode

```bash
npm run dev
```

Open http://localhost:3000

### Production Build

```bash
npm run build
npm run preview
```

## First Login

1. Visit http://localhost:3000
2. Click "Sign Up" (or use Supabase Dashboard to create user)
3. Enter email and password
4. After signup, add user to `users` table with SQL:
   ```sql
   INSERT INTO users (id, email, tenant_id, role, full_name) 
   VALUES ('user-id-from-auth', 'email@example.com', 'tenant-id', 'admin', 'Your Name');
   ```

## Project Structure

```
biz.finetune.store/
├── docs/                    # Documentation
├── public/                  # Static assets
│   ├── manifest.webmanifest # PWA manifest
│   └── PWA_ICONS_README.txt # Icon generation guide
├── scripts/                 # Utility scripts
│   └── deploy-check.js      # Pre-deployment validation
├── src/
│   ├── components/          # React components
│   │   ├── forms/          # Form components
│   │   ├── layout/         # Layout components
│   │   └── ui/             # Reusable UI components
│   ├── contexts/           # React contexts (Auth, etc.)
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Libraries (Supabase client)
│   ├── pages/              # Page components
│   ├── styles/             # Global styles
│   ├── types/              # TypeScript types
│   ├── utils/              # Utility functions
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── .env.example            # Environment variables template
├── .gitignore              # Git ignore rules
├── index.html              # HTML template
├── package.json            # Dependencies
├── postcss.config.js       # PostCSS configuration
├── tsconfig.json           # TypeScript configuration
├── vercel.json             # Vercel deployment config
└── vite.config.ts          # Vite configuration
```

## Available Scripts

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run deploy:check # Validate deployment readiness
```

### Supabase CLI
```bash
npm run supabase:link        # Link to cloud project
npm run supabase:status      # Check project status
npm run supabase:db:diff     # Generate migration from schema diff
npm run supabase:db:push     # Push migrations to cloud
npm run supabase:db:reset    # Reset cloud database (⚠️ DESTRUCTIVE)
npm run supabase:types       # Generate TypeScript types
npm run supabase:migration:new <name>  # Create new migration

# Convenience aliases
npm run db:migrate   # Alias for supabase:db:push
npm run db:types     # Alias for supabase:types
```

See `docs/CLOUD_DEV_WORKFLOW.md` for detailed workflow documentation.

## Troubleshooting

### Build Errors

**TypeScript errors:**
```bash
npx tsc --noEmit
```

**Clear cache:**
```bash
rm -rf node_modules dist
npm install
npm run build
```

### Authentication Issues

**User not loading:**
- Check user exists in `users` table
- Verify `tenant_id` is set
- Check RLS policies in Supabase

**Login fails:**
- Verify Supabase credentials in `.env`
- Check Supabase Auth settings
- Look for errors in browser console

**Blank Screen on Navigation:**
- Check for unhandled loading states in routing components
- Ensure `RoleRedirect` and protected routes return a loading spinner (not `null`) while auth is initializing
- Verify `AuthContext` state using React DevTools

### PWA Issues

**Service worker not registering:**
- PWA only works over HTTPS (or localhost)
- Check browser console for errors
- Clear browser cache and reload

**App not installable:**
- Add PWA icons (see `public/PWA_ICONS_README.txt`)
- Verify `manifest.webmanifest` is accessible
- Check manifest in DevTools → Application → Manifest

## Next Steps

1. **Set Up Database** - Run `npm run db:migrate` to apply migrations
2. **Generate Types** - Run `npm run db:types` to update TypeScript types
3. **Start Development** - Run `npm run dev` and visit http://localhost:3000
4. **Learn Workflow** - See `docs/CLOUD_DEV_WORKFLOW.md` for development workflow
5. **Add PWA Icons** - See `public/PWA_ICONS_README.txt`
6. **Customize Branding** - Update colors in `src/styles/index.css`
7. **Deploy** - See `docs/DEPLOYMENT.md`
8. **Add Features** - Start with Sprint 2 (Inventory Management)

## Support

- **Documentation:** See `docs/` folder
- **Issues:** Check browser console and Supabase logs
- **Supabase Docs:** https://supabase.com/docs
- **Vite Docs:** https://vitejs.dev
- **React Docs:** https://react.dev

## License

MIT

