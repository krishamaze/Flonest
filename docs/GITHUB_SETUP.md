# GitHub Setup Guide

Quick guide to push your project to GitHub and set up automatic deployments.

## ✅ Git Repository Initialized

Your local Git repository has been initialized and the first commit has been created:

```
✅ Commit: 32f22a4
✅ Files: 43 files
✅ Lines: 12,210 insertions
✅ Branch: master
```

## 📤 Push to GitHub

### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `biz.finetune.store`
3. Description: `Multi-tenant inventory management PWA with React + Supabase`
4. Visibility: **Private** (recommended) or Public
5. **DO NOT** initialize with README, .gitignore, or license
6. Click "Create repository"

### Step 2: Connect Local Repository to GitHub

After creating the repository, GitHub will show you commands. Use these:

```bash
# Add GitHub as remote origin
git remote add origin https://github.com/YOUR_USERNAME/biz.finetune.store.git

# Rename branch to main (GitHub's default)
git branch -M main

# Push to GitHub
git push -u origin main
```

**Replace `YOUR_USERNAME`** with your actual GitHub username.

### Alternative: Using SSH

If you have SSH keys set up:

```bash
git remote add origin git@github.com:YOUR_USERNAME/biz.finetune.store.git
git branch -M main
git push -u origin main
```

## 🚀 Set Up Vercel Deployment

### Option 1: Automatic GitHub Integration (Recommended)

1. **Go to Vercel:** https://vercel.com/new
2. **Import Git Repository:**
   - Click "Import Git Repository"
   - Select your GitHub account
   - Find `biz.finetune.store`
   - Click "Import"

3. **Configure Project:**
   - **Framework Preset:** Vite (auto-detected)
   - **Root Directory:** `.` (root directory)
   - **Build Command:** `npm run build` (auto-detected)
   - **Output Directory:** `dist` (auto-detected)
   - **Install Command:** `npm install` (auto-detected)

4. **Add Environment Variables:**
   ```
   VITE_SUPABASE_URL = https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY = your-anon-key
   ```
   - Select: Production, Preview, Development

5. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live!

### Option 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod
```

## 🔄 Automatic Deployments

Once connected to GitHub, Vercel will automatically:

- ✅ **Deploy on push to `main`** → Production
- ✅ **Deploy on pull requests** → Preview URLs
- ✅ **Deploy on feature branches** → Preview URLs
- ✅ **Run CI/CD checks** → GitHub Actions

### Workflow

```
Local Changes → Git Commit → Git Push → GitHub → Vercel Deploy → Live!
```

## 📋 Post-Setup Checklist

### GitHub
- [ ] Repository created
- [ ] Local repo connected to GitHub
- [ ] Code pushed to `main` branch
- [ ] Repository visibility set (private/public)
- [ ] Branch protection rules (optional)

### Vercel
- [ ] Project imported from GitHub
- [ ] Environment variables added
- [ ] First deployment successful
- [ ] Deployment URL accessible
- [ ] Custom domain configured (optional)

### Supabase
- [ ] Vercel URL added to allowed origins
- [ ] Auth redirect URLs updated
- [ ] Database tables created
- [ ] RLS policies enabled

## 🔐 Security Best Practices

### GitHub
1. **Enable branch protection** for `main`:
   - Settings → Branches → Add rule
   - Require pull request reviews
   - Require status checks to pass

2. **Add secrets** (if using GitHub Actions):
   - Settings → Secrets and variables → Actions
   - Add `VITE_SUPABASE_URL`
   - Add `VITE_SUPABASE_ANON_KEY`

### Vercel
1. **Environment variables** are encrypted
2. **Preview deployments** use same env vars
3. **Custom domains** get automatic HTTPS

## 📊 Repository Structure

Your repository includes:

```
biz.finetune.store/
├── .github/workflows/ci.yml    # CI/CD pipeline
├── src/                        # React app source
├── public/                     # Static assets
├── docs/                       # Documentation
├── supabase/                   # Supabase config
├── bin/                        # Supabase CLI
├── package.json                # Dependencies
├── vite.config.ts              # Vite configuration
├── vercel.json                 # Vercel deployment
├── .gitignore                  # Git ignore rules
└── README.md                   # Project overview
```

## 🎯 Next Steps

### 1. Push to GitHub
```bash
# Create repository on GitHub first, then:
git remote add origin https://github.com/YOUR_USERNAME/biz.finetune.store.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Vercel
- Import from GitHub
- Add environment variables
- Deploy!

### 3. Configure Supabase
- Add Vercel URL to allowed origins
- Update auth redirect URLs
- Test authentication

### 4. Test Deployment
- Visit deployment URL
- Test login
- Install PWA on mobile
- Verify offline mode

## 🆘 Troubleshooting

### Push Rejected

**Error:** `! [rejected] main -> main (fetch first)`

**Solution:**
```bash
git pull origin main --rebase
git push origin main
```

### Authentication Failed

**Error:** `Authentication failed`

**Solution:**
```bash
# Use personal access token instead of password
# Generate at: https://github.com/settings/tokens
# Use token as password when prompted
```

Or set up SSH keys:
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# Add to GitHub: Settings → SSH and GPG keys
```

### Vercel Build Fails

**Check:**
1. Environment variables are set
2. Build works locally: `npm run build`
3. Check Vercel build logs
4. Verify `vercel.json` configuration

## 📚 Resources

- **GitHub Docs:** https://docs.github.com
- **Vercel Docs:** https://vercel.com/docs
- **Git Basics:** https://git-scm.com/book/en/v2
- **Project Docs:** See `docs/` directory

## 🎉 Quick Commands Reference

```bash
# Git Commands
git status                      # Check status
git add .                       # Stage all changes
git commit -m "message"         # Commit changes
git push                        # Push to GitHub
git pull                        # Pull from GitHub

# Vercel Commands
vercel                          # Deploy to preview
vercel --prod                   # Deploy to production
vercel logs                     # View logs
vercel env ls                   # List env variables

# Development
npm run dev                     # Start dev server
npm run build                   # Build for production
npm run deploy:check            # Pre-deployment check
npm run preview                 # Preview production build
```

---

**Status:** ✅ Git initialized, ready to push  
**Next:** Create GitHub repository and push  
**Then:** Deploy to Vercel

