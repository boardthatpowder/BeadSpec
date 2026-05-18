#!/usr/bin/env bash
set -eu
trap 'printf "error: setup-worktree-beads.sh failed near line %s\n" "$LINENO" >&2' ERR

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'error: %s\n' "$*" >&2
  exit 1
}

absolute_git_path() {
  local_value=$1
  local_base=$2
  case "$local_value" in
    /*) printf '%s\n' "$local_value" ;;
    *) printf '%s/%s\n' "$local_base" "$local_value" ;;
  esac
}

repo_root=$(git rev-parse --show-toplevel 2>/dev/null) || fail "not inside a git repository"
repo_root=$(cd "$repo_root" && pwd -P)

git_dir_raw=$(git -C "$repo_root" rev-parse --git-dir)
common_dir_raw=$(git -C "$repo_root" rev-parse --git-common-dir)
git_dir=$(absolute_git_path "$git_dir_raw" "$repo_root")
common_git_dir=$(absolute_git_path "$common_dir_raw" "$repo_root")

case "$common_git_dir" in
  */.git) main_root=${common_git_dir%/.git} ;;
  *) fail "cannot infer main checkout from git common dir: $common_git_dir" ;;
esac

main_root=$(cd "$main_root" && pwd -P)
main_beads="$main_root/.beads"
worktree_beads="$repo_root/.beads"

if [ "$repo_root" = "$main_root" ] && [ "$git_dir" = "$common_git_dir" ]; then
  log "Beads worktree setup: main checkout detected; no symlinks needed."
  exit 0
fi

[ -d "$main_beads" ] || fail "main checkout does not have .beads: $main_beads"
[ -d "$main_beads/dolt" ] || fail "main checkout does not have .beads/dolt; run bd bootstrap in $main_root first"

mkdir -p "$worktree_beads"

database_name=$(jq -r '.dolt_database // empty' "$main_beads/metadata.json" 2>/dev/null || true)
if [ -n "$database_name" ] && [ ! -d "$main_beads/dolt/$database_name" ]; then
  fail "main Dolt data does not contain database '$database_name' under $main_beads/dolt"
fi

backup_dir=""
backup_created=0

ensure_backup_dir() {
  if [ "$backup_created" -eq 0 ]; then
    if [ -n "${BEADS_WORKTREE_BACKUP_DIR:-}" ]; then
      backup_dir="$BEADS_WORKTREE_BACKUP_DIR"
      mkdir -p "$backup_dir"
    else
      # mktemp avoids collisions when two parallel invocations land in the same second.
      mkdir -p "$worktree_beads/backup"
      backup_dir=$(mktemp -d "$worktree_beads/backup/worktree-runtime-$(date +%Y%m%d-%H%M%S)-XXXXXX")
    fi
    backup_created=1
  fi
}

link_runtime_item() {
  item_name=$1
  source_item="$main_beads/$item_name"
  target_item="$worktree_beads/$item_name"

  if [ -L "$target_item" ] && [ "$(readlink "$target_item")" = "$source_item" ]; then
    return
  fi

  if [ -e "$target_item" ] || [ -L "$target_item" ]; then
    ensure_backup_dir
    mv "$target_item" "$backup_dir/$item_name"
  fi

  ln -s "$source_item" "$target_item"
}

link_runtime_item "dolt"
link_runtime_item "dolt-server.port"
link_runtime_item "dolt-server.pid"
link_runtime_item "dolt-server.log"
link_runtime_item "dolt-server.lock"

exclude_file="$common_git_dir/info/exclude"
mkdir -p "$(dirname "$exclude_file")"
touch "$exclude_file"
if ! grep -qxF ".beads/dolt" "$exclude_file"; then
  {
    printf '\n# Local Beads worktree symlink\n'
    printf '.beads/dolt\n'
  } >>"$exclude_file"
fi

if [ "${BD_WORKTREE_SKIP_VERIFY:-0}" != "1" ] && command -v bd >/dev/null 2>&1; then
  # Verification is advisory — port lock contention should not abort the whole setup.
  set +e
  bd dolt show >/dev/null 2>&1 || log "Beads worktree setup: bd dolt show check failed (non-fatal)"
  bd status >/dev/null 2>&1 || log "Beads worktree setup: bd status check failed (non-fatal)"
  set -e
fi

if [ "$backup_created" -eq 1 ]; then
  log "Beads worktree setup: linked to $main_beads and preserved old runtime at $backup_dir"
else
  log "Beads worktree setup: linked to $main_beads"
fi
