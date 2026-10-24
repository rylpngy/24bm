package com.procurement.identity;

import com.procurement.identity.security.JwtAuthenticationFilter;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
  private final JwtAuthenticationFilter jwtAuthenticationFilter;
  private final List<String> corsAllowedOrigins;
  private final com.procurement.identity.application.PermissionService permissions;

  public SecurityConfig(
      JwtAuthenticationFilter jwtAuthenticationFilter,
      com.procurement.identity.application.PermissionService permissions,
      @Value("${procurement.security.cors-allowed-origins}") List<String> corsAllowedOrigins) {
    this.jwtAuthenticationFilter = jwtAuthenticationFilter;
    this.corsAllowedOrigins = corsAllowedOrigins;
    this.permissions = permissions;
  }

  @Bean
  PasswordEncoder passwordEncoder() {
    return new BCryptPasswordEncoder();
  }

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
    return http
        .cors(cors -> cors.configurationSource(corsConfigurationSource()))
        .csrf(csrf -> csrf.disable())
        .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .exceptionHandling(errors -> errors.accessDeniedHandler((request, response, denied) -> {
          response.setStatus(403);
          response.setContentType("application/json;charset=UTF-8");
          response.getWriter().write("{\"success\":false,\"data\":null,\"message\":\"当前账号无权执行此操作\"}");
        }))
        .authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/v1/health", "/api/v1/auth/login").permitAll()
            .requestMatchers("/api/v1/public/**").permitAll()
            .requestMatchers("/actuator/health/**", "/actuator/info", "/actuator/prometheus").permitAll()
            .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
            .requestMatchers("/api/v1/platform/**").access(portalAccess("platform", "PLATFORM_ADMIN"))
            // Record history checks its target permission and scope in AuditReadAccess.
            .requestMatchers(org.springframework.http.HttpMethod.GET, "/api/v1/buyer/audit-logs/target")
                .hasAnyRole("BUYER_OWNER", "BUYER_REQUESTER", "BUYER_FINANCE")
            .requestMatchers("/api/v1/buyer/orders/**", "/api/v1/buyer/receipts/**", "/api/v1/buyer/deliveries/**",
                "/api/v1/buyer/suppliers/**", "/api/v1/buyer/supplier-invitations/**",
                "/api/v1/buyer/analytics/**", "/api/v1/buyer/budgets/**", "/api/v1/buyer/audit-logs/**",
                "/api/v1/buyer/mall/**", "/api/v1/buyer/tenders/**",
                "/api/v1/buyer/ai/**", "/api/v1/buyer/numbering-rules/**")
                .access(portalAccess("buyer", "BUYER_OWNER", "BUYER_REQUESTER", "BUYER_FINANCE"))
            .requestMatchers("/api/v1/buyer/**").hasAnyRole("BUYER_OWNER", "BUYER_REQUESTER", "BUYER_FINANCE")
            .requestMatchers("/api/v1/supplier/**").access(portalAccess("supplier", "SUPPLIER_SALES"))
            .anyRequest().authenticated())
        .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
        .build();
  }

  private org.springframework.security.authorization.AuthorizationManager<org.springframework.security.web.access.intercept.RequestAuthorizationContext>
      portalAccess(String scope, String... roles) {
    return (authentication, context) -> {
      boolean correctPortal = authentication.get().getAuthorities().stream()
          .anyMatch(authority -> java.util.Arrays.stream(roles)
              .anyMatch(role -> authority.getAuthority().equals("ROLE_" + role)));
      var request = context.getRequest();
      String path = request.getRequestURI().substring(request.getContextPath().length());
      boolean allowed = correctPortal && permissions.currentUserHas(
          com.procurement.identity.security.PortalPermissionPolicy.required(scope, request.getMethod(), path));
      return new org.springframework.security.authorization.AuthorizationDecision(allowed);
    };
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration configuration = new CorsConfiguration();
    // 来源白名单由配置注入(CORS_ALLOWED_ORIGINS,逗号分隔);默认值仅覆盖本地三端 dev/preview。
    configuration.setAllowedOrigins(corsAllowedOrigins);
    configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
    configuration.setAllowedHeaders(List.of("authorization", "content-type"));
    configuration.setExposedHeaders(List.of("authorization"));
    configuration.setAllowCredentials(true);

    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", configuration);
    return source;
  }
}
