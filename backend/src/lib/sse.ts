/**
 * Server-Sent Events broadcaster for the clinician queue.
 * Zero dependencies — uses native Node.js Response objects.
 * Clients connect via GET /api/triage/queue/stream.
 * The save route calls broadcast() whenever a new triage case arrives.
 */
import type { Response } from 'express'

// Active SSE connections keyed by a unique ID
const connections = new Map<string, Response>()
let counter = 0

export function addConnection(res: Response): string {
  const id = `sse-${++counter}`
  connections.set(id, res)
  return id
}

export function removeConnection(id: string): void {
  connections.delete(id)
}

export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const [id, res] of connections) {
    // Evict already-destroyed sockets before attempting write
    if (res.destroyed || res.writableEnded) { connections.delete(id); continue }
    try {
      res.write(payload)
    } catch {
      // Client disconnected mid-write — clean up
      connections.delete(id)
    }
  }
}

export function connectionCount(): number {
  return connections.size
}

// Heartbeat: ping every 30s to detect and evict stale connections
setInterval(() => {
  for (const [id, res] of connections) {
    if (res.destroyed || res.writableEnded) { connections.delete(id); continue }
    try { res.write(': heartbeat\n\n') } catch { connections.delete(id) }
  }
}, 30_000)
