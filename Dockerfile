# Build de producción Vite → Nginx (stack Docker en la raíz del monorepo).
# VITE_API_URL se pasa en build (docker compose build arg).
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json ./
COPY package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .

ARG VITE_API_URL=http://localhost:8080/dev-api
ARG VITE_APP_URL=http://localhost:8080
ARG VITE_LANDING_URL=http://localhost:8080/#/
ARG VITE_PLATFORM_MODE=true
ARG VITE_SHOP_SLUG=arandano
ARG VITE_SHOP_FRONT_URL=http://localhost:8080
ARG VITE_SHOP_URL=http://localhost:8080/#/tienda/arandano
ARG VITE_BRAND_NAME=VOS AI
ARG VITE_BRAND_TAGLINE=Sistema operativo inteligente para empresas.
ARG VITE_DEMO_COMPANY_NAME=Arándano Café Bar
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_APP_URL=$VITE_APP_URL
ENV VITE_LANDING_URL=$VITE_LANDING_URL
ENV VITE_PLATFORM_MODE=$VITE_PLATFORM_MODE
ENV VITE_SHOP_SLUG=$VITE_SHOP_SLUG
ENV VITE_SHOP_FRONT_URL=$VITE_SHOP_FRONT_URL
ENV VITE_SHOP_URL=$VITE_SHOP_URL
ENV VITE_BRAND_NAME=$VITE_BRAND_NAME
ENV VITE_BRAND_TAGLINE=$VITE_BRAND_TAGLINE
ENV VITE_DEMO_COMPANY_NAME=$VITE_DEMO_COMPANY_NAME

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
RUN printf '%s\n' \
  'server {' \
  '  listen 80;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  location / {' \
  '    try_files $uri $uri/ /index.html;' \
  '  }' \
  '}' > /etc/nginx/conf.d/default.conf
