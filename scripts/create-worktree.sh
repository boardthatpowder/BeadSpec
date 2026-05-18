#!/usr/bin/env sh
set -eu

usage() {
  cat <<'USAGE'
Usage: scripts/create-worktree.sh <path> [--branch <branch>] [<commit-ish>]

Creates a git worktree, then links its Beads runtime to the main checkout.
Use this instead of raw `git worktree add` to ensure Beads is shared correctly.
USAGE
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

[ "${1:-}" != "" ] || {
  usage
  exit 2
}

target=$1
shift

branch=""
if [ "${1:-}" = "--branch" ] || [ "${1:-}" = "-b" ]; then
  shift
  [ "${1:-}" != "" ] || fail "--branch requires a branch name"
  branch=$1
  shift
fi

case "$target" in
  /*) target_abs=$target ;;
  *)
    target_dir=$(dirname "$target")
    target_base=$(basename "$target")
    target_abs="$(cd "$target_dir" && pwd -P)/$target_base"
    ;;
esac

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "not inside a git repository"
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)

if [ -n "$branch" ]; then
  git -C "$repo_root" worktree add -b "$branch" "$target_abs" "$@"
else
  git -C "$repo_root" worktree add "$target_abs" "$@"
fi

(cd "$target_abs" && "$script_dir/setup-worktree-beads.sh")
