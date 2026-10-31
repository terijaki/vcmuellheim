#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[worktree-setup] $*"
}

resolve_default_branch() {
  local ref

  if ref="$(git symbolic-ref -q refs/remotes/origin/HEAD 2>/dev/null)"; then
    printf '%s\n' "${ref#refs/remotes/origin/}"
    return 0
  fi

  if git show-ref --verify --quiet refs/remotes/origin/main; then
    printf 'main\n'
    return 0
  fi

  if git show-ref --verify --quiet refs/remotes/origin/master; then
    printf 'master\n'
    return 0
  fi

  return 1
}

resolve_base_branch() {
  local root="${ROOT_WORKTREE_PATH:-}"
  local branch

  if [ -n "$root" ]; then
    if branch="$(git -C "$root" symbolic-ref -q --short HEAD 2>/dev/null)"; then
      printf '%s\n' "$branch"
      return 0
    fi
  fi

  resolve_default_branch
}

resolve_remote_base() {
  local base="$1"
  local default_branch

  if git show-ref --verify --quiet "refs/remotes/origin/${base}"; then
    printf 'origin/%s\n' "$base"
    return 0
  fi

  if default_branch="$(resolve_default_branch)" &&
    git show-ref --verify --quiet "refs/remotes/origin/${default_branch}"; then
    printf 'origin/%s\n' "$default_branch"
    return 0
  fi

  return 1
}

refresh_local_base_ref() {
  local base="$1"
  local remote="$2"
  local root="${ROOT_WORKTREE_PATH:-}"
  local root_branch=""

  if [ -n "$root" ]; then
    root_branch="$(git -C "$root" symbolic-ref -q --short HEAD 2>/dev/null || true)"
  fi

  if [ -n "$root_branch" ] && [ "$root_branch" = "$base" ]; then
    log "fast-forwarding root checkout ${base} to ${remote} (best-effort)..."
    git -C "$root" merge --ff-only "${remote}" >/dev/null 2>&1 ||
      log "root checkout could not fast-forward (dirty or diverged); continuing"
    return 0
  fi

  if git show-ref --verify --quiet "refs/heads/${base}"; then
    if git merge-base --is-ancestor "refs/heads/${base}" "${remote}"; then
      log "updating local ${base} to ${remote} (fast-forward)"
      git update-ref "refs/heads/${base}" "${remote}"
    else
      log "local ${base} is not an ancestor of ${remote}; leaving it unchanged"
    fi
    return 0
  fi

  log "creating local ${base} at ${remote}"
  git update-ref "refs/heads/${base}" "${remote}"
}

sync_worktree_with_base() {
  local base remote behind

  log "fetching from origin..."
  git fetch origin

  if ! base="$(resolve_base_branch)"; then
    log "could not resolve a base branch; skipping sync"
    return 0
  fi

  if ! remote="$(resolve_remote_base "$base")"; then
    log "no origin remote for ${base} or the default branch; skipping sync"
    return 0
  fi

  log "base branch is ${base} (${remote})"
  refresh_local_base_ref "$base" "$remote"

  behind="$(git rev-list --count "HEAD..${remote}" 2>/dev/null || true)"
  behind="${behind:-0}"
  if [ "${behind}" -gt 0 ]; then
    log "worktree is ${behind} commit(s) behind ${remote}, merging..."
    if ! git merge --ff-only "${remote}"; then
      git merge "${remote}" --no-edit -m "Merge ${remote} into worktree branch"
    fi
  else
    log "worktree is up to date with ${remote}"
  fi
}

log "starting worktree setup"
sync_worktree_with_base
log "installing dependencies..."
vp install
log "done"
