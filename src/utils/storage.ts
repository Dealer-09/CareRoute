import { AnalysisResult } from '../rules'

const KEY = 'careRouteHistory'

export function getHistory(): Array<AnalysisResult & { timestamp?: number; files?: string[] }> {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    return JSON.parse(raw)
  } catch (e) { return [] }
}

export function saveAnalysisToHistory(item: AnalysisResult & { timestamp?: number; files?: string[] }) {
  const cur = getHistory()
  const merged = [item, ...cur].slice(0,5)
  try { localStorage.setItem(KEY, JSON.stringify(merged)) } catch (e) {}
}

export function clearHistory() { localStorage.removeItem(KEY) }
