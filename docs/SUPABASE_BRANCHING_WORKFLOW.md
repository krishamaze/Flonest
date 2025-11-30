# Supabase Branching 2.0 Workflow

This guide outlines the development workflow using Supabase Branching 2.0. This workflow allows us to develop features in isolated cloud environments that mirror production, without the complexity of local Docker setups.

## Overview

Supabase Branching 2.0 provides a git-like branching model for your database:

-   **Production Branch (`main`)**: The live database serving the production application.
-   **Preview Branch**: A persistent staging environment linked to the `preview` git branch.
-   **Feature Branches**: Ephemeral database branches created for specific features, linked to git feature branches.

## Workflow Diagram

```mermaid
graph TD
    A[Main Branch (Production)] -->|Branch| B[Preview Branch (Staging)]
    B -->|Branch| C[Feature Branch (Development)]
    C -->|Merge| B
    B -->|Merge| A
```

## Setup

### 1. Prerequisites

-   Supabase CLI installed (`npm install -g supabase`)
-   Access to the Supabase project
-   Git repository set up

### 2. Link to Project

Link your local environment to the Supabase project:

```bash
npx supabase link --project-ref <project-ref>
```

### 3. Login

Ensure you are logged in to the Supabase CLI:

```bash
npx supabase login
```

## Daily Development

### 1. Create a Feature Branch

When starting a new feature, create a new git branch and a corresponding Supabase branch:

```bash
# Create git branch
git checkout -b feature/my-new-feature

# Create Supabase branch
npx supabase branches create feature/my-new-feature
```

### 2. Work on Your Feature

Make changes to your application and database.

-   **Schema Changes**: Create migration files using the CLI.

    ```bash
    npx supabase migration new my_schema_change
    ```

    Edit the generated SQL file in `supabase/migrations`.

-   **Apply Migrations**: Push your changes to the remote Supabase branch.

    ```bash
    npx supabase db push
    ```

### 3. Testing

Your feature branch has a unique API URL and Anon Key. You can find these in the Supabase Dashboard under your branch settings. Update your local `.env` file to point to this branch for testing.

### 4. Merge to Preview

Once your feature is ready and tested:

1.  Merge your git branch into `preview`.
2.  Supabase (via GitHub Actions) will automatically apply migrations to the `preview` database branch.

```bash
git checkout preview
git merge feature/my-new-feature
git push origin preview
```

### 5. Merge to Production

After verifying on the preview environment:

1.  Merge `preview` into `main`.
2.  Supabase (via GitHub Actions) will automatically apply migrations to the `production` database branch.

```bash
git checkout main
git merge preview
git push origin main
```

## Best Practices

-   **One Migration per Feature**: Try to keep schema changes consolidated.
-   **Test Data**: Use seed scripts to populate your feature branches with test data.
-   **Review Migrations**: Always review the SQL in your migration files before pushing.
-   **Do Not Edit Remote Directly**: Avoid making schema changes directly in the Supabase Dashboard for the production branch. Always use migrations.

## Troubleshooting

### Branch Creation Fails

-   Ensure you have the correct permissions in the Supabase organization.
-   Check if a branch with the same name already exists.

### Migration Fails

-   Check the GitHub Action logs for detailed error messages.
-   Verify that your migration SQL is valid and idempotent.
-   Ensure there are no conflicts with other migrations.

### Environment Variables

-   Remember to switch your `.env` variables back to `preview` or `production` when switching branches.
