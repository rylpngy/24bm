# syntax=docker.m.daocloud.io/docker/dockerfile:1.7
# 多阶段构建:Maven 编译打包 → JRE 运行。
ARG MAVEN_IMAGE=maven:3.9-eclipse-temurin-21
ARG JRE_IMAGE=eclipse-temurin:21-jre

FROM ${MAVEN_IMAGE} AS build
WORKDIR /workspace
# 先拷 pom 预热依赖缓存,再拷源码,加速重复构建。
COPY pom.xml .
COPY maven-settings-docker.xml /root/.m2/settings.xml
RUN --mount=type=cache,id=maven-repository,target=/root/.m2/repository,sharing=locked \
  mvn -B dependency:go-offline
COPY src ./src
RUN --mount=type=cache,id=maven-repository,target=/root/.m2/repository,sharing=locked \
  mvn -B -DskipTests package

FROM ${JRE_IMAGE}
WORKDIR /app
# 复制可执行 jar(排除 *.original)。
COPY --from=build /workspace/target/*.jar /app/app.jar
EXPOSE 8080
# 容器内默认连同 compose 的 postgres;演示种子走独立链(flyway_seed_history)。
ENV APP_SEED_LOCATIONS=classpath:db/demo
# 健康检查走 Actuator readiness 探针。
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:8080/actuator/health/readiness || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
