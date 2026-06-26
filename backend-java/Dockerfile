# 多阶段构建:Maven 编译打包 → JRE 运行。
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
# 先拷 pom 预热依赖缓存,再拷源码,加速重复构建。
COPY pom.xml .
RUN mvn -B -ntp dependency:go-offline
COPY src ./src
RUN mvn -B -ntp -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
# 复制可执行 jar(排除 *.original)。
COPY --from=build /workspace/target/*.jar /app/app.jar
EXPOSE 8080
# 容器内默认连同 compose 的 postgres;演示数据走 db/demo。
ENV SPRING_FLYWAY_LOCATIONS=classpath:db/migration,classpath:db/demo
# 健康检查走 Actuator readiness 探针。
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=5 \
  CMD wget -qO- http://localhost:8080/actuator/health/readiness || exit 1
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
