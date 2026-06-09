import { SHOP_WS_PATH } from '../constants'
import { getAccessToken, getApiBase } from '../../api'
import type { PosWsEvent } from '../types'

export type ShopWsStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

function wsUrlFromApiBase(base: string): string {
  const trimmed = base.replace(/\/$/, '')
  const withToken = (raw: string): string => {
    const token = getAccessToken()
    if (!token) return raw
    const sep = raw.includes('?') ? '&' : '?'
    return `${raw}${sep}token=${encodeURIComponent(token)}`
  }
  if (trimmed.startsWith('https://')) {
    return withToken(trimmed.replace(/^https:/, 'wss:') + SHOP_WS_PATH)
  }
  if (trimmed.startsWith('http://')) {
    return withToken(trimmed.replace(/^http:/, 'ws:') + SHOP_WS_PATH)
  }
  if (trimmed.includes('/dev-api')) {
    const origin =
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
    return withToken(`${origin.replace(/^http/, 'ws')}/dev-api${SHOP_WS_PATH}`)
  }
  return withToken(`ws://localhost:3000${SHOP_WS_PATH}`)
}

export class ShopWebSocketClient {
  private ws: WebSocket | null = null
  private listeners = new Set<(ev: PosWsEvent) => void>()
  private statusListeners = new Set<(s: ShopWsStatus) => void>()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private disposed = false
  private failCount = 0

  connect(base?: string): void {
    if (this.disposed) return
    const apiBase = base ?? getApiBase()
    this.setStatus('connecting')
    try {
      if (this.ws) {
        this.ws.onopen = null
        this.ws.onclose = null
        this.ws.onerror = null
        this.ws.onmessage = null
        this.ws.close()
      }
    } catch {
      /* ignore */
    }

    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrlFromApiBase(apiBase))
      this.ws = ws
    } catch {
      this.failCount++
      this.setStatus('error')
      this.scheduleReconnect(apiBase)
      return
    }

    ws.onopen = () => {
      if (this.disposed) {
        try {
          ws.close()
        } catch {
          /* ignore */
        }
        return
      }
      this.failCount = 0
      this.setStatus('open')
    }
    ws.onclose = () => {
      this.setStatus('closed')
      if (!this.disposed) {
        this.failCount++
        this.scheduleReconnect(apiBase)
      }
    }
    ws.onerror = () => {
      this.setStatus('error')
    }
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(String(msg.data)) as PosWsEvent
        if (ev?.type) this.listeners.forEach((l) => l(ev))
      } catch {
        /* ignore */
      }
    }
  }

  private scheduleReconnect(base: string): void {
    if (this.disposed || this.failCount >= 5) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    const delay = Math.min(30_000, 4000 * this.failCount)
    this.reconnectTimer = setTimeout(() => this.connect(base), delay)
  }

  private setStatus(s: ShopWsStatus): void {
    this.statusListeners.forEach((l) => l(s))
  }

  subscribe(fn: (ev: PosWsEvent) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  onStatus(fn: (s: ShopWsStatus) => void): () => void {
    this.statusListeners.add(fn)
    return () => this.statusListeners.delete(fn)
  }

  dispose(): void {
    this.disposed = true
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    try {
      if (this.ws) {
        const socket = this.ws
        socket.onopen = null
        socket.onclose = null
        socket.onerror = null
        socket.onmessage = null
        if (socket.readyState === WebSocket.OPEN) socket.close()
      }
    } catch {
      /* ignore */
    }
    this.ws = null
    this.listeners.clear()
    this.statusListeners.clear()
  }

  reset(): void {
    this.disposed = false
    this.failCount = 0
  }
}

export const shopWsClient = new ShopWebSocketClient()
