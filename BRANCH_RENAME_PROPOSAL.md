# Proposal: Rename Default Branch from "master" to "main"

## Background

GitHub and many other Git hosting platforms have moved away from using "master" as the default branch name in favor of more inclusive terminology like "main". This change aligns with industry best practices and creates a more welcoming environment for all contributors.

## Proposal

We propose renaming the default branch of the NeuralLog server repository from "master" to "main".

## Benefits

1. **Inclusive Language**: Uses more inclusive terminology that aligns with industry standards
2. **Consistency**: Aligns with GitHub's default for new repositories
3. **Modern Practice**: Follows the current best practice in the open-source community

## Implementation Steps

GitHub provides built-in tools to rename the default branch:

1. Go to the repository settings
2. Navigate to the "Branches" section
3. Click on the edit icon next to the default branch
4. Enter "main" as the new name
5. Click "Rename branch"

GitHub will automatically:
- Create the new branch
- Update all pull requests and draft releases
- Set up redirects for Git fetches and web URLs
- Update branch protection rules

## Post-Rename Actions

After the rename, contributors should update their local repositories:

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

## CI/CD Considerations

Any CI/CD configurations that reference the default branch by name will need to be updated to use "main" instead of "master".

## Documentation Updates

All documentation referring to the "master" branch should be updated to reference "main" instead.

## Timeline

We recommend implementing this change during a period of low activity to minimize disruption.

## Conclusion

Renaming the default branch from "master" to "main" is a simple change that aligns with current industry best practices and creates a more inclusive environment for all contributors.
