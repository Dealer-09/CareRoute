/**
 * Server-Sent Events broadcaster for the clinician queue.
 * Zero dependencies — uses native Node.js Response objects.
 * Clients connect via GET /api/triage/queue/stream.
 * The save route calls broadcast() whenever a new triage case arrives.
 */
import type { Response } from 'express'

// Active SSE connections
const connections = new Set<Response>()

export function addConnection(res: Response): void {
  if (!res.destroyed && !res.writableEnded) {
    connections.add(res)
    res.on('error', () => removeConnection(res))
  }
}

export function removeConnection(res: Response): void {
  connections.delete(res)
}

export function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of connections) {
    // Evict already-destroyed sockets before attempting write
    if (res.destroyed || res.writableEnded) { connections.delete(res); continue }
    try {
      res.write(payload)
    } catch {
      // Client disconnected mid-write — clean up
      connections.delete(res)
    }
  }
}

// Heartbeat: ping every 30s to detect and evict stale connections
const heartbeat = setInterval(() => {
  broadcast('ping', { time: Date.now() })
}, 30_000)

export function stopHeartbeat(): void {
  clearInterval(heartbeat)
}
