# Orchids.app Integration Guide

> **Last Updated**: December 5, 2025
> **Branch**: `orchid`
> **Purpose**: Visual AI-assisted code editing sandbox

---

## Table of Contents

1. [What is Orchids](#what-is-orchids)
2. [How Orchids Works](#how-orchids-works)
3. [Branch Setup](#branch-setup)
4. [Import Workflow](#import-workflow)
5. [Post-Import Commands](#post-import-commands)
6. [Working with Orchids](#working-with-orchids)
7. [Exporting Changes](#exporting-changes)
8. [Troubleshooting](#troubleshooting)
9. [Technical Details](#technical-details)

---

## What is Orchids

Orchids.app is an AI sandbox for visual code editing. It:
- Imports GitHub repositories
- Provides a browser-based IDE with AI assistant
- Enables visual editing of React components
- Runs a live dev server preview

**Important**: Orchids is a ONE-WAY import. Changes in Orchids do NOT sync back to GitHub automatically.

---

## How Orchids Works

### Two-Phase Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: PREPROCESSING (Automated System)                  │
│  ─────────────────────────────────────────────────────────  │
│  • Runs BEFORE the AI agent is active                       │
│  • Applies fixed templates to vite.config.ts                │
│  • Creates/modifies configuration files                     │
│  • CANNOT be controlled or prevented                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: AI AGENT (Interactive)                            │
│  ─────────────────────────────────────────────────────────  │
│  • Wakes up AFTER preprocessing completes                   │
│  • Has NO knowledge of what preprocessing changed           │
│  • Can edit any file freely                                 │
│  • May hallucinate - ALWAYS verify claims                   │
└─────────────────────────────────────────────────────────────┘
```

### Preprocessing Behaviors (Discovered)

| Behavior | Impact |
|----------|--------|
| Replaces `plugins` array in vite.config.ts | Loses `tailwindcss()`, `VitePWA()` |
| Injects `logErrorsPlugin()` | Captures errors for Orchids UI |
| Injects `componentTaggerPlugin()` | Enables visual editing |
| Injects `server` config at top | Creates duplicate server blocks |
| Creates `postcss.config.js` | Old Tailwind setup - conflicts with v4 |
| May inject UI imports in App.tsx | Components that don't exist |

---

## Branch Setup

### The `orchid` Branch

We maintain a dedicated `orchid` branch with Orchids-compatible adaptations.

```
main (production)
  └── preview (staging)
        └── orchid (Orchids-compatible)
```

### Required Adaptations

These files MUST exist in the `orchid` branch:

#### 1. `src/visual-edits/component-tagger-plugin.js`
```javascript
// Orchids.app component tagger plugin stub
export const componentTaggerPlugin = () => ({
  name: 'component-tagger-plugin',
})
```

#### 2. `postcss.config.js`
```javascript
// Tailwind v4 uses @tailwindcss/vite - NOT PostCSS plugin
// Orchids.app: DO NOT MODIFY
export default {
  plugins: {
    autoprefixer: {},
  },
}
```

#### 3. `src/lib/supabase.ts` (Fallback Credentials)
Orchids doesn't support environment variables. Add fallback:
```typescript
const SANDBOX_FALLBACK = {
  url: 'https://[preview-project].supabase.co',
  anonKey: '[preview-anon-key]'
}
```

---

## Import Workflow

### Step 1: Prepare Branch
```powershell
git checkout orchid
git pull origin orchid

# Make sure adaptations are in place
# Push any updates
git push origin orchid
```

### Step 2: Import to Orchids
1. Go to Orchids.app
2. Click "Import from GitHub"
3. Select repository: `krishamaze/Flonest`
4. Select branch: `orchid`
5. Wait for import to complete

### Step 3: Run Post-Import Commands (CRITICAL)

**Immediately after import, tell Orchids:**

```
Add tailwindcss() and VitePWA({...}) to the plugins array after componentTaggerPlugin().
Keep all existing plugins. The VitePWA config should include:
- registerType: 'prompt'
- devOptions.enabled: true
- manifest with Flonest branding
- workbox caching for supabase
```

Then:
```
Remove the duplicate server config block. Keep only the first one.
```

### Step 4: Verify App Loads

**Tell Orchids:**
```
Show me the actual browser preview. What do you see on screen?
Is it: A) Login page, B) Error overlay, C) Blank page, D) Something else
```

**Do NOT trust claims like "app is working" - always verify visually.**

---

## Post-Import Commands

### Required Commands (Run Every Time)

| Order | Command | Purpose |
|-------|---------|---------|
| 1 | "Add tailwindcss() and VitePWA() to plugins array" | Restore removed plugins |
| 2 | "Remove duplicate server config block" | Fix config structure |
| 3 | "Check browser preview - what renders?" | Verify app works |

### If Errors Persist

| Error | Command |
|-------|---------|
| TooltipProvider not defined | "Remove TooltipProvider, Toaster, Sonner imports from App.tsx - they don't exist" |
| PostCSS tailwindcss error | "Remove tailwindcss from postcss.config.js - we use @tailwindcss/vite" |
| PWA virtual module error | "Ensure devOptions.enabled: true in VitePWA config" |

---

## Working with Orchids

### What Orchids is Good For
- ✅ Visual component editing
- ✅ CSS/styling changes
- ✅ Quick UI prototyping
- ✅ Exploring design variations

### What to Avoid in Orchids
- ❌ Database migrations
- ❌ Authentication changes
- ❌ Complex business logic
- ❌ Configuration file changes

### Communication Tips

| Do | Don't |
|----|-------|
| "Show me the file content" | "Did it work?" (agent may lie) |
| "Run grep for X" | Trust summarized results |
| "Describe what renders" | Accept "it's working" without proof |
| Be specific and literal | Use vague instructions |

---

## Exporting Changes

### ⚠️ NEVER Blind Merge

Orchids changes include:
- Modified vite.config.ts (broken structure)
- Modified/created postcss.config.js (conflicts)
- Modified App.tsx (non-existent imports)
- src/visual-edits/ (Orchids-specific files)

### Safe Export Process

#### Option A: Cherry-Pick Specific Files
```powershell
# In Orchids, copy the changed component code
# Manually paste into your local branch
# Review each change
```

#### Option B: Selective Git Operations
```powershell
git checkout main
git fetch origin orchid

# View what changed
git diff main..origin/orchid

# Cherry-pick with exclusions
git cherry-pick <commit> --no-commit
git checkout HEAD -- vite.config.ts
git checkout HEAD -- postcss.config.js
git checkout HEAD -- src/App.tsx
git commit -m "feat: UI changes from Orchids"
```

#### Option C: Manual Review
```powershell
# Get Orchids changes
git fetch origin orchid
git checkout -b review-orchids origin/orchid

# Compare files
git diff main -- src/components/
git diff main -- src/pages/

# Copy only safe changes to main
```

### Files to ALWAYS Review Before Merge

| File | Risk | Action |
|------|------|--------|
| `vite.config.ts` | HIGH | Check plugins array is complete |
| `postcss.config.js` | HIGH | Should only have autoprefixer |
| `src/App.tsx` | HIGH | Remove non-existent imports |
| `src/visual-edits/*` | LOW | Can delete or keep |

---

## Troubleshooting

### Error: "This repository is not a Vite or Next.js project"
**Cause**: Missing `package-lock.json`
**Solution**: Ensure package-lock.json exists in orchid branch

### Error: "virtual:pwa-register/react" not resolved
**Cause**: VitePWA not in plugins array or devOptions.enabled is false
**Solution**:
```
Add VitePWA to plugins array with devOptions.enabled: true
```

### Error: "@layer base without @tailwind base"
**Cause**: postcss.config.js has tailwindcss plugin
**Solution**:
```
Remove tailwindcss from postcss.config.js - we use @tailwindcss/vite
```

### Error: "TooltipProvider is not defined"
**Cause**: Orchids added imports for non-existent components
**Solution**:
```
Remove TooltipProvider, Toaster, Sonner imports from App.tsx
```

### Error: "Duplicate key server"
**Cause**: Orchids preprocessing injected duplicate server block
**Solution**:
```
Remove the duplicate server config block at the bottom of vite.config.ts
```

### App shows blank page
**Cause**: Multiple possible issues
**Debug Steps**:
1. "Show me server logs"
2. "Show me browser console errors"
3. "Show me full vite.config.ts"

---

## Technical Details

### What Orchids Adds to vite.config.ts

```javascript
// Orchids injects this error logging plugin
const logErrorsPlugin = () => ({
  name: "log-errors-plugin",
  transformIndexHtml() {
    return {
      tags: [{
        tag: "script",
        injectTo: "head",
        children: `/* Error capture script for Orchids UI */`
      }]
    };
  },
});

// Orchids template plugins array
plugins: [
  react(),
  logErrorsPlugin(),
  mode === 'development' && componentTaggerPlugin(),
].filter(Boolean),
```

### Production Safety

| Orchids Addition | Production Impact |
|-----------------|-------------------|
| `logErrorsPlugin()` | ⚠️ ~2KB dead code (harmless) |
| `componentTaggerPlugin()` | ✅ Dev-only (safe) |
| Missing `tailwindcss()` | ❌ BROKEN - no styles |
| Missing `VitePWA()` | ❌ BROKEN - no PWA |
| Duplicate server config | ❌ Unpredictable behavior |

### File Comparison: Before vs After Import

```
YOUR BRANCH                    ORCHIDS SANDBOX
─────────────────────────      ─────────────────────────
vite.config.ts                 vite.config.ts
├─ imports ✓                   ├─ imports ✓ (kept)
├─ constants ✓                 ├─ constants ✓ (kept)
├─ plugins: [                  ├─ logErrorsPlugin def (injected)
│   react(),                   ├─ plugins: [
│   tailwindcss(),             │   react(),
│   VitePWA({...})             │   logErrorsPlugin(),
│ ]                            │   componentTaggerPlugin(),
├─ build config ✓              │ ] (TEMPLATE - your plugins GONE)
└─ server config ✓             ├─ server config (INJECTED - duplicate)
                               ├─ build config ✓ (kept)
                               └─ server config ✓ (kept - now duplicate!)
```

---

## Quick Reference Card

### After Every Orchids Import

```
1. "Add tailwindcss() and VitePWA({...}) to plugins array"
2. "Remove duplicate server config block"
3. "Show me browser preview - what renders?"
```

### Before Every Merge to Main

```
□ Review vite.config.ts - plugins array complete?
□ Review postcss.config.js - only autoprefixer?
□ Review App.tsx - no fake imports?
□ Delete src/visual-edits/ if not needed
```

---

## Version History

| Date | Change |
|------|--------|
| 2025-12-05 | Initial documentation based on investigation |
| 2025-12-05 | Added scratchpad from orchid-v2 import test |

---

## 🧪 Scratchpad (Unverified Findings)

> **Status**: Observations from testing. Verify before promoting to facts.

### Import Test: orchid-v2 (Dec 5, 2025)

**Branch**: `orchid-v2` from `preview` @ `fb0ca10`

#### Observation 1: Plugins Array Preserved ⚠️ CONTRADICTS PREVIOUS

```
plugins: [
  react(),
  logErrorsPlugin(),        ← Orchids injected
  componentTaggerPlugin(),  ← Orchids injected (our stub worked!)
  tailwindcss(),            ← PRESERVED (unexpected)
  VitePWA({...})            ← PRESERVED (unexpected)
]
```

**Hypothesis**: Having `component-tagger-plugin.js` stub pre-existing may prevent full plugins replacement?

**Status**: ❓ Needs more testing | **Confidence**: 40%

---

#### Observation 2: TooltipProvider Injection Pattern

**Phase 1 - Error Created:**
```
Error: TooltipProvider is not defined
Location: src/App.tsx line 1080
```

Orchids preprocessing injected UI wrapper components into App.tsx:
- `TooltipProvider`
- `Toaster`
- `Sonner`
- `HoverReceiver`

**Phase 2 - Hallucinated Fix:**

When asked to fix, Orchids added imports assuming shadcn/ui structure:
```typescript
import { TooltipProvider } from './components/ui/tooltip'
import { Toaster } from './components/ui/toaster'
import { Toaster as Sonner } from './components/ui/sonner'
```

**⚠️ CRITICAL**: These files may NOT exist in the project! Orchids assumed standard shadcn/ui setup.

**Status**: ✅ Confirmed pattern | **Confidence**: 85%

---

#### Observation 3: Orchids AI Blind Spots

| Blind Spot | Evidence | Confidence |
|------------|----------|------------|
| Cannot see browser preview | "I cannot directly see your browser preview" | 95% |
| Claims success without proof | "server running cleanly" (errors existed) | 90% |
| Hallucinates component existence | Added imports for non-existent files | 85% |
| Assumes shadcn/ui structure | Imports from `./components/ui/*` | 80% |

**Status**: ✅ Multiple confirmations | **Confidence**: 90%

---

### Questions to Test Next

1. ❓ Does pre-existing `component-tagger-plugin.js` prevent plugins replacement?
2. ✅ What triggers TooltipProvider injection? → **Answer: Orchids templates assume shadcn/ui**
3. ❓ Does Orchids modify App.tsx every time or only sometimes?
4. ❓ Do the injected component files exist? Verify: `./components/ui/tooltip`, `./components/ui/toaster`, `./components/ui/sonner`

---

## 📊 Confidence Scoring Framework

> **Purpose**: Track reliability of Orchids behavior observations before promoting to facts.

### Confidence Levels

| Level | Score | Meaning | Action |
|-------|-------|---------|--------|
| Hypothesis | 0-30% | Single observation, may be coincidence | Keep testing |
| Emerging | 31-60% | 2-3 consistent observations | Document pattern |
| Likely | 61-85% | Multiple confirmations, consistent | Add to troubleshooting |
| Confirmed | 86-100% | Reproduced across projects/imports | Promote to main docs |

### How to Score

1. **First observation**: 30%
2. **Reproduced once**: +20%
3. **Reproduced across different projects**: +25%
4. **Contradicted by evidence**: -30%
5. **Explained by Orchids docs/source**: +15%

---

## 🤝 Universal Orchids Collaboration Principles

> These apply to ANY project, not just Flonest.

### Principle 1: Verify Before Trust

```
❌ "Did it work?"
✅ "Show me lines X-Y of [file]. Do NOT modify anything."
```

Orchids AI will claim success. Always demand proof via file content.

### Principle 2: Inspect Before Fix

```
❌ "Fix the error"
✅ "Show me the error. Show me the file causing it. Do NOT fix yet."
```

Orchids "fixes" often introduce new problems (hallucinated imports).

### Principle 3: Question Assumptions

Orchids assumes:
- shadcn/ui component structure
- Standard React + Vite setup
- Components exist at conventional paths

**Always verify**: Do these components actually exist in YOUR project?

### Principle 4: Atomic Commands

```
❌ "Fix all the errors and make it work"
✅ "Show me vite.config.ts lines 30-40"
✅ "Add tailwindcss() to plugins array after react()"
✅ "Show me the result. Do NOT proceed."
```

One action at a time. Verify between steps.

### Principle 5: Maintain Session State

Orchids AI has:
- ✅ Access to file system
- ✅ Access to server logs
- ❌ No visual preview access
- ❌ No memory of preprocessing changes
- ❌ No awareness of what it "broke"

You must track what preprocessing changed and guide corrections.

---

## 🧾 Session Log Template

Use this to track each Orchids session:

```markdown
## Orchids Session: [DATE]

**Branch imported**: 
**Commit**: 

### Preprocessing Changes Detected
- [ ] vite.config.ts modified
- [ ] App.tsx modified
- [ ] postcss.config.js created/modified
- [ ] Other: 

### Errors Encountered
1. Error: 
   - File: 
   - Orchids fix: 
   - Actual fix needed: 

### Commands Issued
1. 
2. 
3. 

### Files to Review Before Merge
- [ ] 
- [ ] 
```
