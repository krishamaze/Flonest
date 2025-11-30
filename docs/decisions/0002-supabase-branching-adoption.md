# ADR-0002: Adoption of Supabase Branching 2.0

**Date:** 2025-11-30
**Status:** Accepted
**Supersedes:** ADR-0001 (Partial Update)

## Context

We previously adopted a cloud-only development model (ADR-0001) to avoid the complexities of local Docker setups. Supabase has since released Branching 2.0, which offers a more robust and integrated workflow for managing database environments.

## Decision

We will adopt **Supabase Branching 2.0** as our standard development workflow. This enhances our previous cloud-only approach by providing:

1.  **Isolated Environments**: Each feature branch gets its own isolated database instance.
2.  **Preview Environments**: A persistent staging environment that mirrors production.
3.  **Git Integration**: Database branching is tightly coupled with our git workflow.

## Consequences

### Positive

-   **Isolation**: Developers can work on schema changes without affecting others.
-   **Safety**: Reduces the risk of accidental breaking changes in production.
-   **Testing**: Easier to test schema changes in a production-like environment.
-   **Automation**: CI/CD pipelines can automatically manage database branches.

### Negative

-   **Complexity**: Introduces a slight learning curve for managing database branches.
-   **Resource Usage**: Each branch consumes Supabase resources (though usually within limits).

## Migration Path

1.  **Update Documentation**: Reflect the new workflow in all project docs.
2.  **Configure CI/CD**: Set up GitHub Actions to handle branch management and migrations.
3.  **Training**: Ensure all team members understand the new workflow.

## References

-   [Supabase Branching Documentation](https://supabase.com/docs/guides/platform/branching)
-   [ADR-0001: Cloud-Only Development](./0001-cloud-only-development.md)
