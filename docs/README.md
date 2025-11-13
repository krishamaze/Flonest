# Documentation

Complete documentation for the bill.finetune.store inventory management PWA.

## 📚 Documentation Index

### Getting Started
- **[Getting Started Guide](./GETTING_STARTED.md)** - Installation, setup, and first steps
  - Prerequisites
  - Installation steps
  - Database setup
  - Running the app
  - Troubleshooting

- **[Environment Setup](./ENV_SETUP.md)** - Environment variables configuration
  - Supabase credentials
  - Auth configuration
  - Production environment

- **[Supabase CLI Setup](./SUPABASE_CLI_SETUP.md)** - Local Supabase CLI configuration
  - CLI installation
  - Project linking
  - Migration management

### Deployment
- **[Deployment Guide](./DEPLOYMENT.md)** - Complete deployment guide for Vercel
  - Git-based deployment workflow
  - Environment variables
  - Custom domain setup
  - PWA deployment
  - Monitoring & analytics
  - Troubleshooting

- **[Deployment Checklist](./DEPLOYMENT_CHECKLIST.md)** - Pre/post-deployment checklist
  - Pre-deployment checks
  - Deployment steps
  - Post-deployment verification
  - Performance targets
  - Rollback procedures

### Database & Schema
- **[Schema Migration Workflow](./SCHEMA_MIGRATION_WORKFLOW.md)** - Database migration process
  - Creating migrations
  - Applying migrations with Supabase MCP
  - Migration best practices
  - Rollback procedures

- **[Schema Migrations](./SCHEMA_MIGRATIONS.md)** - Migration history and documentation
  - Applied migrations list
  - Schema evolution
  - Breaking changes

### User Management
- **[Create Internal User](./CREATE_INTERNAL_USER.md)** - Set up internal reviewer accounts
  - Internal user role
  - Reviewer permissions
  - Setup instructions

- **[Test Accounts](./TEST_ACCOUNTS.md)** - Test user credentials
  - Test organizations
  - User credentials
  - Sample data

- **[Password Reset Setup](./PASSWORD_RESET_SETUP.md)** - Configure password reset emails
  - SMTP configuration
  - Email templates
  - Redirect URLs

### Development Workflow
- **[MCP Workflow](./MCP_WORKFLOW.md)** - Model Context Protocol tools usage
  - Vercel MCP for deployments
  - Supabase MCP for database
  - GitHub MCP for version control

- **[Cloud Development Workflow](./CLOUD_DEV_WORKFLOW.md)** - Cloud-based development
  - Production-first development
  - No localhost requirement
  - Remote debugging

- **[Onboarding](./ONBOARDING.md)** - Developer onboarding guide
  - Repository setup
  - First deployment
  - Common workflows

### Technical Reference
- **[Implementation Status Report](./IMPLEMENTATION_STATUS_REPORT.md)** - Governance implementation details
  - Master product governance
  - RLS policy verification
  - Frontend integration status
  - Production readiness

- **[Pincode Data Options](./PINCODE_DATA_OPTIONS.md)** - Indian pincode integration options
  - Pincode API sources
  - Implementation considerations

## 🚀 Quick Links

### For Developers
- [Project README](../README.md) - Project overview and quick start
- [Getting Started](./GETTING_STARTED.md) - Setup guide
- [Source Code](../src/) - Application source code
- [MCP Workflow](./MCP_WORKFLOW.md) - Development tools

### For DevOps
- [Deployment Guide](./DEPLOYMENT.md) - Deploy to production
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Deployment verification
- [Schema Migration Workflow](./SCHEMA_MIGRATION_WORKFLOW.md) - Database changes
- [Vercel Configuration](../vercel.json) - Deployment config

### For Internal Reviewers
- [Create Internal User](./CREATE_INTERNAL_USER.md) - Reviewer account setup
- [Implementation Status Report](./IMPLEMENTATION_STATUS_REPORT.md) - Governance system

## 📖 Additional Resources

