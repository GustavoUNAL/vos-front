# vos-front — VOS AI

SPA React + Vite. Modo **multi-empresa** (`VITE_PLATFORM_MODE`, activo por defecto).

## Desarrollo

```bash
npm install
npm run dev    # http://localhost:5173
```

El API debe estar en `:3000`. El proxy Vite (`/dev-api`) evita problemas de CORS en local.

**Login demo:** `admin@vos.ai.local` / `admin123`

## Producción / VPS

El build embebe `VITE_API_URL` (URL pública del API):

```bash
VITE_API_URL=http://TU_IP:3000 npm run build
```

En Docker: ver `Dockerfile` y `../vos-api/docker-compose.vps.yml`.

## Variables

Ver `.env.example`. En desarrollo no hace falta `VITE_API_URL` si usás `npm run dev`.
