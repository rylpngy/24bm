# 三端前端通用镜像:pnpm 构建指定 app → nginx 静态托管(SPA 回退)。
# 构建参数:APP=tenant-portal|supplier-portal|platform-admin|mall-portal,VITE_* 为构建期注入。
FROM node:22-alpine AS build
ARG APP
ARG VITE_JAVA_API_BASE_URL=http://localhost:8080
ARG VITE_KEYCLOAK_URL=http://localhost:8081
ARG VITE_SELF_LOGIN=false
ENV VITE_JAVA_API_BASE_URL=$VITE_JAVA_API_BASE_URL \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_SELF_LOGIN=$VITE_SELF_LOGIN
WORKDIR /workspace
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @24bid/${APP} build

FROM nginx:1.27-alpine
ARG APP
COPY infra/portal-nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/${APP}/dist /usr/share/nginx/html
EXPOSE 80
