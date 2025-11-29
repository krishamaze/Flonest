# 00-branch-hygiene.md - Zero-Orphan Branch Policy

**Status:** Active
**Date:** 2025-11-28
**Context:** Repository hygiene is critical for maintaining development velocity and context clarity. Orphaned branches create noise and confusion.

## Policy: "Zero-Orphan" Standard

1.  **Merged = Deleted**
    - Any branch successfully merged to `main` must be deleted immediately.
    - This applies to both local and remote branches.

2.  **Stale > 14 Days = Archived/Deleted**
    - Any feature branch with no activity for 14 days and no corresponding active `.cursor/plan` must be evaluated.
    - If valuable: Tag it `archive/xyz`.
    - Otherwise: Delete it.

3.  **Plan Alignment**
    - Every active branch *must* map to an `In Progress` file in `.cursor/plans/`.
    - If the plan is "Done" or "Completed", the corresponding branch must be deleted.
    - Branches without a linked plan are considered "Unknown/Mystery" and subject to pruning.

## Workflow

1.  **Prune Remotes:** Regularly run `git fetch -p` to align with remote state.
2.  **Audit:** Use `git branch -a` to list branches and cross-reference with `.cursor/plans/`.
3.  **Clean:** Delete merged branches and stale branches not meeting the criteria.

## Exceptions

- `main`: Protected production branch.
- `marketing`: Protected marketing site branch.

