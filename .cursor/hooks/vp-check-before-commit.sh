#!/usr/bin/env bash
set -euo pipefail

# Cursor project hooks run from the repository root.
status_before=$(git status --porcelain 2>/dev/null || true)

if ! vp check --fix; then
  printf '%s\n' \
    '{"permission":"deny","user_message":"Commit blocked: vp check --fix failed. Fix lint, format, or type errors before committing.","agent_message":"vp check --fix failed. Resolve the reported issues, then retry the commit."}'
  exit 2
fi

status_after=$(git status --porcelain 2>/dev/null || true)
if [[ "$status_before" != "$status_after" ]]; then
  printf '%s\n' \
    '{"permission":"deny","user_message":"Commit blocked: vp check --fix modified files. Re-stage the changes and commit again.","agent_message":"vp check --fix auto-fixed files. Stage the updated files before committing again."}'
  exit 2
fi

printf '%s\n' '{"permission":"allow"}'
