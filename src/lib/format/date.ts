import { format, formatDistanceToNow } from 'date-fns'

export type DateInput = Date | string | number

function toValidDate(input: DateInput): Date | null {
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatRelative(ts: DateInput): string {
  const date = toValidDate(ts)
  if (!date) return ''
  return formatDistanceToNow(date, { addSuffix: true })
}

export function formatAbsolute(ts: DateInput, opts: { includeTime?: boolean } = {}): string {
  const date = toValidDate(ts)
  if (!date) return ''
  return format(date, opts.includeTime ? 'MMM d, yyyy h:mm a' : 'MMM d, yyyy')
}
