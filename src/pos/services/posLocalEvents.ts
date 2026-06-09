import type { PosWsEvent } from '../types'

type Listener = (ev: PosWsEvent) => void

const localListeners = new Set<Listener>()

export function emitPosLocalEvent(ev: PosWsEvent): void {
  localListeners.forEach((listener) => listener(ev))
}

export function subscribePosLocalEvents(listener: Listener): () => void {
  localListeners.add(listener)
  return () => localListeners.delete(listener)
}

export function dispatchShopOrderEvent(
  ev:
    | { type: 'shop-order.created'; order: Record<string, unknown> }
    | { type: 'shop-order.updated'; order: Record<string, unknown> },
): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('pos:shop-order', { detail: ev }))
}
