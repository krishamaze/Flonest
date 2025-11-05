# biz.finetune.store

A mobile-first Progressive Web App (PWA) for multi-tenant inventory & sales SaaS with GST invoicing support.

## Features

- 📱 **Mobile-First Design** - Optimized for tablets and phones
- 🔄 **Offline Support** - PWA with service worker for offline functionality
- 🏢 **Multi-Tenant** - Support for multiple organizations
- 📦 **Product Management** - Track products, SKUs, and stock levels
- 📊 **Inventory Tracking** - Monitor stock movements (in/out/adjustments)
- 🧾 **GST Invoicing** - Generate invoices with GST compliance (Coming Soon)
- 👥 **Team Management** - Role-based access control (Coming Soon)
- 🎨 **Modern UI** - Built with TailwindCSS and Heroicons
- 🔐 **Authentication** - Secure auth with Supabase
- ⚡ **Fast** - Built with Vite for lightning-fast development

## Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS (mobile-first)
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **PWA**: vite-plugin-pwa + Workbox
- **Icons**: Heroicons
- **Routing**: React Router v6
- **Strategy**: Augment-driven development

## Sprint Progress

- [x] **Sprint 1**: Foundation (Supabase + PWA scaffold + auth) ✅
  - Supabase CLI setup
  - React + Vite + TypeScript project
  - TailwindCSS configuration
  - PWA setup with offline support
  - Authentication context
  - Mobile-first layout with bottom navigation
  - Core pages (Dashboard, Products, Inventory, Login)
- [ ] **Sprint 2**: Inventory management
- [ ] **Sprint 3**: Invoicing with GST
- [ ] **Sprint 4**: Team management
- [ ] **Sprint 5**: Admin dashboard
- [ ] **Sprint 6**: PWA deployment
- [ ] **Sprint 7**: Beta testing

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 3. Set up database (see docs/GETTING_STARTED.md for SQL)

# 4. Run development server
npm run dev
```

Visit http://localhost:3000

**📖 Full Setup Guide:** See [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)

## Documentation

- **[Getting Started](./docs/GETTING_STARTED.md)** - Installation and setup guide
- **[Deployment](./docs/DEPLOYMENT.md)** - Deploy to Vercel
- **[Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md)** - Pre/post-deployment tasks

## Database Schema

Run the following SQL in your Supabase SQL editor to create the required tables:

```sql
-- Create tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'manager', 'staff')) DEFAULT 'staff',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, sku)
);

-- Create inventory_transactions table
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  type TEXT CHECK (type IN ('in', 'out', 'adjustment')) NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their tenant" ON tenants
  FOR SELECT USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can view their profile" ON users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view their tenant's products" ON products
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can view their tenant's transactions" ON inventory_transactions
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

### 4. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Project Structure

```
src/
├── components/
│   ├── ui/           # Reusable UI components (Button, Card, Input, etc.)
│   ├── forms/        # Form components
│   └── layout/       # Layout components (Header, BottomNav, MainLayout)
├── pages/            # Page components (Dashboard, Products, Inventory, Login)
├── hooks/            # Custom React hooks
├── lib/              # Utilities and configurations (Supabase client)
├── types/            # TypeScript type definitions
├── contexts/         # React contexts (AuthContext)
├── styles/           # Global styles and Tailwind CSS
└── assets/           # Static assets
```

## PWA Features

- **Installable** - Can be installed on mobile devices and desktop
- **Offline Support** - Works offline with cached data
- **App-like Experience** - Full-screen mode, splash screen
- **Auto-updates** - Service worker updates automatically

## Mobile Optimization

- Touch-friendly UI with minimum 44px touch targets
- Bottom navigation for easy thumb access
- Responsive design with mobile-first approach
- Safe area support for notched devices
- Optimized for portrait orientation

## Tech Stack

- **React** 18.3.1
- **TypeScript** 5.6.3
- **Vite** 6.0.1
- **TailwindCSS** 4.1.16
- **Supabase** 2.79.0
- **React Router** 7.9.5
- **Heroicons** 2.2.0
- **vite-plugin-pwa** 1.1.0

## Deployment

### Quick Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

**📖 Full Deployment Guide:** See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)

**✅ Deployment Checklist:** See [docs/DEPLOYMENT_CHECKLIST.md](./docs/DEPLOYMENT_CHECKLIST.md)

### Pre-Deployment Validation

```bash
npm run deploy:check
```

## License

MIT
