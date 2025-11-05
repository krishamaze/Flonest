# Deployment Checklist

Use this checklist before deploying to production.

## Pre-Deployment

### Code Quality
- [ ] All TypeScript errors resolved
- [ ] ESLint warnings addressed
- [ ] Build completes successfully (`npm run build`)
- [ ] Preview build works locally (`npm run preview`)
- [ ] No console errors in browser DevTools

### Environment Variables
- [ ] `.env.example` is up to date
- [ ] All required env vars documented
- [ ] Production Supabase credentials ready
- [ ] Environment variables added to Vercel dashboard

### PWA Assets
- [ ] PWA icons generated and added to `public/`:
  - [ ] `pwa-192x192.png`
  - [ ] `pwa-512x512.png`
  - [ ] `apple-touch-icon.png`
  - [ ] `favicon.ico`
  - [ ] `mask-icon.svg` (optional)
- [ ] `manifest.webmanifest` updated with correct app name
- [ ] `manifest.webmanifest` has correct `start_url`
- [ ] Theme colors match brand

### Configuration
- [ ] `vercel.json` is present and configured
- [ ] `.vercelignore` excludes unnecessary files
- [ ] `package.json` has correct build scripts
- [ ] Node.js version specified (18.x)

### Database
- [ ] Supabase tables created
- [ ] Row Level Security (RLS) policies enabled
- [ ] Test data added (optional)
- [ ] Database migrations documented
- [ ] Backup strategy in place

### Security
- [ ] `.env` file in `.gitignore`
- [ ] No secrets committed to Git
- [ ] Supabase RLS policies tested
- [ ] CORS settings configured in Supabase
- [ ] Security headers configured in `vercel.json`

### Testing
- [ ] Authentication flow tested
- [ ] All routes accessible
- [ ] Mobile responsive design verified
- [ ] PWA installation tested on mobile
- [ ] Offline functionality works
- [ ] Service worker registers correctly

## Deployment

### Vercel Setup
- [ ] Vercel account created
- [ ] Project imported from GitHub
- [ ] Framework preset set to "Vite"
- [ ] Root directory set to `biz.finetune.store`
- [ ] Build command: `npm run build`
- [ ] Output directory: `dist`
- [ ] Install command: `npm install`

### Environment Variables in Vercel
- [ ] `VITE_SUPABASE_URL` added (Production)
- [ ] `VITE_SUPABASE_ANON_KEY` added (Production)
- [ ] `VITE_SUPABASE_URL` added (Preview)
- [ ] `VITE_SUPABASE_ANON_KEY` added (Preview)
- [ ] Environment variables encrypted

### Deployment
- [ ] Initial deployment successful
- [ ] Build logs reviewed (no errors)
- [ ] Deployment URL accessible
- [ ] All pages load correctly
- [ ] No 404 errors on routes

## Post-Deployment

### Verification
- [ ] Visit deployment URL
- [ ] Test login/authentication
- [ ] Navigate all routes
- [ ] Test on mobile device
- [ ] Install PWA on mobile
- [ ] Test offline mode
- [ ] Check service worker in DevTools
- [ ] Verify manifest in DevTools

### Supabase Configuration
- [ ] Add Vercel URL to Supabase allowed origins
- [ ] Update redirect URLs in Supabase Auth settings:
  - [ ] `https://your-app.vercel.app/**`
  - [ ] `https://your-custom-domain.com/**` (if applicable)
- [ ] Test authentication with production URL
- [ ] Verify database queries work

### Performance
- [ ] Run Lighthouse audit
- [ ] Check Core Web Vitals:
  - [ ] LCP (Largest Contentful Paint) < 2.5s
  - [ ] FID (First Input Delay) < 100ms
  - [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] PWA score > 80
- [ ] Performance score > 90
- [ ] Accessibility score > 90

### Monitoring
- [ ] Vercel Analytics enabled
- [ ] Error tracking configured (optional: Sentry)
- [ ] Uptime monitoring set up (optional)
- [ ] Performance monitoring active

### Custom Domain (Optional)
- [ ] Domain added in Vercel
- [ ] DNS configured
- [ ] SSL certificate provisioned
- [ ] HTTPS working
- [ ] Redirects configured (www → non-www or vice versa)

### Documentation
- [ ] README.md updated with deployment URL
- [ ] DEPLOYMENT.md reviewed
- [ ] Team notified of deployment
- [ ] Deployment notes documented

## Rollback Plan

### If Issues Occur
- [ ] Previous deployment URL saved
- [ ] Rollback procedure documented:
  ```bash
  # Via Vercel Dashboard
  # 1. Go to Deployments
  # 2. Find previous working deployment
  # 3. Click "..." → "Promote to Production"
  
  # Via CLI
  vercel rollback
  ```
- [ ] Database rollback plan (if schema changed)
- [ ] Communication plan for users

## Continuous Deployment

### GitHub Integration
- [ ] Repository connected to Vercel
- [ ] Auto-deploy on push to `main` enabled
- [ ] Preview deployments for PRs enabled
- [ ] Branch protection rules configured
- [ ] CI/CD workflow tested

### Branch Strategy
- [ ] `main` → Production
- [ ] `develop` → Preview (optional)
- [ ] Feature branches → Preview URLs
- [ ] PR reviews required before merge

## Maintenance

### Regular Tasks
- [ ] Monitor deployment logs weekly
- [ ] Review Vercel Analytics monthly
- [ ] Update dependencies monthly
- [ ] Rotate Supabase keys quarterly
- [ ] Review and update RLS policies
- [ ] Backup database regularly

### Updates
- [ ] Process for deploying updates documented
- [ ] Staging environment for testing (optional)
- [ ] User notification for major updates
- [ ] Changelog maintained

---

## Quick Deploy Commands

### First Time Deployment
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd biz.finetune.store
vercel --prod
```

### Subsequent Deployments
```bash
# Via Git (recommended)
git add .
git commit -m "Your changes"
git push origin main

# Via CLI
vercel --prod
```

### Emergency Rollback
```bash
vercel rollback
```

---

## Support Contacts

- **Vercel Support:** https://vercel.com/support
- **Supabase Support:** https://supabase.com/support
- **Project Lead:** [Your Name/Email]
- **DevOps:** [Team Contact]

---

**Last Updated:** 2025-11-05  
**Next Review:** [Set date for next review]

