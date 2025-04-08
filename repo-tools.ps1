param (
    [Parameter(Mandatory=$false)]
    [string]$Action = "status",

    [Parameter(Mandatory=$false)]
    [string]$Repo = "",

    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "Update repository",

    [Parameter(Mandatory=$false)]
    [switch]$Help
)

# Define repository paths
$repoInfo = @{
    "specs" = @{
        "path" = "specs"
        "branch" = "master"
        "remote" = "origin"
        "description" = "NeuralLog Specifications"
    }
    "server" = @{
        "path" = "server"
        "branch" = "main"
        "remote" = "origin"
        "description" = "NeuralLog Server"
    }
    "mcp-client" = @{
        "path" = "mcp-client"
        "branch" = "main"
        "remote" = "origin"
        "description" = "NeuralLog MCP Client"
    }
}

# Display help information
function Show-Help {
    Write-Host "NeuralLog Repository Tools" -ForegroundColor Cyan
    Write-Host "=========================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\repo-tools.ps1 -Action <action> [-Repo <repo>] [-CommitMessage <message>]" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Actions:" -ForegroundColor Green
    Write-Host "  status        - Show the status of a repository"
    Write-Host "  pull          - Pull the latest changes from remote"
    Write-Host "  push          - Push local changes to remote"
    Write-Host "  add           - Add all changes to staging"
    Write-Host "  commit        - Commit staged changes (requires -CommitMessage)"
    Write-Host "  add-commit    - Add and commit all changes (requires -CommitMessage)"
    Write-Host "  add-commit-push - Add, commit, and push all changes (requires -CommitMessage)"
    Write-Host "  sync          - Pull, add, commit, and push all changes (requires -CommitMessage)"
    Write-Host "  list          - List available repositories"
    Write-Host "  pull-all      - Pull the latest changes from all repositories"
    Write-Host "  push-all      - Push local changes to all repositories"
    Write-Host "  status-all    - Show the status of all repositories"
    Write-Host ""
    Write-Host "Repositories:" -ForegroundColor Green
    Write-Host "  specs         - NeuralLog Specifications"
    Write-Host "  server        - NeuralLog Server"
    Write-Host "  mcp-client    - NeuralLog MCP Client"
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\repo-tools.ps1 -Action list"
    Write-Host "  .\repo-tools.ps1 -Action status -Repo server"
    Write-Host "  .\repo-tools.ps1 -Action pull -Repo server"
    Write-Host "  .\repo-tools.ps1 -Action add-commit -Repo mcp-client -CommitMessage 'Update documentation'"
    Write-Host "  .\repo-tools.ps1 -Action sync -Repo specs -CommitMessage 'Weekly update'"
    Write-Host "  .\repo-tools.ps1 -Action pull-all"
    Write-Host "  .\repo-tools.ps1 -Action push-all"
    Write-Host ""
    Write-Host "Note: This script respects that each repository is independent." -ForegroundColor Yellow
    Write-Host "      It does NOT treat the directories as a monorepo." -ForegroundColor Yellow
}

# Execute git command in repository
function Execute-GitCommand {
    param (
        [string]$RepoPath,
        [string]$Command,
        [string]$Description
    )

    $currentLocation = Get-Location
    try {
        Set-Location -Path $RepoPath
        Write-Host "Executing in $($RepoPath): $($Command)" -ForegroundColor Gray
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error executing command in $RepoPath" -ForegroundColor Red
        }
    }
    finally {
        Set-Location -Path $currentLocation
    }
}

# List available repositories
function List-Repositories {
    Write-Host "Available Repositories:" -ForegroundColor Cyan
    foreach ($key in $repoInfo.Keys) {
        $repoPath = $repoInfo[$key].path
        $repoDesc = $repoInfo[$key].description
        $repoBranch = $repoInfo[$key].branch

        # Check if the repository exists
        if (Test-Path -Path $repoPath -PathType Container) {
            $currentLocation = Get-Location
            Set-Location -Path $repoPath

            # Get the current branch
            $currentBranch = & git rev-parse --abbrev-ref HEAD 2>$null
            if ($LASTEXITCODE -eq 0) {
                Write-Host "  $key - $repoDesc (Branch: $currentBranch)" -ForegroundColor Green
            } else {
                Write-Host "  $key - $repoDesc (Not a git repository)" -ForegroundColor Yellow
            }

            Set-Location -Path $currentLocation
        } else {
            Write-Host "  $key - $repoDesc (Directory not found)" -ForegroundColor Red
        }
    }
}

