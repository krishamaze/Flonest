# Getting Started

Quick guide to set up and run the biz.finetune.store inventory management PWA.

## Prerequisites

- **Node.js** 18+ and npm
- **Supabase** account and project ([supabase.com](https://supabase.com))
- **Git** (optional, for version control)

## Installation

### 1. Clone or Download

```bash
cd biz.finetune.store
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Copy from example
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Get these from:** Supabase Dashboard → Project Settings → API

### 4. Set Up Database

Run this SQL in Supabase SQL Editor:

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
  role TEXT CHECK (role IN ('admin', 'manager', 'staff')),
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

### 5. Create Test Data (Optional)

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

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
npm run deploy:check # Validate deployment readiness
```

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

1. **Add PWA Icons** - See `public/PWA_ICONS_README.txt`
2. **Customize Branding** - Update colors in `src/styles/index.css`
3. **Deploy** - See `docs/DEPLOYMENT.md`
4. **Add Features** - Start with Sprint 2 (Inventory Management)

## Support

- **Documentation:** See `docs/` folder
- **Issues:** Check browser console and Supabase logs
- **Supabase Docs:** https://supabase.com/docs
- **Vite Docs:** https://vitejs.dev
- **React Docs:** https://react.dev

## License

MIT

