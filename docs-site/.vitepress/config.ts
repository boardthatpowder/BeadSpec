import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'BeadSpec',
  description: 'A native desktop GUI for the Beads issue tracker',
  base: '/BeadSpec/',

  head: [
    ['link', { rel: 'icon', href: '/BeadSpec/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'BeadSpec',

    nav: [
      { text: 'Guide', link: '/guide/installation' },
      { text: 'Contributing', link: '/contributing/' },
      { text: 'Changelog', link: 'https://github.com/boardthatpowder/BeadSpec/blob/main/CHANGELOG.md' },
      { text: 'Releases', link: 'https://github.com/boardthatpowder/BeadSpec/releases' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Installation', link: '/guide/installation' },
          { text: 'Quick Start', link: '/guide/quick-start' },
          { text: 'Relationship with bd', link: '/guide/relationship-with-bd' },
        ],
      },
      {
        text: 'Features',
        items: [
          { text: 'Task List', link: '/guide/features/task-list' },
          { text: 'Dependency Graph', link: '/guide/features/dependency-graph' },
          { text: 'Smart Views', link: '/guide/features/smart-views' },
          { text: 'Velocity & Burndown', link: '/guide/features/velocity' },
          { text: 'OpenSpec Browser', link: '/guide/features/openspec-browser' },
          { text: 'Quick Capture', link: '/guide/features/quick-capture' },
          { text: 'System Tray', link: '/guide/features/tray' },
          { text: 'Settings', link: '/guide/features/settings' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'Keyboard Shortcuts', link: '/guide/keyboard-shortcuts' },
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
        ],
      },
      {
        text: 'Contributing',
        items: [
          { text: 'Getting Started', link: '/contributing/' },
          { text: 'Architecture', link: '/contributing/architecture' },
          { text: 'OpenSpec Workflow', link: '/contributing/openspec-workflow' },
          { text: 'Testing', link: '/contributing/testing' },
          { text: 'Release Process', link: '/contributing/release-process' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/boardthatpowder/BeadSpec' },
    ],

    editLink: {
      pattern: 'https://github.com/boardthatpowder/BeadSpec/edit/main/docs-site/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT OR Apache-2.0 License.',
      copyright: 'Copyright © 2026 Dean Hart',
    },

    search: {
      provider: 'local',
    },
  },
})
