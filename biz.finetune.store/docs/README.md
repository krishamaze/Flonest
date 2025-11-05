# Documentation

Complete documentation for the biz.finetune.store inventory management PWA.

## 📚 Documentation Index

### Getting Started
- **[Getting Started Guide](./GETTING_STARTED.md)** - Installation, setup, and first steps
  - Prerequisites
  - Installation steps
  - Database setup
  - Running the app
  - Troubleshooting

### Deployment
- **[Deployment Guide](./DEPLOYMENT.md)** - Complete deployment guide for Vercel
  - Deployment methods (CLI & Dashboard)
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

## 🚀 Quick Links

### For Developers
- [Project README](../README.md) - Project overview and quick start
- [Getting Started](./GETTING_STARTED.md) - Setup guide
- [Source Code](../src/) - Application source code

### For DevOps
- [Deployment Guide](./DEPLOYMENT.md) - Deploy to production
- [Deployment Checklist](./DEPLOYMENT_CHECKLIST.md) - Deployment tasks
- [Vercel Configuration](../vercel.json) - Deployment config

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
biz.finetune.store/
├── docs/                       # 📚 Documentation (you are here)
│   ├── README.md              # Documentation index
│   ├── GETTING_STARTED.md     # Setup guide
│   ├── DEPLOYMENT.md          # Deployment guide
│   └── DEPLOYMENT_CHECKLIST.md # Deployment checklist
├── public/                     # Static assets
│   ├── manifest.webmanifest   # PWA manifest
│   └── PWA_ICONS_README.txt   # Icon generation guide
├── scripts/                    # Utility scripts
│   └── deploy-check.js        # Pre-deployment validation
├── src/                        # Application source code
│   ├── components/            # React components
│   │   ├── forms/            # Form components
│   │   ├── layout/           # Layout components (Header, BottomNav)
│   │   └── ui/               # Reusable UI (Button, Card, Input)
│   ├── contexts/             # React contexts (AuthContext)
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Libraries (Supabase client)
│   ├── pages/                # Page components
│   │   ├── DashboardPage.tsx
│   │   ├── ProductsPage.tsx
│   │   ├── InventoryPage.tsx
│   │   └── LoginPage.tsx
│   ├── styles/               # Global styles (TailwindCSS)
│   ├── types/                # TypeScript types
│   ├── utils/                # Utility functions
│   ├── App.tsx               # Main app component
│   └── main.tsx              # Entry point
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── .vercelignore              # Vercel ignore rules
├── index.html                 # HTML template
├── package.json               # Dependencies & scripts
├── postcss.config.js          # PostCSS configuration
├── tsconfig.json              # TypeScript configuration
├── vercel.json                # Vercel deployment config
├── vite.config.ts             # Vite configuration
└── README.md                  # Project overview
```

## 🎯 Common Tasks

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Deployment
```bash
npm run deploy:check # Validate deployment readiness
vercel               # Deploy to preview
vercel --prod        # Deploy to production
```

### Database
```bash
# See GETTING_STARTED.md for SQL schema
# Manage database in Supabase Dashboard
```

## 🆘 Getting Help

### Troubleshooting
1. Check the relevant documentation section
2. Review browser console for errors
3. Check Supabase logs in dashboard
4. Verify environment variables

### Common Issues
- **Build errors:** See [Getting Started - Troubleshooting](./GETTING_STARTED.md#troubleshooting)
- **Deployment issues:** See [Deployment - Troubleshooting](./DEPLOYMENT.md#troubleshooting)
- **Authentication problems:** Check Supabase Auth settings and RLS policies
- **PWA not working:** Ensure HTTPS and check service worker registration

## 📝 Contributing

When adding new documentation:
1. Keep it concise and actionable
2. Include code examples
3. Add to this index
4. Update relevant links

## 📄 License

MIT

