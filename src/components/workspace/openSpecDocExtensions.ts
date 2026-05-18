import StarterKit from '@tiptap/starter-kit'
import { Markdown } from 'tiptap-markdown'
import type { Extension } from '@tiptap/core'
import { commands, unwrap } from '../../ipc'
import type { SymbolHit } from '../../bindings'
import { SymbolMentionMark } from '../task-detail/SymbolMentionMark'

export function createOpenSpecDocExtensions(
  projectPath: string,
  lookupSymbols: (names: string[]) => Promise<(SymbolHit | null)[]> = names => unwrap(commands.lookupSymbols(projectPath, names)),
): Extension[] {
  return [
    StarterKit,
    Markdown.configure({ html: false }),
    SymbolMentionMark.configure({
      projectPath,
      lookupSymbols,
    }),
  ]
}
