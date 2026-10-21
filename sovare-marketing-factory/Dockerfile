# Sovare Marketing Factory: servicio persistente (API, MCP, panel y scheduler)
# con Chromium y FFmpeg para renderizar.
#
#   docker build -t sovare-marketing-factory .
#   docker run --env-file .env -p 8787:8787 -v smf-out:/app/out sovare-marketing-factory
#
# Necesita DATABASE_URL (Postgres): PGlite es para desarrollo, no para un
# contenedor que se reinicia.

FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium ffmpeg git ca-certificates fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium \
    NODE_ENV=production \
    SMF_REPOS_DIR=/app/data/repos \
    SMF_OUT_DIR=/app/out

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .

RUN useradd --create-home smf && mkdir -p /app/data /app/out && chown -R smf /app/data /app/out
USER smf

EXPOSE 8787
HEALTHCHECK --interval=60s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npx", "tsx", "src/cli.ts", "serve"]
