# Branch Management Guide

## Default Branch: `main`

This repository uses `main` as its default branch. All development should be based on this branch, and all pull requests should target this branch.

## Legacy Branch: `master` (Removed)

The legacy `master` branch has been removed. All development now takes place on the `main` branch.

## Note for Users with Existing Clones

If you had previously cloned this repository when it used the `master` branch, you will need to update your local repository to use the `main` branch instead. GitHub will maintain redirects from `master` to `main` for some time, but it's best to update your local setup.

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
