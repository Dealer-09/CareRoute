import { AnalysisResult } from './rules'

const KEY = 'careRouteHistory'

export function getHistory(): Array<AnalysisResult & { timestamp?: number; files?: string[] }> {
    if (typeof window === 'undefined') return []
    try {
        const raw = localStorage.getItem(KEY)
        if (!raw) return []
        return JSON.parse(raw)
    } catch { return [] }
}

export function saveAnalysisToHistory(item: AnalysisResult & { timestamp?: number; files?: string[] }) {
    if (typeof window === 'undefined') return
    const cur = getHistory()
    const merged = [item, ...cur].slice(0, 5)
    try { localStorage.setItem(KEY, JSON.stringify(merged)) } catch { }
}

export function clearHistory() {
    if (typeof window === 'undefined') return
    localStorage.removeItem(KEY)
}
