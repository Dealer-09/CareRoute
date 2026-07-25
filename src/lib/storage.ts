import type { TriageResult } from '@/types/triage'

const KEY = 'careRouteHistory'

export function getHistory(): TriageResult[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw) as TriageResult[]
  } catch {
    return []
  }
}

export function saveAnalysisToHistory(item: TriageResult): void {
  if (typeof window === 'undefined') return
  const current = getHistory()
  // Deduplicate by timestamp, keep last 10
  const merged = [item, ...current].slice(0, 10)
  try {
    localStorage.setItem(KEY, JSON.stringify(merged))
  } catch {
    // Storage quota exceeded — fail silently
  }
}

