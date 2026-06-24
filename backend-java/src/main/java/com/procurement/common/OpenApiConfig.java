package com.procurement.common;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.info.Info;
import io.swagger.v3.oas.annotations.security.SecurityScheme;
import io.swagger.v3.oas.annotations.servers.Server;
import org.springdoc.core.customizers.OperationCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 正向契约（Contract-First）配置：springdoc 据此从控制器注解生成 OpenAPI，
 * 供前端 orval 派生类型与 TanStack Query hooks。替代旧的前端手写契约。
 */
@Configuration
@OpenAPIDefinition(
    info = @Info(
        title = "24Bid Procurement SaaS API",
        version = "v1",
        description = "多租户采购协同管理 SaaS 后端契约（平台 / 采购方 / 供应商三端）。"),
    servers = @Server(url = "/", description = "Default"))
@SecurityScheme(
    name = "bearerAuth",
    type = SecuritySchemeType.HTTP,
    scheme = "bearer",
    bearerFormat = "JWT")
public class OpenApiConfig {

  /**
   * 生成语义化、唯一的 operationId（控制器名_方法名），让 orval 派生出
   * 例如 useBuyerWorkspaceLoad 这样的可读 hook，而非 useLoad2。
   */
  @Bean
  OperationCustomizer operationIdCustomizer() {
    return (operation, handlerMethod) -> {
      String controller = handlerMethod.getBeanType().getSimpleName().replaceAll("Controller$", "");
      String method = handlerMethod.getMethod().getName();
      operation.setOperationId(controller + "_" + method);
      return operation;
    };
  }
}