# Process a single repository
function Process-Repository {
    param (
        [string]$RepoKey,
        [hashtable]$RepoData
    )

    $repoPath = $RepoData.path
    $repoBranch = $RepoData.branch
    $repoRemote = $RepoData.remote
    $repoDesc = $RepoData.description

    # Check if the repository exists
    if (-not (Test-Path -Path $repoPath -PathType Container)) {
        Write-Host "Error: Repository directory '$repoPath' not found" -ForegroundColor Red
        return
    }

    Write-Host "Processing $repoDesc ($repoPath)" -ForegroundColor Cyan

    switch ($Action) {
        "status" {
            Execute-GitCommand -RepoPath $repoPath -Command "git status" -Description "Checking status"
        }
        "pull" {
            Execute-GitCommand -RepoPath $repoPath -Command "git pull $repoRemote $repoBranch" -Description "Pulling latest changes"
        }
        "push" {
            Execute-GitCommand -RepoPath $repoPath -Command "git push $repoRemote $repoBranch" -Description "Pushing changes to remote"
        }
        "add" {
            Execute-GitCommand -RepoPath $repoPath -Command "git add ." -Description "Adding all changes"
        }
        "commit" {
            if ([string]::IsNullOrEmpty($CommitMessage)) {
                Write-Host "Error: Commit message is required for commit action" -ForegroundColor Red
                return
            }
            Execute-GitCommand -RepoPath $repoPath -Command "git commit -m '$CommitMessage'" -Description "Committing changes"
        }
        "add-commit" {
            if ([string]::IsNullOrEmpty($CommitMessage)) {
                Write-Host "Error: Commit message is required for add-commit action" -ForegroundColor Red
                return
            }
            Execute-GitCommand -RepoPath $repoPath -Command "git add ." -Description "Adding all changes"
            Execute-GitCommand -RepoPath $repoPath -Command "git commit -m '$CommitMessage'" -Description "Committing changes"
        }
        "add-commit-push" {
            if ([string]::IsNullOrEmpty($CommitMessage)) {
                Write-Host "Error: Commit message is required for add-commit-push action" -ForegroundColor Red
                return
            }
            Execute-GitCommand -RepoPath $repoPath -Command "git add ." -Description "Adding all changes"
            Execute-GitCommand -RepoPath $repoPath -Command "git commit -m '$CommitMessage'" -Description "Committing changes"
            Execute-GitCommand -RepoPath $repoPath -Command "git push $repoRemote $repoBranch" -Description "Pushing changes to remote"
        }
        "sync" {
            if ([string]::IsNullOrEmpty($CommitMessage)) {
                Write-Host "Error: Commit message is required for sync action" -ForegroundColor Red
                return
            }
            Execute-GitCommand -RepoPath $repoPath -Command "git pull $repoRemote $repoBranch" -Description "Pulling latest changes"
            Execute-GitCommand -RepoPath $repoPath -Command "git add ." -Description "Adding all changes"
            Execute-GitCommand -RepoPath $repoPath -Command "git commit -m '$CommitMessage'" -Description "Committing changes"
            Execute-GitCommand -RepoPath $repoPath -Command "git push $repoRemote $repoBranch" -Description "Pushing changes to remote"
        }
        default {
            Write-Host "Unknown action: $Action" -ForegroundColor Red
            Show-Help
        }
    }

    Write-Host ""
}

# Process all repositories for a specific action
function Process-All-Repositories {
    param (
        [string]$Action
    )

    foreach ($key in $repoInfo.Keys) {
        Process-Repository -RepoKey $key -RepoData $repoInfo[$key]
    }
}

# Main script execution
if ($Help) {
    Show-Help
    exit 0
}

# Handle list action
if ($Action -eq "list") {
    List-Repositories
    exit 0
}

# Handle all-repositories actions
$allRepoActions = @("pull-all", "push-all", "status-all")
if ($allRepoActions.Contains($Action.ToLower())) {
    $singleAction = $Action.ToLower().Replace("-all", "")
    Write-Host "Performing '$singleAction' on all repositories..." -ForegroundColor Cyan

    foreach ($key in $repoInfo.Keys) {
        $Action = $singleAction
        Process-Repository -RepoKey $key -RepoData $repoInfo[$key]
    }

    Write-Host "All repository operations completed." -ForegroundColor Green
    exit 0
}

# Validate action
$validActions = @("status", "pull", "push", "add", "commit", "add-commit", "add-commit-push", "sync", "list", "pull-all", "push-all", "status-all")
if (-not $validActions.Contains($Action.ToLower())) {
    Write-Host "Error: Invalid action '$Action'" -ForegroundColor Red
    Show-Help
    exit 1
}

# Validate repository
if ([string]::IsNullOrEmpty($Repo)) {
    Write-Host "Error: Repository must be specified for action '$Action'" -ForegroundColor Red
    Show-Help
    exit 1
}

if (-not $repoInfo.ContainsKey($Repo)) {
    Write-Host "Error: Unknown repository '$Repo'" -ForegroundColor Red
    Write-Host "Available repositories: $($repoInfo.Keys -join ', ')" -ForegroundColor Yellow
    exit 1
}

# Process the specified repository
Process-Repository -RepoKey $Repo -RepoData $repoInfo[$Repo]

Write-Host "Repository operation completed." -ForegroundColor Green