### External Documentation
- [Vite Documentation](https://vitejs.dev) - Build tool
- [React Documentation](https://react.dev) - UI framework
- [TypeScript Documentation](https://www.typescriptlang.org/docs/) - Type system
- [TailwindCSS Documentation](https://tailwindcss.com/docs) - CSS framework
- [Supabase Documentation](https://supabase.com/docs) - Backend & database
- [React Router Documentation](https://reactrouter.com) - Routing
- [PWA Documentation](https://web.dev/progressive-web-apps/) - Progressive Web Apps

### Tools & Services
- [Vercel](https://vercel.com) - Deployment platform
- [Supabase Dashboard](https://app.supabase.com) - Database management
- [GitHub](https://github.com) - Version control

## 🏗️ Project Structure

```
bill.finetune.store/
├── docs/                           # 📚 Documentation (you are here)
│   ├── README.md                  # Documentation index
│   ├── GETTING_STARTED.md         # Setup guide
│   ├── DEPLOYMENT.md              # Deployment guide
│   ├── DEPLOYMENT_CHECKLIST.md    # Deployment verification
│   ├── ENV_SETUP.md               # Environment variables
│   ├── SUPABASE_CLI_SETUP.md      # Supabase CLI
│   ├── SCHEMA_MIGRATION_WORKFLOW.md # Database migrations
│   ├── SCHEMA_MIGRATIONS.md       # Migration history
│   ├── CREATE_INTERNAL_USER.md    # Internal user setup
│   ├── TEST_ACCOUNTS.md           # Test credentials
│   ├── PASSWORD_RESET_SETUP.md    # Email configuration
│   ├── MCP_WORKFLOW.md            # MCP tools
│   ├── CLOUD_DEV_WORKFLOW.md      # Cloud development
│   ├── ONBOARDING.md              # Developer onboarding
│   ├── IMPLEMENTATION_STATUS_REPORT.md # Governance status
│   └── PINCODE_DATA_OPTIONS.md    # Pincode API options
├── public/                         # Static assets
│   ├── manifest.webmanifest       # PWA manifest
│   └── PWA_ICONS_README.txt       # Icon guide
├── scripts/                        # Utility scripts
│   ├── create-internal-user.cjs   # Internal user creation
│   ├── configure-smtp.cjs         # SMTP configuration
│   ├── configure-redirect-urls.cjs # Auth URLs
│   ├── generate-pwa-icons.cjs     # Icon generation
│   ├── setup-test-users.cjs       # Test data
│   └── deploy-check.js            # Deployment validation
├── src/                            # Application source code
│   ├── components/                # React components
│   │   ├── forms/                # Form components
│   │   ├── layout/               # Layout (Header, BottomNav)
│   │   ├── ui/                   # Reusable UI (Button, Card)
│   │   ├── invoice/              # Invoice features
│   │   ├── reviewer/             # Internal reviewer UI
│   │   ├── customers/            # Customer management
│   │   ├── notifications/        # Notifications
│   │   └── pwa/                  # PWA components
│   ├── contexts/                 # React contexts
│   ├── hooks/                    # Custom hooks
│   ├── lib/                      # Libraries & utilities
│   │   ├── api/                 # API functions
│   │   └── utils/               # Utility functions
│   ├── pages/                    # Page components
│   ├── styles/                   # Design tokens & CSS
│   ├── types/                    # TypeScript types
│   └── main.tsx                  # Entry point
├── supabase/                      # Supabase configuration
│   ├── config.toml               # Supabase project config
│   └── migrations/               # Database migrations (64 files)
├── .env.example                   # Environment template
├── .gitignore                     # Git ignore rules
├── .vercelignore                  # Vercel ignore rules
├── index.html                     # HTML template
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript config
├── vercel.json                    # Vercel deployment config
├── vite.config.ts                 # Vite config
└── README.md                      # Project overview
```

## 🎯 Common Tasks

### Development
```bash
npm run dev                # Start development server
npm run build              # Build for production
npm run preview            # Preview production build
npm run lint               # Run ESLint
```

### Deployment
```bash
git add .                  # Stage changes
git commit -m "message"    # Commit changes
git push origin main       # Deploy to production (Vercel auto-deploys)
# Use Vercel MCP to verify deployment status
```

### Database Management
```bash
npm run supabase:migration:new <name>  # Create migration file
# Use Supabase MCP in Cursor to apply migrations
npm run supabase:types                 # Generate TypeScript types
npm run supabase:status                # Check project status
```

### User & Configuration
```bash
npm run create:internal-user       # Create internal reviewer
npm run configure:smtp             # Configure email SMTP
npm run configure:redirect-urls    # Configure auth URLs
```

## 🆘 Getting Help

### Troubleshooting Steps
1. Check the relevant documentation section
2. Review browser console for errors
3. Check Supabase logs in dashboard
4. Verify environment variables
5. Check Vercel deployment logs

### Common Issues
- **Build errors:** See [Getting Started - Troubleshooting](./GETTING_STARTED.md#troubleshooting)
- **Deployment issues:** See [Deployment - Troubleshooting](./DEPLOYMENT.md#troubleshooting)
- **Authentication problems:** Check Supabase Auth settings and RLS policies
- **PWA not working:** Ensure HTTPS and check service worker registration
- **Migration errors:** See [Schema Migration Workflow](./SCHEMA_MIGRATION_WORKFLOW.md)

### Key Reminders
- ⚠️ **Never use Supabase CLI commands for migrations** - Use Supabase MCP in Cursor
- ⚠️ **Never use `vercel deploy` command** - Always deploy via `git push`
- ⚠️ **Always verify deployment status** - Use Vercel MCP after pushing
- ✅ **Use MCP tools** - Vercel MCP, Supabase MCP, GitHub MCP

## 📝 Contributing to Documentation

When adding new documentation:
1. Keep it concise and actionable
2. Include code examples with proper syntax highlighting
3. Add to this index in the appropriate section
4. Update relevant cross-references
5. Follow the existing documentation style
6. Test all commands and examples

## 📄 License

MIT

---

**Last Updated:** November 13, 2025  
**Documentation Version:** 2.0
