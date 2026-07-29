/** Shared utility helpers used across multiple pages. */

/**
 * Returns a human-readable relative time string.
 * e.g. "just now", "5m ago", "3h ago", "2d ago"
 */
export function timeAgo(iso: string): string {
  if (!iso || isNaN(new Date(iso).getTime())) return 'Unknown'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
