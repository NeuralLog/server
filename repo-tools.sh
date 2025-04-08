#!/bin/bash

# Define repository paths
declare -A repos
repos["specs"]="specs"
repos["server"]="server"
repos["mcp-client"]="mcp-client"

# Define repository branches
declare -A branches
branches["specs"]="master"
branches["server"]="main"
branches["mcp-client"]="main"

# Define repository descriptions
declare -A descriptions
descriptions["specs"]="NeuralLog Specifications"
descriptions["server"]="NeuralLog Server"
descriptions["mcp-client"]="NeuralLog MCP Client"

# Default values
ACTION="status"
REPO=""
COMMIT_MESSAGE="Update repository"

# Display help information
show_help() {
    echo -e "\033[36mNeuralLog Repository Tools\033[0m"
    echo -e "\033[36m=========================\033[0m"
    echo ""
    echo -e "\033[33mUsage: ./repo-tools.sh [options]\033[0m"
    echo ""
    echo -e "\033[32mOptions:\033[0m"
    echo "  -a, --action ACTION       Action to perform (default: status)"
    echo "  -r, --repo REPO           Repository to operate on (required for single repo actions)"
    echo "  -m, --message MESSAGE     Commit message (required for commit actions)"
    echo "  -h, --help                Show this help message"
    echo ""
    echo -e "\033[32mActions:\033[0m"
    echo "  status        - Show the status of a repository"
    echo "  pull          - Pull the latest changes from remote"
    echo "  push          - Push local changes to remote"
    echo "  add           - Add all changes to staging"
    echo "  commit        - Commit staged changes (requires -m)"
    echo "  add-commit    - Add and commit all changes (requires -m)"
    echo "  add-commit-push - Add, commit, and push all changes (requires -m)"
    echo "  sync          - Pull, add, commit, and push all changes (requires -m)"
    echo "  list          - List available repositories"
    echo "  pull-all      - Pull the latest changes from all repositories"
    echo "  push-all      - Push local changes to all repositories"
    echo "  status-all    - Show the status of all repositories"
    echo ""
    echo -e "\033[32mRepositories:\033[0m"
    echo "  specs         - NeuralLog Specifications"
    echo "  server        - NeuralLog Server"
    echo "  mcp-client    - NeuralLog MCP Client"
    echo ""
    echo -e "\033[33mExamples:\033[0m"
    echo "  ./repo-tools.sh -a list"
    echo "  ./repo-tools.sh -a status -r server"
    echo "  ./repo-tools.sh -a pull -r server"
    echo "  ./repo-tools.sh -a add-commit -r mcp-client -m 'Update documentation'"
    echo "  ./repo-tools.sh -a sync -r specs -m 'Weekly update'"
    echo "  ./repo-tools.sh -a pull-all"
    echo "  ./repo-tools.sh -a push-all"
    echo ""
    echo -e "\033[33mNote: This script respects that each repository is independent.\033[0m"
    echo -e "\033[33m      It does NOT treat the directories as a monorepo.\033[0m"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -a|--action)
            ACTION="$2"
            shift
            shift
            ;;
        -r|--repo)
            REPO="$2"
            shift
            shift
            ;;
        -m|--message)
            COMMIT_MESSAGE="$2"
            shift
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Execute git command in repository
execute_git_command() {
    local repo_path="$1"
    local command="$2"
    local description="$3"
    
    local current_dir=$(pwd)
    cd "$repo_path" || { echo "Error: Cannot change to directory $repo_path"; return 1; }
    
    echo -e "\033[90mExecuting in $repo_path: $command\033[0m"
    eval "$command"
    local status=$?
    
    if [ $status -ne 0 ]; then
        echo -e "\033[31mError executing command in $repo_path\033[0m"
    fi
    
    cd "$current_dir" || { echo "Error: Cannot change back to original directory"; return 1; }
    return $status
}

# List available repositories
list_repositories() {
    echo -e "\033[36mAvailable Repositories:\033[0m"
    for repo_key in "${!repos[@]}"; do
        repo_path="${repos[$repo_key]}"
        repo_desc="${descriptions[$repo_key]}"
        
        # Check if the repository exists
        if [ -d "$repo_path" ]; then
            current_dir=$(pwd)
            cd "$repo_path" 2>/dev/null
            
            # Get the current branch
            current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
            if [ $? -eq 0 ]; then
                echo -e "  \033[32m$repo_key - $repo_desc (Branch: $current_branch)\033[0m"
            else
                echo -e "  \033[33m$repo_key - $repo_desc (Not a git repository)\033[0m"
            fi
            
            cd "$current_dir"
        else
            echo -e "  \033[31m$repo_key - $repo_desc (Directory not found)\033[0m"
        fi
    done
}

