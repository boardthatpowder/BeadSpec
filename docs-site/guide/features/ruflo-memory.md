# Ruflo Memory Panel

> **Optional.** Requires the `ruflo` CLI and **Settings → Features → Ruflo integration** enabled. If Ruflo is not installed, this panel does not appear.

The Ruflo memory panel lets you search and review memories stored by the `ruflo` agent tooling, directly inside BeadSpec.

## Opening the panel

When the Ruflo integration is enabled and the `ruflo` binary is found on your PATH (or set in **Settings → Binary Paths → ruflo**), a **Ruflo** panel appears in the task detail view.

## Searching memories

Type a query in the search field to run a semantic search across all Ruflo memories for the current project. Results are ranked by relevance.

## Ruflo filter chips

When Ruflo is enabled, filter chips for Ruflo-tagged labels appear in the task list filter bar, making it easier to find tasks linked to specific Ruflo memory entries.

## Enabling / disabling

Toggle Ruflo in **Settings → Features → Ruflo integration**. The panel hides immediately when the toggle is off and reappears when re-enabled (provided the binary is available).

## For more on Ruflo

Ruflo is a separate CLI tool for cross-session agent memory. See the [Ruflo project](https://github.com/gastownhall/ruflo) for installation and usage.
