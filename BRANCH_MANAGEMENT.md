# Branch Management Guide

## Default Branch: `main`

This repository uses `main` as its default branch. All development should be based on this branch, and all pull requests should target this branch.

## Legacy Branch: `master`

The `master` branch is a legacy branch that has been deprecated. It has been kept for backward compatibility but will eventually be removed.

## Recommendations for the `master` Branch

### Short-term (1-3 months)

1. **Keep but don't update**: Keep the `master` branch but don't push updates to it
2. **Deprecation notice**: Maintain the deprecation notice in the README
3. **Redirect contributors**: Direct all contributors to use the `main` branch

### Medium-term (3-6 months)

1. **Make read-only**: Consider making the `master` branch read-only through branch protection rules
2. **Notify users**: Send notifications to repository watchers about the upcoming removal
3. **Update documentation**: Ensure all documentation references the `main` branch

### Long-term (6+ months)

1. **Remove the branch**: Delete the `master` branch once it's reasonable to assume most users have transitioned
2. **Maintain redirects**: GitHub will maintain redirects from `master` to `main` for some time

## Instructions for Contributors

If you have a local clone of this repository, you should update it to use the `main` branch:

```bash
# Switch to the master branch
git checkout master

# Fetch the latest changes
git fetch origin

# Rename your local master branch to main
git branch -m master main

# Point your local main branch to the remote main branch
git branch -u origin/main main

# Update the remote HEAD reference
git remote set-head origin -a
```

## Branch Protection

The `main` branch should be protected with the following rules:

1. Require pull request reviews before merging
2. Require status checks to pass before merging
3. Require signed commits
4. Include administrators in these restrictions

These protections ensure code quality and maintain the integrity of the codebase.

## Branching Strategy

For future development, we recommend following a simplified GitHub flow:

1. Create feature branches from `main`
2. Make changes and commit to your feature branch
3. Open a pull request to merge your feature branch into `main`
4. After review and approval, merge the pull request
5. Delete the feature branch after merging

This strategy keeps the repository clean and makes it easy to track changes.
