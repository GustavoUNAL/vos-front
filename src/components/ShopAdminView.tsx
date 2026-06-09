import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchShopSettings,
  updateShopSettings,
  type ShopSettings,
} from '../api'
import { openPublicShop } from '../shop/shopApi'
import { BRAND_NAME } from '../lib/brand'
import { ViewBootSplash } from './DataLoadingSplash'

type Props = {
  baseUrl: string
  onOpenProducts?: () => void
  onOpenPos?: () => void
}

function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text)
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.style.position = 'fixed'
  ta.style.opacity = '0'
  document.body.appendChild(ta)
  ta.select()
  document.execCommand('copy')
  document.body.removeChild(ta)
  return Promise.resolve()
}

export function ShopAdminView({ baseUrl, onOpenProducts, onOpenPos }: Props) {
  const [settings, setSettings] = useState<ShopSettings | null>(null)
  const [slugDraft, setSlugDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchShopSettings(baseUrl)
      setSettings(data)
      setSlugDraft(data.shopSlug ?? '')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [baseUrl])

  useEffect(() => {
    void load()
  }, [load])

  const slugChanged = useMemo(() => {
    const current = (settings?.shopSlug ?? '').trim()
    return slugDraft.trim().toLowerCase() !== current
  }, [settings?.shopSlug, slugDraft])

  const handleSaveSlug = async () => {
    setSaving(true)
    setError(null)
    try {
      const trimmed = slugDraft.trim().toLowerCase()
      const updated = await updateShopSettings(baseUrl, {
        shopSlug: trimmed || null,
      })
      setSettings((prev) =>
        prev ? { ...prev, ...updated } : ({ ...updated } as ShopSettings),
      )
      setSlugDraft(updated.shopSlug ?? '')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleCopy = async (key: string, text: string) => {
    try {
      await copyText(text)
      setCopied(key)
      window.setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('No se pudo copiar al portapapeles')
    }
  }

  const previewUrl = settings?.catalogUrlHash ?? null

  return (
    <div className="shop-admin">
      <header className="shop-admin__hero">
        <p className="shop-admin__eyebrow muted small">{BRAND_NAME} · Tienda en línea</p>
        <h1 className="shop-admin__title">Tienda por empresa</h1>
        <p className="shop-admin__subtitle muted">
          Configurá la URL pública de la tienda de <strong>tu empresa</strong> en {BRAND_NAME}.
          Los pedidos llegan al POS en <strong>Pedidos web</strong>.
        </p>
      </header>

      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? <p className="muted">Cargando configuración…</p> : null}

      {!loading && settings ? (
        <>
          <section className="shop-admin__grid">
            <article className="shop-admin__card">
              <h2>Estado</h2>
              <dl className="shop-admin__stats">
                <div>
                  <dt>Tienda</dt>
                  <dd>{settings.enabled ? 'Activa' : 'Sin slug (inactiva)'}</dd>
                </div>
                <div>
                  <dt>Productos en carta</dt>
                  <dd>{settings.activeProducts}</dd>
                </div>
                <div>
                  <dt>Pedidos abiertos</dt>
                  <dd>{settings.pendingOrders}</dd>
                </div>
              </dl>
              <div className="shop-admin__actions">
                {onOpenProducts ? (
                  <button type="button" className="btn-secondary btn-compact" onClick={onOpenProducts}>
                    Editar productos
                  </button>
                ) : null}
                {onOpenPos ? (
                  <button type="button" className="btn-secondary btn-compact" onClick={onOpenPos}>
                    POS · Pedidos web
                  </button>
                ) : null}
                {settings.shopSlug ? (
                  <button
                    type="button"
                    className="btn-primary btn-compact"
                    onClick={() => openPublicShop(settings.shopSlug ?? undefined)}
                  >
                    Abrir tienda
                  </button>
                ) : null}
              </div>
            </article>

            <article className="shop-admin__card">
              <h2>Slug público</h2>
              <p className="muted small">
                Identificador en la URL. Solo minúsculas, números y guiones.
              </p>
              <label className="shop-admin__field">
                <span>Slug</span>
                <input
                  value={slugDraft}
                  onChange={(e) => setSlugDraft(e.target.value.toLowerCase())}
                  placeholder="arandano"
                  spellCheck={false}
                />
              </label>
              <div className="shop-admin__actions">
                <button
                  type="button"
                  className="btn-primary btn-compact"
                  disabled={!slugChanged || saving}
                  onClick={() => void handleSaveSlug()}
                >
                  {saving ? 'Guardando…' : 'Guardar slug'}
                </button>
              </div>
            </article>
          </section>

          {settings.enabled && previewUrl ? (
            <section className="shop-admin__card shop-admin__card--wide">
              <h2>URLs para tu landing</h2>
              <p className="muted small">
                Enlace directo (recomendado) o iframe embebido. Configurá{' '}
                <code>SHOP_FRONT_URL</code> en el servidor para producción.
              </p>

              <div className="shop-admin__url-block">
                <label>Enlace al carrito / menú</label>
                <div className="shop-admin__copy-row">
                  <input readOnly value={previewUrl} />
                  <button
                    type="button"
                    className="btn-secondary btn-compact"
                    onClick={() => void handleCopy('hash', previewUrl)}
                  >
                    {copied === 'hash' ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              {settings.catalogUrlPath ? (
                <div className="shop-admin__url-block">
                  <label>URL alternativa (ruta limpia)</label>
                  <div className="shop-admin__copy-row">
                    <input readOnly value={settings.catalogUrlPath} />
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() =>
                        void handleCopy('path', settings.catalogUrlPath ?? '')
                      }
                    >
                      {copied === 'path' ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                </div>
              ) : null}

              {settings.embedIframeHtml ? (
                <div className="shop-admin__url-block">
                  <label>Código iframe (embebido)</label>
                  <div className="shop-admin__copy-row shop-admin__copy-row--stack">
                    <textarea readOnly rows={3} value={settings.embedIframeHtml} />
                    <button
                      type="button"
                      className="btn-secondary btn-compact"
                      onClick={() =>
                        void handleCopy('embed', settings.embedIframeHtml ?? '')
                      }
                    >
                      {copied === 'embed' ? 'Copiado' : 'Copiar HTML'}
                    </button>
                  </div>
                </div>
              ) : null}

              <p className="muted small shop-admin__hint">
                Ejemplo en tu landing:{' '}
                <code>{`<a href="${previewUrl}">Pedir en línea</a>`}</code>
              </p>
            </section>
          ) : (
            <section className="shop-admin__card shop-admin__card--wide">
              <h2>Activar tienda</h2>
              <p className="muted">
                Guardá un slug arriba para generar la URL pública. Los productos con estado{' '}
                <strong>activo</strong> en el catálogo aparecerán en la carta.
              </p>
            </section>
          )}
        </>
      ) : null}

      <ViewBootSplash ready={!loading} label="Cargando tienda en línea…" />
    </div>
  )
}
