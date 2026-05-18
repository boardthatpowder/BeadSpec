import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view'
import type { SymbolHit } from '../../bindings'

export const SYMBOL_STOPLIST = new Set([
  'useEffect', 'useState', 'onClick', 'className', 'undefined', 'boolean',
  'string', 'number', 'return', 'import', 'export', 'default', 'const',
  'async', 'await', 'function', 'interface', 'props',
])

const CANDIDATE_RE = /`([A-Za-z_][\w]*)`|\b([A-Z][A-Za-z0-9]*[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)\b|\b([A-Za-z]+_[A-Za-z0-9_]+)\b/g

const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_LIMIT = 200

type CacheEntry = { hit: boolean; expiresAt: number }
type SymbolMentionState = { decorations: DecorationSet; hitKey: string; hits: Set<string> }

interface SymbolMentionOptions {
  projectPath: string
  lookupSymbols: (names: string[]) => Promise<(SymbolHit | null)[]>
}

const symbolCache = new Map<string, CacheEntry>()

function cacheKey(projectPath: string, name: string) {
  return `${projectPath}::${name}`
}

function readCache(projectPath: string, name: string) {
  const key = cacheKey(projectPath, name)
  const entry = symbolCache.get(key)
  if (!entry || entry.expiresAt < Date.now()) {
    symbolCache.delete(key)
    return null
  }
  symbolCache.delete(key)
  symbolCache.set(key, entry)
  return entry
}

function writeCache(projectPath: string, name: string, hit: boolean) {
  const key = cacheKey(projectPath, name)
  symbolCache.delete(key)
  symbolCache.set(key, { hit, expiresAt: Date.now() + CACHE_TTL_MS })
  while (symbolCache.size > CACHE_LIMIT) {
    const oldest = symbolCache.keys().next().value
    if (!oldest) break
    symbolCache.delete(oldest)
  }
}

export function extractCandidateSymbols(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null
  CANDIDATE_RE.lastIndex = 0
  while ((match = CANDIDATE_RE.exec(text))) {
    const token = match[1] ?? match[2] ?? match[3]
    if (!token || token.length < 3 || SYMBOL_STOPLIST.has(token)) continue
    if (token.includes('_') && token.length <= 4) continue
    if (!seen.has(token)) {
      seen.add(token)
      out.push(token)
    }
  }
  return out
}

function buildDecorations(doc: Parameters<typeof DecorationSet.create>[0], hits: Set<string>) {
  const decorations: Decoration[] = []
  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text
    let match: RegExpExecArray | null
    CANDIDATE_RE.lastIndex = 0
    while ((match = CANDIDATE_RE.exec(text))) {
      const token = match[1] ?? match[2] ?? match[3]
      if (!token || token.length < 3 || SYMBOL_STOPLIST.has(token)) continue
      if (token.includes('_') && token.length <= 4) continue
      if (!hits.has(token)) continue
      const start = pos + match.index + (match[0].startsWith('`') ? 1 : 0)
      const end = start + token.length
      decorations.push(Decoration.inline(start, end, {
        class: 'symbol-mention',
        'data-symbol': token,
        'data-symbol-path': token,
      }))
    }
  })
  return DecorationSet.create(doc, decorations)
}

function textFromView(view: EditorView) {
  return view.state.doc.textBetween(0, view.state.doc.content.size, '\n')
}

function dispatchHits(key: PluginKey, view: EditorView, hits: Set<string>) {
  const hitKey = [...hits].sort().join('\0')
  const state = key.getState(view.state) as SymbolMentionState | undefined
  if (state?.hitKey === hitKey) return
  view.dispatch(view.state.tr.setMeta(key, { hits }))
}

export const SymbolMentionMark = Extension.create<SymbolMentionOptions>({
  name: 'symbolMentionMark',
  addOptions() {
    return {
      projectPath: '',
      lookupSymbols: async () => [],
    }
  },
  addProseMirrorPlugins() {
    const key = new PluginKey('symbolMentionMark')
    const projectPath = this.options.projectPath
    const lookupSymbols = this.options.lookupSymbols
    const pending = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = (view: EditorView) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(async () => {
        const candidates = extractCandidateSymbols(textFromView(view))
        const hits = new Set<string>()
        const unresolved: string[] = []
        for (const candidate of candidates) {
          const cached = readCache(projectPath, candidate)
          if (cached?.hit) hits.add(candidate)
          if (!cached && !pending.has(candidate)) unresolved.push(candidate)
        }
        dispatchHits(key, view, hits)
        if (!unresolved.length) return
        unresolved.forEach(name => pending.add(name))
        try {
          const resolved = await lookupSymbols(unresolved)
          resolved.forEach((hit, index) => {
            const name = unresolved[index]
            writeCache(projectPath, name, Boolean(hit))
            if (hit) hits.add(name)
          })
          dispatchHits(key, view, hits)
        } finally {
          unresolved.forEach(name => pending.delete(name))
        }
      }, 300)
    }

    return [
      new Plugin({
        key,
        state: {
          init: (_, state): SymbolMentionState => ({ decorations: buildDecorations(state.doc, new Set()), hitKey: '', hits: new Set() }),
          apply: (tr, old: SymbolMentionState, _oldState, newState): SymbolMentionState => {
            const meta = tr.getMeta(key) as { hits?: Set<string> } | undefined
            if (meta?.hits) {
              const hits = new Set(meta.hits)
              return { hits, hitKey: [...hits].sort().join('\0'), decorations: buildDecorations(newState.doc, hits) }
            }
            if (tr.docChanged) {
              return { ...old, decorations: buildDecorations(tr.doc, old.hits) }
            }
            return { ...old, decorations: old.decorations.map(tr.mapping, tr.doc) }
          },
        },
        props: {
          decorations(state) {
            return (key.getState(state) as SymbolMentionState | undefined)?.decorations
          },
        },
        view(view) {
          schedule(view)
          return {
            update(nextView, prevState) {
              if (prevState.doc !== nextView.state.doc) schedule(nextView)
            },
            destroy() {
              if (timer) clearTimeout(timer)
            },
          }
        },
      }),
    ]
  },
})