# Process a single repository
process_repository() {
    local repo_key="$1"
    local repo_path="${repos[$repo_key]}"
    local repo_branch="${branches[$repo_key]}"
    local repo_desc="${descriptions[$repo_key]}"
    local current_action="$2"
    
    if [ -z "$current_action" ]; then
        current_action="$ACTION"
    fi
    
    # Check if the repository exists
    if [ ! -d "$repo_path" ]; then
        echo -e "\033[31mError: Repository directory '$repo_path' not found\033[0m"
        return 1
    fi
    
    echo -e "\033[36mProcessing $repo_desc ($repo_path)\033[0m"
    
    case "$current_action" in
        status)
            execute_git_command "$repo_path" "git status" "Checking status"
            ;;
        pull)
            execute_git_command "$repo_path" "git pull origin $repo_branch" "Pulling latest changes"
            ;;
        push)
            execute_git_command "$repo_path" "git push origin $repo_branch" "Pushing changes to remote"
            ;;
        add)
            execute_git_command "$repo_path" "git add ." "Adding all changes"
            ;;
        commit)
            if [ -z "$COMMIT_MESSAGE" ]; then
                echo -e "\033[31mError: Commit message is required for commit action\033[0m"
                return 1
            fi
            execute_git_command "$repo_path" "git commit -m \"$COMMIT_MESSAGE\"" "Committing changes"
            ;;
        add-commit)
            if [ -z "$COMMIT_MESSAGE" ]; then
                echo -e "\033[31mError: Commit message is required for add-commit action\033[0m"
                return 1
            fi
            execute_git_command "$repo_path" "git add ." "Adding all changes"
            execute_git_command "$repo_path" "git commit -m \"$COMMIT_MESSAGE\"" "Committing changes"
            ;;
        add-commit-push)
            if [ -z "$COMMIT_MESSAGE" ]; then
                echo -e "\033[31mError: Commit message is required for add-commit-push action\033[0m"
                return 1
            fi
            execute_git_command "$repo_path" "git add ." "Adding all changes"
            execute_git_command "$repo_path" "git commit -m \"$COMMIT_MESSAGE\"" "Committing changes"
            execute_git_command "$repo_path" "git push origin $repo_branch" "Pushing changes to remote"
            ;;
        sync)
            if [ -z "$COMMIT_MESSAGE" ]; then
                echo -e "\033[31mError: Commit message is required for sync action\033[0m"
                return 1
            fi
            execute_git_command "$repo_path" "git pull origin $repo_branch" "Pulling latest changes"
            execute_git_command "$repo_path" "git add ." "Adding all changes"
            execute_git_command "$repo_path" "git commit -m \"$COMMIT_MESSAGE\"" "Committing changes"
            execute_git_command "$repo_path" "git push origin $repo_branch" "Pushing changes to remote"
            ;;
        *)
            echo -e "\033[31mUnknown action: $current_action\033[0m"
            show_help
            return 1
            ;;
    esac
    
    echo ""
}

# Process all repositories for a specific action
process_all_repositories() {
    local action="$1"
    
    for repo_key in "${!repos[@]}"; do
        process_repository "$repo_key" "$action"
    done
}

# Handle list action
if [ "$ACTION" = "list" ]; then
    list_repositories
    exit 0
fi

# Handle all-repositories actions
if [[ "$ACTION" == *-all ]]; then
    single_action=${ACTION%-all}
    echo -e "\033[36mPerforming '$single_action' on all repositories...\033[0m"
    
    process_all_repositories "$single_action"
    
    echo -e "\033[32mAll repository operations completed.\033[0m"
    exit 0
fi

# Validate action
valid_actions=("status" "pull" "push" "add" "commit" "add-commit" "add-commit-push" "sync" "list" "pull-all" "push-all" "status-all")
valid_action=0
for action in "${valid_actions[@]}"; do
    if [ "$ACTION" = "$action" ]; then
        valid_action=1
        break
    fi
done

if [ $valid_action -eq 0 ]; then
    echo -e "\033[31mError: Invalid action '$ACTION'\033[0m"
    show_help
    exit 1
fi

# Validate repository
if [ -z "$REPO" ]; then
    echo -e "\033[31mError: Repository must be specified for action '$ACTION'\033[0m"
    show_help
    exit 1
fi

if [ -z "${repos[$REPO]}" ]; then
    echo -e "\033[31mError: Unknown repository '$REPO'\033[0m"
    echo -e "\033[33mAvailable repositories: ${!repos[*]}\033[0m"
    exit 1
fi

# Process the specified repository
process_repository "$REPO"

echo -e "\033[32mRepository operation completed.\033[0m"
