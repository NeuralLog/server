# NeuralLog Repository Structure

This directory contains multiple independent repositories that are part of the NeuralLog ecosystem. Each repository is managed separately and has its own git history, branches, and remote origins.

## Repositories

- **specs**: Technical specifications for the NeuralLog system
- **server**: Central server component of NeuralLog
- **mcp-client**: Model Context Protocol client for AI integration
- **typescript**: TypeScript client for NeuralLog (future)
- **unity**: Unity client for NeuralLog (future)
- **python**: Python client for NeuralLog (future)
- **java**: Java client for NeuralLog (future)

## Important Note

**This is NOT a monorepo!** Each directory is a separate git repository with its own history and remote origin. Do not attempt to manage them as a single repository.

## Repository Management

The `repo-tools.ps1` script provides utilities for managing these repositories, but it treats each one as a separate entity. It does not attempt to create a monorepo structure.

## Usage

To manage repositories, use the provided scripts:

```powershell
# PowerShell
./repo-tools.ps1 -Action status -Repo server

# Bash
./repo-tools.sh -a status -r server
```

These scripts help automate common tasks while respecting the independent nature of each repository.
