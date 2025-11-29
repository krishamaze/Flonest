# Branding & UI Guidelines

**Last Updated:** 2025-11-29

## Core Branding Principles

### Product Name
- **Official Name:** Flonest.app
- **Internal/Console Name:** Flonest WorkHub
- **Usage:** Use "Flonest.app" in user-facing copy where the product identity is required.

### Tenant Identity
- **Definition:** The user's organization or business name.
- **Source:** Always dynamic, fetched from `useAuth().currentOrg?.orgName` or similar API props.
- **Rule:** NEVER hardcode a tenant name (e.g., "finetune", "Acme Corp") in the UI.
- **Context:** Tenant name should appear in context (e.g., "Organization: [Name]", "Billing for [Name]"), not as the product header.

### "finetune" Legacy
- **Status:** Deprecated.
- **Action:** Remove all hardcoded instances of "finetune" from the codebase.
- **Exception:** Historical database records or internal IDs if strictly necessary (but avoid in UI).

## UI Components

### Welcome / Offer Panel
- **Component:** `WelcomeOfferPanel`
- **Location:** `src/components/dashboard/WelcomeOfferPanel.tsx`
- **Purpose:** Persistent announcement banner for trials, updates, and alerts.
- **Props:**
  - `tenantName`: For context (optional).
  - `onUpgrade`: Callback for upgrade action.
- **Design:** Slim, persistent banner, mobile-first.

### Logos
- **Default Logo:** `/pwa-192x192.png`
- **Alt Text:** Use "Flonest logo" or "Default Flonest logo".
- **Custom Logos:** Supported via `orgSettings.custom_logo_url`.

## Implementation Rules

1. **Dynamic Data:** Always check if `currentOrg` or `user` data is available before rendering tenant-specific UI.
2. **Separation of Concerns:** Keep product branding (Flonest) separate from tenant branding (User's Business).
3. **Mobile First:** All branding elements must be responsive and look good on mobile devices.
4. **Accessibility:** Ensure all logos and icons have descriptive alt text or aria-labels.

## Checklist for New Features

- [ ] Does this feature display the correct tenant name?
- [ ] Is the product name "Flonest.app" used correctly (if at all)?
- [ ] Are there any hardcoded strings that should be dynamic?
- [ ] Is the design consistent with the Design Tokens system?
