export function parsePausedNote(notes: string | null | undefined): string | null {
  if (!notes) return null
  let last: string | null = null
  for (const line of notes.split('\n')) {
    const match = /^Paused:\s*(.+)$/.exec(line)
    const reason = match?.[1]?.trim()
    if (reason) last = reason
  }
  return last
}
