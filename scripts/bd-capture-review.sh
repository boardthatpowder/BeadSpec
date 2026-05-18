#!/usr/bin/env bash
set -euo pipefail

kind=""
branch=""
pr=""
title=""
dedupe_sha=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kind) kind="${2:-}"; shift 2 ;;
    --branch) branch="${2:-}"; shift 2 ;;
    --pr) pr="${2:-}"; shift 2 ;;
    --title) title="${2:-}"; shift 2 ;;
    --dedupe-sha) dedupe_sha=1; shift ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$kind" || -z "$branch" ]]; then
  echo "usage: bd-capture-review.sh --kind <kind> --branch <branch> [--pr <num>] [--title <title>] [--dedupe-sha]" >&2
  exit 2
fi

body="$(cat)"
if [[ -z "$body" ]]; then
  echo "review body is empty" >&2
  exit 2
fi

if [[ -f "${HOME}/.claude/ruflo/lib/tags.sh" ]]; then
  # shellcheck source=/dev/null
  source "${HOME}/.claude/ruflo/lib/tags.sh"
else
  echo "ruflo tags helper not found" >&2
  exit 3
fi

if ! prefix="$(ruflo_key_prefix 2>/dev/null)"; then
  echo "could not derive ruflo key prefix" >&2
  exit 3
fi

sha="$(printf '%s' "$body" | shasum -a 256 | awk '{print $1}')"
if [[ "$dedupe_sha" -eq 1 ]]; then
  if ruflo memory search -q "sha:${sha}" --format json 2>/dev/null | grep -q "$sha"; then
    echo "review already captured for sha:${sha}" >&2
    exit 0
  fi
fi

ts="$(date +%s)"
key="${prefix}|review:${kind}|branch:${branch}|sha:${sha}|"
if [[ -n "$pr" ]]; then
  key="${key}pr:${pr}|"
fi
if [[ -n "$title" ]]; then
  safe_title="$(printf '%s' "$title" | tr ' ' '_' | tr -cd 'A-Za-z0-9._/-')"
  key="${key}title:${safe_title}|"
fi
key="${key}ts:${ts}"

if ! ruflo memory store -k "$key" -v "$body"; then
  echo "ruflo memory store failed" >&2
  exit 4
fi

echo "$key"
echo "captured review ${kind} for ${branch}"
