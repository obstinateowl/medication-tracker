ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:3.20
# hadolint ignore=DL3006
FROM ${BUILD_FROM}

ARG BUILD_ARCH
ARG BUILD_VERSION

ENV APP_VERSION=${BUILD_VERSION}

LABEL \
  io.hass.version="${BUILD_VERSION}" \
  io.hass.type="app" \
  io.hass.arch="${BUILD_ARCH}"

# libstdc++ required by Alpine nodejs; pure-JS mysql driver (no native addons)
RUN apk add --no-cache libstdc++ nodejs npm

WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json server/package-lock.json ./server/
COPY client/package.json client/package-lock.json ./client/

RUN npm ci --prefix . \
  && npm ci --prefix server \
  && npm ci --prefix client

COPY server server
COPY client client

RUN npm run build --prefix client \
  && npm run build --prefix server \
  && npm prune --prefix server --omit=dev \
  && npm prune --prefix client --omit=dev

COPY run.sh /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
