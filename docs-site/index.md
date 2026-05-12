---
layout: home

hero:
  name: BeadSpec
  text: A desktop GUI for Beads issue tracking
  tagline: Visualize dependencies, manage issues visually, and browse OpenSpec changes — without leaving your workflow.
  image:
    src: /screenshots/main.png
    alt: BeadSpec screenshot
  actions:
    - theme: brand
      text: Get Started
      link: /guide/installation
    - theme: alt
      text: View on GitHub
      link: https://github.com/boardthatpowder/BeadSpec

features:
  - icon: 🕸️
    title: Dependency Graph
    details: Interactive visual graph of issue dependencies. Spot bottlenecks and critical paths at a glance.
  - icon: ⚡
    title: Real-time Sync
    details: Polls dolt_log() for changes. Edits made in the terminal appear in BeadSpec immediately — no manual refresh.
  - icon: 🗂️
    title: Workspace Tabs
    details: Open issues as tabs in a multi-pane workspace. Split panes side-by-side and drag tabs between them.
  - icon: 🏥
    title: Health & Formulas
    details: Run bd diagnostics (preflight, doctor, lint, stale, orphans) and pour bd workflow formulas without leaving the app.
  - icon: 📝
    title: OpenSpec Browser
    details: Browse in-flight change proposals and their implementation status directly inside the app. Optional integration.
  - icon: ⌨️
    title: Quick Capture
    details: A global keyboard shortcut opens a floating window for fast issue creation — without switching apps.
---
