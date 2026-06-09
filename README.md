# vos.ai-front — Frontend VOS AI (React + Vite)

Landing (`#/`), login, panel operativo y tienda pública en una sola app.

## Variables de entorno

| Archivo | Uso |
|---------|-----|
| `.env.local` | Desarrollo local (`npm run dev`) |
| `.env.dev` | Build para servidor dev (`npm run build:dev`) |

```bash
cp .env.local.example .env.local
cp .env.dev.example .env.dev
```

## Desarrollo local

Requiere el API en :3000 (`npm run start:dev` en `../vos.ai-api`).

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

| Ruta | URL |
|------|-----|
| Landing | http://localhost:5173/#/ |
| Login | http://localhost:5173/#/login |
| Panel | http://localhost:5173/#/home |
| Tienda demo | http://localhost:5173/#/tienda/arandano |

El proxy Vite `/dev-api` → `localhost:3000` evita CORS (dejá `VITE_API_URL` vacío).

## Build servidor dev

```bash
cp .env.dev.example .env.dev    # editar dominio y API
npm run build:dev
npm run preview:dev             # probar build localmente
```

## Docker

```bash
docker build -t vos-front:latest .
```

En producción, pasá build args `VITE_*` desde `.env.dev` o usá el compose del API (`../vos.ai-api`).

## Login demo

`admin@vos.ai` / `VosAi2026!`
