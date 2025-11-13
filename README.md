# bill.finetune.store

A mobile-first Progressive Web App (PWA) for multi-tenant inventory & sales SaaS with GST invoicing and product governance.

**Production URL:** https://bill.finetune.store

## ✨ Features

### Core Functionality
- 📱 **Mobile-First Design** - Optimized for tablets and phones with touch-friendly UI
- 🔄 **Offline Support** - PWA with service worker for offline functionality
- 🏢 **Multi-Tenant** - Support for multiple organizations with role-based access
- 📦 **Product Management** - Track products, SKUs, serial numbers, and stock levels
- 📊 **Inventory Tracking** - Monitor stock movements with detailed ledger
- 🧾 **GST Invoicing** - Generate GST-compliant invoices with CGST/SGST/IGST
- 📸 **Barcode Scanning** - Camera-based product and serial number scanning
- 👥 **Team Management** - Role-based access (admin, manager, staff, reviewer)
- 🎨 **Modern UI** - Built with TailwindCSS and design tokens
- 🔐 **Authentication** - Secure auth with Supabase and RLS policies
- ⚡ **Fast** - Built with Vite for lightning-fast performance

### Advanced Features
- **Master Product Governance** - Internal review workflow for product catalog
- **Serial Number Tracking** - Track individual units with serial numbers
- **Customer Management** - Master customer database with org-specific links
- **HSN Code Management** - Integrated HSN master with GST rate lookup
- **Draft Invoices** - Save and resume invoice creation
- **Stock Ledger** - Complete audit trail of all stock movements
- **Notifications** - Real-time notifications for approvals and updates
- **Branch Management** - Multi-branch support per organization

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: TailwindCSS with custom design tokens
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **PWA**: vite-plugin-pwa + Workbox
- **Icons**: Heroicons
- **Routing**: React Router v7
- **Deployment**: Vercel (auto-deploy from git)

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Link to Supabase project (requires SUPABASE_ACCESS_TOKEN)
npm run supabase:link

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Run development server
npm run dev
```

Visit http://localhost:5173

**📖 Full Setup Guide:** See [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)

## 📚 Documentation

### Setup & Development
- **[Getting Started](./docs/GETTING_STARTED.md)** - Installation and setup guide
- **[Environment Setup](./docs/ENV_SETUP.md)** - Environment variables configuration
- **[Supabase CLI Setup](./docs/SUPABASE_CLI_SETUP.md)** - Local Supabase CLI configuration

### Deployment
- **[Deployment Guide](./docs/DEPLOYMENT.md)** - Deploy to Vercel via git push
- **[Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md)** - Pre/post-deployment verification
- **[Schema Migration Workflow](./docs/SCHEMA_MIGRATION_WORKFLOW.md)** - Database migration process

### User Guides
- **[Create Internal User](./docs/CREATE_INTERNAL_USER.md)** - Set up internal reviewer accounts
- **[Test Accounts](./docs/TEST_ACCOUNTS.md)** - Test user credentials
- **[Password Reset Setup](./docs/PASSWORD_RESET_SETUP.md)** - Configure password reset emails

### Technical Reference
- **[MCP Workflow](./docs/MCP_WORKFLOW.md)** - Model Context Protocol tools usage
- **[Cloud Development Workflow](./docs/CLOUD_DEV_WORKFLOW.md)** - Cloud-based development
- **[Implementation Status Report](./docs/IMPLEMENTATION_STATUS_REPORT.md)** - Governance implementation details

## 🗄️ Database

The database uses Supabase migrations for schema management. All migrations are in `supabase/migrations/`.

**Key Tables:**
- `orgs` - Organizations (tenants)
- `profiles` - User profiles
- `memberships` - User-org relationships with roles
- `products` - Organization products
- `master_products` - Global product catalog with governance
- `invoices` & `invoice_items` - Sales invoices
- `stock_ledger` - Inventory transactions
- `master_customers` - Global customer database
- `hsn_master` - HSN codes with GST rates

**Migrations are managed via:**
```bash
npm run supabase:migration:new <name>  # Create new migration
# Use Supabase MCP in Cursor to apply migrations
npm run supabase:types                 # Generate TypeScript types
```

## 📁 Project Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components (Button, Card, Input, etc.)
│   ├── forms/           # Form components (Product, Invoice, Customer)
│   ├── layout/          # Layout components (Header, BottomNav, MainLayout)
│   ├── invoice/         # Invoice-specific (Scanner, ProductSearch)
│   ├── reviewer/        # Internal reviewer components
│   ├── customers/       # Customer management components
│   ├── notifications/   # Notification components
│   └── pwa/            # PWA components (Install, Update)
├── pages/               # Page components (Dashboard, Products, Invoices, etc.)
├── hooks/               # Custom React hooks
├── lib/
│   ├── api/            # API functions (organized by domain)
│   ├── utils/          # Utility functions
│   └── supabase.ts     # Supabase client
├── types/               # TypeScript type definitions
├── contexts/            # React contexts (AuthContext)
├── styles/              # Design tokens and global styles
└── main.tsx             # Application entry point
```

