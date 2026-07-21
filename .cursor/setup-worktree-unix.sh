#!/usr/bin/env bash
set -euo pipefail

# Shared git dir: fetch once, then sync local main and merge into this worktree's branch.
git fetch origin main

root="${ROOT_WORKTREE_PATH:?ROOT_WORKTREE_PATH is not set}"
if ref="$(git -C "$root" symbolic-ref -q HEAD 2>/dev/null)" && [ "$ref" = "refs/heads/main" ]; then
  git -C "$root" merge --ff-only origin/main
else
  git update-ref refs/heads/main origin/main
fi

git merge origin/main --no-edit

vp install
