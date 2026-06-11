# vos.ai-front — SPA React + Vite

## Variables de entorno

| Entorno | Archivo | Comando |
|---------|---------|---------|
| **Local** | `.env.local` | `npm run dev` |
| **Staging** | `.env.dev` | `npm run build:dev` |
| **Producción** | `.env` | `npm run build` |

```bash
cp .env.local.example .env.local       # primera vez local
cp .env.production.example .env        # primera vez VPS
cp .env.dev.example .env.dev           # primera vez staging
```

`.env`, `.env.local` y `.env.dev` no se commitean.

En el **VPS usá solo `.env`** — `VITE_*` se embebe al compilar (`npm run build`).

## Desarrollo local

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

El proxy Vite `/dev-api` → `localhost:3000` evita CORS (dejá `VITE_API_URL` vacío en `.env.local`).

## Producción (VPS)

Ver `../vos.ai-api/docs/DEPLOY-VPS-PM2.md`.

```bash
cp .env.production.example .env
nano .env    # VITE_API_URL=https://vos-ai.arandano.shop/backend
npm run build
```

## Build staging

```bash
cp .env.dev.example .env.dev
npm run build:dev
npm run preview:dev
```