## 🎨 Design System

The app uses a custom design token system in `src/styles/design-tokens.css`:

- **Colors**: Primary (yellow), secondary (dark slate), semantic colors
- **Spacing**: 8pt grid system
- **Typography**: System fonts with consistent sizing
- **Components**: Card-based layouts, bottom navigation, mobile-first

## 📱 PWA Features

- ✅ **Installable** - Add to home screen on mobile/desktop
- ✅ **Offline Support** - Service worker caching
- ✅ **App-like Experience** - Full-screen, splash screen
- ✅ **Auto-updates** - Background updates with user notification
- ✅ **Fast Loading** - Optimized bundle with code splitting

## 🛠️ Available Scripts

### Development
- `npm run dev` - Start development server (port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Database
- `npm run supabase:migration:new <name>` - Create new migration
- `npm run supabase:types` - Generate TypeScript types
- `npm run supabase:status` - Check Supabase project status

### Setup
- `npm run create:internal-user` - Create internal reviewer account
- `npm run configure:smtp` - Configure SMTP for emails
- `npm run configure:redirect-urls` - Configure auth redirect URLs

### Utilities
- `npm run icons:generate` - Generate PWA icons
- `npm run deploy:check` - Pre-deployment validation

## 🚀 Deployment

**Production URL:** https://bill.finetune.store

The app is deployed to Vercel with automatic deployments from the `main` branch:

```bash
# Commit changes
git add .
git commit -m "Your changes"

# Deploy to production
git push origin main

# Vercel automatically builds and deploys
# Use Vercel MCP to verify deployment status
```

**⚠️ Never use `vercel deploy` command - always deploy via git push**

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for complete deployment workflow.

## 🔐 Authentication & Roles

The app supports multiple user roles:

- **Admin** - Full organization management
- **Manager** - Product and invoice management
- **Staff** - Limited product and invoice access
- **Reviewer** - Internal role for master product approval

## 🧪 Testing

Test accounts are available in [docs/TEST_ACCOUNTS.md](./docs/TEST_ACCOUNTS.md).

## 📊 Tech Stack

- **React** 18.3.1 - UI framework
- **TypeScript** 5.6.3 - Type safety
- **Vite** 6.0.1 - Build tool
- **TailwindCSS** 4.1.16 - Styling
- **Supabase** 2.79.0 - Backend & database
- **React Router** 7.9.5 - Routing
- **Heroicons** 2.2.0 - Icons
- **vite-plugin-pwa** 1.1.0 - PWA support
- **Framer Motion** 11.11.17 - Animations
- **html5-qrcode** 2.3.8 - Barcode scanning

## 📄 License

MIT

---

**Built with ❤️ by FineTune**  
**Last Updated:** November 13, 2025
